import { localStore } from "@/shared/storage";
import { appendLogEntry } from "@/background/handlers/log-handler";
import { notifyError, notifyPageToast } from "./error-surfacer";
import { executeScript } from "./script-manager";
import { DEEP_QUERY_SNIPPET } from "@/shared/deep-query-snippet";
import { cspSafeExecExpression, cspSafeExecStatements } from "@/shared/csp-safe-eval";
import { normalizeUrl, now } from "@/shared/utils";
import type { EntityId, Flow, FlowNode, FlowNodeConfig } from "@/shared/types/entities";
import type { FlowRunState, FlowRunLogEntry } from "@/shared/types/flow-run";
import { injectResultWidget } from "@/shared/result-display";
import {
  openResultTab,
  runExtraction,
  processOutputActions,
  ensureContentScript,
} from "./extraction-engine";

// ─── Flow Run Status Broadcasting ────────────────────────────────────────────

const SESSION_KEY = "_flowRunState";

async function broadcastState(runState: FlowRunState): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: runState });
}

function addRunLog(runState: FlowRunState, level: FlowRunLogEntry["level"], message: string): void {
  runState.logs.push({ timestamp: now(), level, message });
}

function nodeLabel(config: FlowNodeConfig): string {
  switch (config.type) {
    case "click":
      return `Click "${config.selector}"`;
    case "type":
      return `Type into "${config.selector}"`;
    case "scroll":
      return `Scroll ${config.direction} ${String(config.amount)}px`;
    case "navigate":
      return `Navigate to "${config.url}"`;
    case "wait_element":
      return `Wait for "${config.selector}"`;
    case "wait_ms":
      return `Wait ${String(config.duration)}ms`;
    case "wait_idle":
      return "Wait for idle";
    case "condition":
      return `Condition (${config.check.type})`;
    case "script":
      return `Run script`;
    case "open_tab":
      return `Open tab "${config.url}"`;
    case "close_tab":
      return "Close tab";
    case "loop":
      return config.count !== undefined ? `Loop ${String(config.count)}x` : "Loop until selector";
    case "extract":
      return `Extract "${config.selector}"`;
    case "run_extraction":
      return `Run extraction rule`;
    case "clipboard_copy":
      return `Copy "${config.selector}"`;
    case "clipboard_paste":
      return `Paste into "${config.selector}"`;
  }
}

// ─── Per-run execution context ───────────────────────────────────────────────

/**
 * Per-invocation execution state. Created fresh inside {@link executeFlow} and
 * threaded through every node so concurrent flow runs never share state.
 * (Previously runState / stepIndexMap / nodeMap lived at module scope, which let
 * two simultaneous runs clobber each other's maps and silently skip steps.)
 */
interface FlowContext {
  /** Active tab ID — open_tab / close_tab can update it mid-flow. */
  tabId: number;
  /** Live run state broadcast to the popup's FlowRunWidget. */
  runState: FlowRunState;
  /** O(1) node-ID → step-index lookup. */
  stepIndexMap: Map<string, number>;
  /** O(1) node-ID → node lookup (used by condition / loop branches). */
  nodeMap: Map<string, FlowNode>;
}

// ─── Tab helpers ─────────────────────────────────────────────────────────────

/**
 * Wait until a tab reaches "complete" status (page fully loaded).
 *
 * Rejects promptly — instead of hanging for the full timeout — if the tab is
 * closed or otherwise unavailable mid-load, and never leaves the `onUpdated`
 * listener attached. A missing `.catch` on `chrome.tabs.get` previously caused
 * an unhandled rejection plus a ~30s hang when the tab closed between
 * scheduling and the lookup.
 */
function waitForTabLoad(tabId: number, timeoutMs = 30_000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      action();
    };

    const timeout = setTimeout(() => {
      finish(() => {
        reject(new Error(`Tab ${String(tabId)} load timed out after ${String(timeoutMs / 1000)}s`));
      });
    }, timeoutMs);

    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo): void => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish(resolve);
      }
    };

    const onRemoved = (removedTabId: number): void => {
      if (removedTabId === tabId) {
        finish(() => {
          reject(new Error(`Tab ${String(tabId)} was closed before it finished loading`));
        });
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);

    // The tab may already be complete (e.g. about:blank → url navigation).
    chrome.tabs.get(tabId).then(
      (tab) => {
        if (tab.status === "complete") finish(resolve);
      },
      (err: unknown) => {
        finish(() => {
          reject(err instanceof Error ? err : new Error(`Tab ${String(tabId)} is not available`));
        });
      },
    );
  });
}

// ─── Concurrent execution guard ──────────────────────────────────────────────

