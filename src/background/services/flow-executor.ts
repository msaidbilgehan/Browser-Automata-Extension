import { localStore } from "@/shared/storage";
import { appendLogEntry } from "@/background/handlers/log-handler";
import { executeScript } from "./script-manager";
import { DEEP_QUERY_SNIPPET } from "@/shared/deep-query-snippet";
import { normalizeUrl, now } from "@/shared/utils";
import type { EntityId, Flow, FlowNode, FlowNodeConfig } from "@/shared/types/entities";
import type { FlowRunState, FlowRunLogEntry } from "@/shared/types/flow-run";
import { injectResultWidget } from "@/shared/result-display";
import { openResultTab, runExtraction, processOutputActions, ensureContentScript } from "./extraction-engine";

// ─── Flow Run Status Broadcasting ────────────────────────────────────────────

const SESSION_KEY = "_flowRunState";

let runState: FlowRunState | null = null;

async function broadcastState(): Promise<void> {
  if (runState) {
    await chrome.storage.session.set({ [SESSION_KEY]: runState });
  }
}

function addRunLog(level: FlowRunLogEntry["level"], message: string): void {
  if (!runState) return;
  runState.logs.push({ timestamp: now(), level, message });
}

function nodeLabel(config: FlowNodeConfig): string {
  switch (config.type) {
    case "click": return `Click "${config.selector}"`;
    case "type": return `Type into "${config.selector}"`;
    case "scroll": return `Scroll ${config.direction} ${String(config.amount)}px`;
    case "navigate": return `Navigate to "${config.url}"`;
    case "wait_element": return `Wait for "${config.selector}"`;
    case "wait_ms": return `Wait ${String(config.duration)}ms`;
    case "wait_idle": return "Wait for idle";
    case "condition": return `Condition (${config.check.type})`;
    case "script": return `Run script`;
    case "open_tab": return `Open tab "${config.url}"`;
    case "close_tab": return "Close tab";
    case "loop": return config.count !== undefined ? `Loop ${String(config.count)}x` : "Loop until selector";
    case "extract": return `Extract "${config.selector}"`;
    case "run_extraction": return `Run extraction rule`;
    case "clipboard_copy": return `Copy "${config.selector}"`;
    case "clipboard_paste": return `Paste into "${config.selector}"`;
  }
}

// ─── Mutable execution context ──────────────────────────────────────────────

/** Holds the active tab ID so open_tab / close_tab can update it mid-flow. */
interface FlowContext {
  tabId: number;
}

// ─── Tab helpers ─────────────────────────────────────────────────────────────