/** Tracks flow IDs currently executing to prevent duplicate runs. */
const runningFlows = new Set<EntityId>();

// ─── Flow Execution ──────────────────────────────────────────────────────────

/**
 * Execute a flow by walking its nodes sequentially.
 * Prevents concurrent execution of the same flow.
 */
export async function executeFlow(
  flowId: EntityId,
  tabId: number,
): Promise<{ ok: boolean; error?: string }> {
  if (runningFlows.has(flowId)) {
    return { ok: false, error: "Flow is already running" };
  }

  const flows = (await localStore.get("flows")) ?? {};
  const flow = flows[flowId];

  if (!flow) {
    return { ok: false, error: "Flow not found" };
  }

  runningFlows.add(flowId);

  // Initialize per-run state. Everything below is local to this invocation, so
  // two concurrent flow runs can never clobber each other's maps or run state.
  const runState: FlowRunState = {
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

  // Build O(1) lookups (avoids repeated O(n) find/findIndex in loops and conditions)
  const stepIndexMap = new Map<string, number>();
  for (let i = 0; i < runState.steps.length; i++) {
    const step = runState.steps[i];
    if (step) stepIndexMap.set(step.nodeId, i);
  }
  const nodeMap = new Map<string, FlowNode>();
  for (const node of flow.nodes) {
    nodeMap.set(node.id, node);
  }

  const ctx: FlowContext = { tabId, runState, stepIndexMap, nodeMap };

  addRunLog(runState, "info", `Flow "${flow.name}" started`);
  await broadcastState(runState);

  await appendLogEntry({
    action: "flow_executed",
    status: "info",
    entityId: flow.id,
    entityType: "flow",
    message: `Flow "${flow.name}" started`,
  });

  try {
    await walkNodes(flow, flow.nodes, ctx);

    runState.status = "success";
    runState.completedAt = now();
    addRunLog(runState, "success", `Flow "${flow.name}" completed successfully`);
    await broadcastState(runState);

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
    addRunLog(runState, "error", `Flow "${flow.name}" failed: ${errorMessage}`);
    await broadcastState(runState);

    await appendLogEntry({
      action: "flow_error",
      status: "error",
      entityId: flow.id,
      entityType: "flow",
      message: `Flow "${flow.name}" failed`,
      error: { name: "FlowExecutionError", message: errorMessage },
    });

    if (flow.notifyOnError) {
      await notifyError(`Flow Error: ${flow.name || "Untitled"}`, errorMessage);
    }

    return { ok: false, error: errorMessage };
  } finally {
    runningFlows.delete(flowId);
    // No module-level state to release — runState / stepIndexMap / nodeMap are
    // local to this invocation and freed when it returns.
  }
}

async function walkNodes(flow: Flow, nodes: FlowNode[], ctx: FlowContext): Promise<void> {
  for (const node of nodes) {
    await executeNode(flow, node, ctx);
  }
}

async function executeNode(flow: Flow, node: FlowNode, ctx: FlowContext): Promise<void> {
  const config = node.config;
  const { runState, stepIndexMap } = ctx;

  // Update run state — mark this node as running (O(1) via stepIndexMap).
  // Scoped block keeps these locals from colliding with the success/error markers below.
  {
    const stepIndex = stepIndexMap.get(node.id);
    const step = stepIndex !== undefined ? runState.steps[stepIndex] : undefined;
    if (step && stepIndex !== undefined) {
      runState.currentNodeIndex = stepIndex;
      step.status = "running";
      step.startedAt = now();
      addRunLog(runState, "info", `Running: ${step.label}`);
      await broadcastState(runState);
    }
  }

  try {
    switch (config.type) {
      case "click": {
        // Returns false when the selector matches nothing, so a missed click is
        // reported as a failure instead of being silently swallowed by `?.`
        // (which evaluated to `undefined` and let the node report success).
        const clicked = await injectActionResult(
          ctx.tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (!el) return false;
          if (typeof el.click === "function") el.click();
          else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          return true;
        `,
        );
        if (clicked !== true) {
          throw new Error(`Click target not found: no element matched "${config.selector}"`);
        }
        break;
      }

      case "type": {
        const typed = await injectActionResult(
          ctx.tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (!el) return false;
          el.value = ${interpolateExpr(config.text)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        `,
        );
        if (typed !== true) {
          throw new Error(`Type target not found: no element matched "${config.selector}"`);
        }
        break;
      }

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

        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- chrome.tabs.sendMessage returns `any` */
        const extractResponse = await chrome.tabs.sendMessage(ctx.tabId, {
          type: "EXTRACT_DATA",
          ruleId: "__flow_extract__",
          fields: [
            {
              name: config.outputVar || "value",
              selector: config.selector,
              ...(config.fallbackSelectors ? { fallbackSelectors: config.fallbackSelectors } : {}),
              ...(config.attribute ? { attribute: config.attribute } : {}),
              multiple: false,
              ...(config.transforms ? { transforms: config.transforms } : {}),
            },
          ],
        });

        const firstRow = extractResponse?.data?.[0];
        const rawExtracted: unknown = firstRow
          ? (firstRow[config.outputVar || "value"] ?? null)
          : null;
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        const extractedValue = rawExtracted != null && rawExtracted !== "" ? rawExtracted : null;

        // Store value in window so subsequent nodes (navigate, type) can use {{varName}}
        if (extractedValue != null) {
          await chrome.scripting.executeScript({
            target: { tabId: ctx.tabId },
            world: "MAIN",
            func: (varName: string, val: string) => {
              (window as unknown as Record<string, unknown>)[varName] = val;
            },
            args: [
              config.outputVar,
              typeof extractedValue === "string" ? extractedValue : JSON.stringify(extractedValue),
            ],
          });
        }

        // Always log the extracted value for debugging
        const extractedStr =
          extractedValue != null
            ? typeof extractedValue === "string"
              ? extractedValue
              : JSON.stringify(extractedValue)
            : null;
        addRunLog(
          runState,
          extractedStr != null ? "info" : "warning",
          extractedStr != null
            ? `Extracted "${config.outputVar}": ${extractedStr.slice(0, 500)}`
            : `Extract "${config.outputVar}" from "${config.selector}": no value found`,
        );
        await broadcastState(runState);

        // Perform output actions if configured
        const actions = config.outputActions ?? [];
        if (extractedStr != null && actions.length > 0) {
          const formatted = extractedStr;

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
                    // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional fallback for contexts without clipboard API
                    document.execCommand("copy");
                    document.body.removeChild(textarea);
                  });
                },
                args: [formatted],
              });
              addRunLog(runState, "success", `Copied extracted value to clipboard`);
            } catch (clipErr) {
              addRunLog(
                runState,
                "warning",
                `Clipboard copy failed: ${clipErr instanceof Error ? clipErr.message : String(clipErr)}`,
              );
            }
          }

          if (actions.includes("download")) {
            try {
              const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(formatted)}`;
              await chrome.downloads.download({
                url: dataUrl,
                filename: `${config.outputVar || "extract"}.txt`,
                saveAs: false,
              });
              addRunLog(runState, "success", `Downloaded extracted value as file`);
            } catch (dlErr) {
              addRunLog(
                runState,
                "warning",
                `Download failed: ${dlErr instanceof Error ? dlErr.message : String(dlErr)}`,
              );
            }
          }

          if (actions.includes("show")) {
            addRunLog(runState, "info", `[show] "${config.outputVar}": ${formatted.slice(0, 500)}`);
          }

          if (actions.includes("show_page")) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: ctx.tabId },
                world: "MAIN",
                func: injectResultWidget,
                args: [formatted, "text", 1, config.outputVar || "Extract"],
              });
              addRunLog(runState, "success", `Displayed extraction result on page`);
            } catch (widgetErr) {
              addRunLog(
                runState,
                "warning",
                `Page widget failed: ${widgetErr instanceof Error ? widgetErr.message : String(widgetErr)}`,
              );
            }
          }

          if (actions.includes("show_tab")) {
            try {
              await openResultTab(formatted, "text", 1, config.outputVar || "Extract", false);
              addRunLog(runState, "success", `Opened extraction result in new tab`);
            } catch (tabErr) {
              addRunLog(
                runState,
                "warning",
                `New tab display failed: ${tabErr instanceof Error ? tabErr.message : String(tabErr)}`,
              );
            }
          }
        }
        break;
      }

      case "run_extraction": {
        const ruleId = config.extractionRuleId;
        if (!ruleId) {
          addRunLog(runState, "error", "No extraction rule selected");
          break;
        }
        const extractionResult = await runExtraction(ruleId, ctx.tabId);
        if (!extractionResult.ok) {
          addRunLog(
            runState,
            "error",
            `Extraction rule failed: ${extractionResult.error ?? "unknown error"}`,
          );
          break;
        }
        const rowCount = extractionResult.data?.length ?? 0;
        addRunLog(runState, "success", `Extraction completed: ${String(rowCount)} row(s)`);
        await broadcastState(runState);

        // Process output actions (clipboard, download, show_page, show_tab) as configured on the rule
        if (extractionResult.formatted && rowCount > 0) {
          const extractionRules = (await localStore.get("extractionRules")) ?? {};
          const rule = extractionRules[ruleId];
          if (rule) {
            await processOutputActions(
              ctx.tabId,
              rule,
              extractionResult.formatted,
              extractionResult.data ?? [],
            );
          }
        }
        break;
      }

      case "clipboard_copy": {
        const copied = await injectActionResult(
          ctx.tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (!el) return false;
          await navigator.clipboard.writeText(el.textContent ?? '');
          return true;
        `,
        );
        if (copied !== true) {
          throw new Error(`Copy target not found: no element matched "${config.selector}"`);
        }
        break;
      }

      case "clipboard_paste": {
        const pasted = await injectActionResult(
          ctx.tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (!el) return false;
          const text = await navigator.clipboard.readText();
          el.value = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        `,
        );
        if (pasted !== true) {
          throw new Error(`Paste target not found: no element matched "${config.selector}"`);
        }
        break;
      }
    }

    // Mark step as success (O(1) via stepIndexMap)
    {
      const idx = stepIndexMap.get(node.id);
      const step = idx !== undefined ? runState.steps[idx] : undefined;
      if (step) {
        step.status = "success";
        step.completedAt = now();
        addRunLog(runState, "success", `Completed: ${step.label}`);
        await broadcastState(runState);
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

    // Mark step as error (O(1) via stepIndexMap)
    {
      const idx = stepIndexMap.get(node.id);
      const step = idx !== undefined ? runState.steps[idx] : undefined;
      if (step) {
        step.status = "error";
        step.completedAt = now();
        step.error = errorMessage;
        addRunLog(runState, "error", `Failed: ${step.label} — ${errorMessage}`);
        await broadcastState(runState);
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

    // Surface the failure on the page itself. The user triggers these flows from
    // the page (e.g. via a shortcut) and is watching it, not the popup's run
    // widget — so a missed click must produce visible on-page feedback.
    void notifyPageToast(ctx.tabId, `${flow.name || "Flow"}: ${errorMessage}`);

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
    func: (names: string[]) =>
      names.map((n) =>
        (window as unknown as Record<string, unknown>)[n] != null
          ? String((window as unknown as Record<string, unknown>)[n])
          : "",
      ),
    args: [varNames],
  });
  const values = results[0]?.result ?? [];
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

/**
 * Inject `code` (a statement body with access to __qsDeep / __qsaDeep) into the
 * page's MAIN world and return whatever the code `return`s.
 *
 * Unlike {@link injectAction}, the injected expression's result is preserved so
 * callers can detect outcomes — e.g. that a target element was not found —
 * instead of assuming the node succeeded.
 */
async function injectActionResult(tabId: number, code: string): Promise<unknown> {
  // Prepend shadow-DOM-aware helpers so __qsDeep / __qsaDeep are available
  const wrappedCode = `(async () => { ${DEEP_QUERY_SNIPPET}; ${code} })()`;
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: cspSafeExecExpression,
    args: [wrappedCode],
  });
  return results[0]?.result;
}

/** Inject a fire-and-forget side effect whose return value is irrelevant. */
async function injectAction(tabId: number, code: string): Promise<void> {
  await injectActionResult(tabId, code);
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
    func: cspSafeExecStatements,
    args: [checkCode],
  });

  const passed = results[0]?.result as boolean;
  const targetNodeId = passed ? config.thenNodeId : config.elseNodeId;

  if (targetNodeId) {
    const targetNode = ctx.nodeMap.get(targetNodeId);
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
  if (!result.ok) {
    throw new Error(result.error ?? "Script execution failed");
  }
}

async function executeLoop(
  flow: Flow,
  config: Extract<FlowNodeConfig, { type: "loop" }>,
  ctx: FlowContext,
): Promise<void> {
  // Resolve body nodes via O(1) map instead of O(n) find per node
  const bodyNodes = config.bodyNodeIds
    .map((id) => ctx.nodeMap.get(id))
    .filter((n): n is FlowNode => n !== undefined);

  if (config.count !== undefined) {
    for (let i = 0; i < config.count; i++) {
      await walkNodes(flow, bodyNodes, ctx);
    }
  } else if (config.untilSelector) {
    const maxIterations = 1000;
    for (let i = 0; i < maxIterations; i++) {
      const loopCheckCode = `${DEEP_QUERY_SNIPPET}; return !!__qsDeep(${JSON.stringify(config.untilSelector)})`;
      const results = await chrome.scripting.executeScript({
        target: { tabId: ctx.tabId },
        world: "MAIN",
        func: cspSafeExecStatements,
        args: [loopCheckCode],
      });
      if (results[0]?.result) break;
      await walkNodes(flow, bodyNodes, ctx);
    }
  }
}