/** Wait until a tab reaches "complete" status (page fully loaded). */
function waitForTabLoad(tabId: number, timeoutMs = 30_000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab ${String(tabId)} load timed out after ${String(timeoutMs / 1000)}s`));
    }, timeoutMs);

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // The tab may already be complete (e.g. about:blank → url navigation)
    void chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

// ─── Flow Execution ──────────────────────────────────────────────────────────

/**
 * Execute a flow by walking its nodes sequentially.
 */
export async function executeFlow(
  flowId: EntityId,
  tabId: number,
): Promise<{ ok: boolean; error?: string }> {
  const flows = (await localStore.get("flows")) ?? {};
  const flow = flows[flowId];

  if (!flow) {
    return { ok: false, error: "Flow not found" };
  }

  // Initialize run state
  runState = {
    flowId: flow.id,
    flowName: flow.name,
    status: "running",
    startedAt: now(),
    currentNodeIndex: -1,
    steps: flow.nodes.map((node) => ({
      nodeId: node.id,
      nodeType: node.config.type,
      label: nodeLabel(node.config),
      status: "pending",
    })),
    logs: [],
  };

  addRunLog("info", `Flow "${flow.name}" started`);
  await broadcastState();

  await appendLogEntry({
    action: "flow_executed",
    status: "info",
    entityId: flow.id,
    entityType: "flow",
    message: `Flow "${flow.name}" started`,
  });

  const ctx: FlowContext = { tabId };

  try {
    await walkNodes(flow, flow.nodes, ctx);

    runState.status = "success";
    runState.completedAt = now();
    addRunLog("success", `Flow "${flow.name}" completed successfully`);
    await broadcastState();

    await appendLogEntry({
      action: "flow_executed",
      status: "success",
      entityId: flow.id,
      entityType: "flow",
      message: `Flow "${flow.name}" completed`,
    });

    return { ok: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    runState.status = "error";
    runState.completedAt = now();
    addRunLog("error", `Flow "${flow.name}" failed: ${errorMessage}`);
    await broadcastState();

    await appendLogEntry({
      action: "flow_error",
      status: "error",
      entityId: flow.id,
      entityType: "flow",
      message: `Flow "${flow.name}" failed`,
      error: { name: "FlowExecutionError", message: errorMessage },
    });
    return { ok: false, error: errorMessage };
  }
}

async function walkNodes(flow: Flow, nodes: FlowNode[], ctx: FlowContext): Promise<void> {
  for (const node of nodes) {
    await executeNode(flow, node, ctx);
  }
}

async function executeNode(flow: Flow, node: FlowNode, ctx: FlowContext): Promise<void> {
  const config = node.config;

  // Update run state — mark this node as running
  if (runState) {
    const stepIndex = runState.steps.findIndex((s) => s.nodeId === node.id);
    const step = stepIndex >= 0 ? runState.steps[stepIndex] : undefined;
    if (step) {
      runState.currentNodeIndex = stepIndex;
      step.status = "running";
      step.startedAt = now();
      addRunLog("info", `Running: ${step.label}`);
      await broadcastState();
    }
  }

  try {
    switch (config.type) {
      case "click":
        await injectAction(
          ctx.tabId,
          `__qsDeep(${JSON.stringify(config.selector)})?.click()`,
        );
        break;

      case "type":
        await injectAction(
          ctx.tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (el) { el.value = ${interpolateExpr(config.text)}; el.dispatchEvent(new Event('input', {bubbles: true})); }
        `,
        );
        break;

      case "scroll":
        await injectAction(
          ctx.tabId,
          `window.scrollBy(0, ${String(config.direction === "down" ? config.amount : -config.amount)})`,
        );
        break;

      case "navigate": {
        let navUrl = normalizeUrl(config.url);
        if (navUrl.includes("{{")) {
          navUrl = await resolveVariables(ctx.tabId, navUrl);
        }
        await chrome.tabs.update(ctx.tabId, { url: navUrl });
        await waitForTabLoad(ctx.tabId);
        break;
      }

      case "wait_element":
        await injectAction(
          ctx.tabId,
          `
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for element')), ${String(config.timeoutMs)});
            const check = () => {
              if (__qsDeep(${JSON.stringify(config.selector)})) { clearTimeout(timeout); resolve(undefined); }
              else { requestAnimationFrame(check); }
            };
            check();
          });
        `,
        );
        break;

      case "wait_ms":
        await injectAction(
          ctx.tabId,
          `await new Promise(r => setTimeout(r, ${String(config.duration)}))`,
        );
        break;

      case "wait_idle":
        await injectAction(ctx.tabId, `await new Promise(r => requestIdleCallback(r))`);
        break;

      case "condition":
        await executeCondition(flow, config, ctx);
        break;

      case "script":
        await executeScriptNode(config.scriptId, ctx.tabId);
        break;

      case "open_tab": {
        let openUrl = normalizeUrl(config.url);
        // Resolve {{varName}} placeholders from page window variables
        if (openUrl.includes("{{")) {
          const resolved = await resolveVariables(ctx.tabId, openUrl);
          openUrl = resolved;
        }
        const newTab = await chrome.tabs.create({ url: openUrl });
        if (newTab.id === undefined) {
          throw new Error("Failed to create tab: no tab ID returned");
        }
        await waitForTabLoad(newTab.id);
        ctx.tabId = newTab.id;
        break;
      }

      case "close_tab": {
        const closingTabId = ctx.tabId;
        // Find a fallback tab before closing
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        const fallback = allTabs.find((t) => t.id !== undefined && t.id !== closingTabId);
        await chrome.tabs.remove(closingTabId);
        if (fallback?.id !== undefined) {
          ctx.tabId = fallback.id;
          await chrome.tabs.update(fallback.id, { active: true });
        }
        break;
      }

      case "loop":
        await executeLoop(flow, config, ctx);
        break;

      case "extract": {
        // Use content script EXTRACT_DATA (same path as extraction rules/test)
        // instead of MAIN-world new Function() which fails on CSP-restricted pages
        await ensureContentScript(ctx.tabId);

        const extractResponse = await chrome.tabs.sendMessage(ctx.tabId, {
          type: "EXTRACT_DATA",
          ruleId: "__flow_extract__",
          fields: [{
            name: config.outputVar || "value",
            selector: config.selector,
            ...(config.fallbackSelectors ? { fallbackSelectors: config.fallbackSelectors } : {}),
            ...(config.attribute ? { attribute: config.attribute } : {}),
            multiple: false,
            ...(config.transforms ? { transforms: config.transforms } : {}),
          }],
        }) as { ok: boolean; data?: Record<string, string>[] } | undefined;

        const firstRow = extractResponse?.data?.[0];
        const rawExtracted = firstRow ? (firstRow[config.outputVar || "value"] ?? null) : null;
        const extractedValue = rawExtracted != null && rawExtracted !== "" ? rawExtracted : null;

        // Store value in window so subsequent nodes (navigate, type) can use {{varName}}
        if (extractedValue != null) {
          await chrome.scripting.executeScript({
            target: { tabId: ctx.tabId },
            world: "MAIN",
            func: (varName: string, val: string) => {
              (window as unknown as Record<string, unknown>)[varName] = val;
            },
            args: [config.outputVar, extractedValue],
          });
        }

        // Always log the extracted value for debugging
        addRunLog(
          extractedValue != null ? "info" : "warning",
          extractedValue != null
            ? `Extracted "${config.outputVar}": ${String(extractedValue).slice(0, 500)}`
            : `Extract "${config.outputVar}" from "${config.selector}": no value found`,
        );
        await broadcastState();

        // Perform output actions if configured
        const actions = config.outputActions ?? [];
        if (extractedValue != null && actions.length > 0) {
          const formatted = String(extractedValue);

          if (actions.includes("clipboard")) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: ctx.tabId },
                world: "MAIN",
                func: (text: string) => {
                  void navigator.clipboard.writeText(text).catch(() => {
                    // Fallback for contexts without clipboard API permission
                    const textarea = document.createElement("textarea");
                    textarea.value = text;
                    textarea.style.position = "fixed";
                    textarea.style.opacity = "0";
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand("copy");
                    document.body.removeChild(textarea);
                  });
                },
                args: [formatted],
              });
              addRunLog("success", `Copied extracted value to clipboard`);
            } catch (clipErr) {
              addRunLog("warning", `Clipboard copy failed: ${clipErr instanceof Error ? clipErr.message : String(clipErr)}`);
            }
          }

          if (actions.includes("download")) {
            try {
              if (!chrome.downloads?.download) throw new Error("downloads permission not granted");
              const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(formatted)}`;
              await chrome.downloads.download({
                url: dataUrl,
                filename: `${config.outputVar || "extract"}.txt`,
                saveAs: false,
              });
              addRunLog("success", `Downloaded extracted value as file`);
            } catch (dlErr) {
              addRunLog("warning", `Download failed: ${dlErr instanceof Error ? dlErr.message : String(dlErr)}`);
            }
          }

          if (actions.includes("show")) {
            addRunLog("info", `[show] "${config.outputVar}": ${formatted.slice(0, 500)}`);
          }

          if (actions.includes("show_page")) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: ctx.tabId },
                world: "MAIN",
                func: injectResultWidget,
                args: [formatted, "text", 1, config.outputVar || "Extract"],
              });
              addRunLog("success", `Displayed extraction result on page`);
            } catch (widgetErr) {
              addRunLog("warning", `Page widget failed: ${widgetErr instanceof Error ? widgetErr.message : String(widgetErr)}`);
            }
          }

          if (actions.includes("show_tab")) {
            try {
              await openResultTab(formatted, "text", 1, config.outputVar || "Extract", false);
              addRunLog("success", `Opened extraction result in new tab`);
            } catch (tabErr) {
              addRunLog("warning", `New tab display failed: ${tabErr instanceof Error ? tabErr.message : String(tabErr)}`);
            }
          }
        }
        break;
      }

      case "run_extraction": {
        const ruleId = config.extractionRuleId;
        if (!ruleId) {
          addRunLog("error", "No extraction rule selected");
          break;
        }
        const extractionResult = await runExtraction(ruleId, ctx.tabId);
        if (!extractionResult.ok) {
          addRunLog("error", `Extraction rule failed: ${extractionResult.error ?? "unknown error"}`);
          break;
        }
        const rowCount = extractionResult.data?.length ?? 0;
        addRunLog("success", `Extraction completed: ${String(rowCount)} row(s)`);
        await broadcastState();

        // Process output actions (clipboard, download, show_page, show_tab) as configured on the rule
        if (extractionResult.formatted && rowCount > 0) {
          const extractionRules = (await localStore.get("extractionRules")) ?? {};
          const rule = extractionRules[ruleId];
          if (rule) {
            await processOutputActions(ctx.tabId, rule, extractionResult.formatted, extractionResult.data ?? []);
          }
        }
        break;
      }

      case "clipboard_copy":
        await injectAction(
          ctx.tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (el) { await navigator.clipboard.writeText(el.textContent ?? ''); }
        `,
        );
        break;

      case "clipboard_paste":
        await injectAction(
          ctx.tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (el) { const text = await navigator.clipboard.readText(); el.value = text; el.dispatchEvent(new Event('input', {bubbles: true})); }
        `,
        );
        break;
    }

    // Mark step as success
    if (runState) {
      const step = runState.steps.find((s) => s.nodeId === node.id);
      if (step) {
        step.status = "success";
        step.completedAt = now();
        addRunLog("success", `Completed: ${step.label}`);
        await broadcastState();
      }
    }

    await appendLogEntry({
      action: "flow_executed",
      status: "success",
      entityId: node.id,
      entityType: "flow",
      message: `Flow "${flow.name}" node ${config.type} completed`,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Mark step as error
    if (runState) {
      const step = runState.steps.find((s) => s.nodeId === node.id);
      if (step) {
        step.status = "error";
        step.completedAt = now();
        step.error = errorMessage;
        addRunLog("error", `Failed: ${step.label} — ${errorMessage}`);
        await broadcastState();
      }
    }

    await appendLogEntry({
      action: "flow_error",
      status: "error",
      entityId: node.id,
      entityType: "flow",
      message: `Flow "${flow.name}" node ${config.type} failed: ${errorMessage}`,
      error: { name: "NodeExecutionError", message: errorMessage },
    });
    // Re-throw to halt flow on error
    throw err;
  }
}

/**
 * Resolve `{{varName}}` placeholders by reading window variables from the page.
 * Used for open_tab where the URL is needed in the service worker (not page context).
 */
async function resolveVariables(tabId: number, template: string): Promise<string> {
  const varNames = [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1] ?? "");
  if (varNames.length === 0) return template;
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (names: string[]) => names.map((n) => (window as unknown as Record<string, unknown>)[n] != null ? String((window as unknown as Record<string, unknown>)[n]) : ""),
    args: [varNames],
  });
  const values = (results[0]?.result as string[] | undefined) ?? [];
  let resolved = template;
  varNames.forEach((name, i) => {
    resolved = resolved.replace(`{{${name}}}`, values[i] ?? "");
  });
  return resolved;
}

/**
 * Resolve `{{varName}}` placeholders in a string by reading from `window[varName]`.
 * Used in navigate, type, and open_tab nodes to interpolate extracted values.
 * Returns a JS expression string that resolves at runtime in the page context.
 */
function interpolateExpr(template: string): string {
  // If no placeholders, return a simple JSON string literal
  if (!template.includes("{{")) return JSON.stringify(template);
  // Build a runtime expression that replaces {{...}} with window values
  return `${JSON.stringify(template)}.replace(/\\{\\{(\\w+)\\}\\}/g, function(_, v) { return window[v] != null ? String(window[v]) : ''; })`;
}

async function injectAction(tabId: number, code: string): Promise<void> {
  // Prepend shadow-DOM-aware helpers so __qsDeep / __qsaDeep are available
  const wrappedCode = `(async () => { ${DEEP_QUERY_SNIPPET}; ${code} })()`;
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (c: string) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn: () => unknown = new Function(`return ${c}`) as () => unknown;
      return fn();
    },
    args: [wrappedCode],
  });
}

async function executeCondition(
  flow: Flow,
  config: Extract<FlowNodeConfig, { type: "condition" }>,
  ctx: FlowContext,
): Promise<void> {
  const checkCode = `${DEEP_QUERY_SNIPPET}; return ${buildConditionCheck(config.check)}`;
  const results = await chrome.scripting.executeScript({
    target: { tabId: ctx.tabId },
    world: "MAIN",
    func: (c: string) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn: () => unknown = new Function(c) as () => unknown;
      return fn();
    },
    args: [checkCode],
  });

  const passed = results[0]?.result as boolean;
  const targetNodeId = passed ? config.thenNodeId : config.elseNodeId;

  if (targetNodeId) {
    const targetNode = flow.nodes.find((n) => n.id === targetNodeId);
    if (targetNode) {
      await executeNode(flow, targetNode, ctx);
    }
  }
}

function buildConditionCheck(
  check: Extract<FlowNodeConfig, { type: "condition" }>["check"],
): string {
  switch (check.type) {
    case "element_exists":
      return `!!__qsDeep(${JSON.stringify(check.selector ?? "")})`;
    case "element_visible": {
      const sel = JSON.stringify(check.selector ?? "");
      return `(() => { const el = __qsDeep(${sel}); return el ? el.offsetParent !== null : false; })()`;
    }
    case "text_contains":
      return `document.body.textContent?.includes(${JSON.stringify(check.value ?? "")}) ?? false`;
    case "url_matches":
      return `new RegExp(${JSON.stringify(check.value ?? "")}).test(window.location.href)`;
  }
}

async function executeScriptNode(scriptId: EntityId, tabId: number): Promise<void> {
  const scripts = (await localStore.get("scripts")) ?? {};
  const script = scripts[scriptId];
  if (!script) {
    throw new Error(`Script ${scriptId} not found`);
  }
  const result = await executeScript(tabId, script);
  if (!result.success) {
    throw new Error(result.error ?? "Script execution failed");
  }
}

async function executeLoop(
  flow: Flow,
  config: Extract<FlowNodeConfig, { type: "loop" }>,
  ctx: FlowContext,
): Promise<void> {
  const bodyNodes = config.bodyNodeIds
    .map((id) => flow.nodes.find((n) => n.id === id))
    .filter((n): n is FlowNode => n !== undefined);

  if (config.count !== undefined) {
    for (let i = 0; i < config.count; i++) {
      await walkNodes(flow, bodyNodes, ctx);
    }
  } else if (config.untilSelector) {
    const maxIterations = 1000;
    for (let i = 0; i < maxIterations; i++) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: ctx.tabId },
        world: "MAIN",
        func: (sel: string, snippet: string) => {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          new Function(snippet)();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
          return !!(globalThis as any).__qsDeep(sel);
        },
        args: [config.untilSelector, DEEP_QUERY_SNIPPET],
      });
      if (results[0]?.result) break;
      await walkNodes(flow, bodyNodes, ctx);
    }
  }
}
