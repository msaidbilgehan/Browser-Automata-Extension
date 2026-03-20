import { localStore } from "@/shared/storage";
import { appendLogEntry } from "@/background/handlers/log-handler";
import { executeScript } from "./script-manager";
import { DEEP_QUERY_SNIPPET } from "@/shared/deep-query-snippet";
import type { EntityId, Flow, FlowNode, FlowNodeConfig } from "@/shared/types/entities";

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

  await appendLogEntry({
    action: "flow_executed",
    status: "info",
    entityId: flow.id,
    entityType: "flow",
    message: `Flow "${flow.name}" started`,
  });

  try {
    await walkNodes(flow, flow.nodes, tabId);

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

async function walkNodes(flow: Flow, nodes: FlowNode[], tabId: number): Promise<void> {
  for (const node of nodes) {
    await executeNode(flow, node, tabId);
  }
}

async function executeNode(flow: Flow, node: FlowNode, tabId: number): Promise<void> {
  const config = node.config;

  try {
    switch (config.type) {
      case "click":
        await injectAction(
          tabId,
          `__qsDeep(${JSON.stringify(config.selector)})?.click()`,
        );
        break;

      case "type":
        await injectAction(
          tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (el) { el.value = ${JSON.stringify(config.text)}; el.dispatchEvent(new Event('input', {bubbles: true})); }
        `,
        );
        break;

      case "scroll":
        await injectAction(
          tabId,
          `window.scrollBy(0, ${String(config.direction === "down" ? config.amount : -config.amount)})`,
        );
        break;

      case "navigate":
        await injectAction(tabId, `window.location.href = ${JSON.stringify(config.url)}`);
        break;

      case "wait_element":
        await injectAction(
          tabId,
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
          tabId,
          `await new Promise(r => setTimeout(r, ${String(config.duration)}))`,
        );
        break;

      case "wait_idle":
        await injectAction(tabId, `await new Promise(r => requestIdleCallback(r))`);
        break;

      case "condition":
        await executeCondition(flow, config, tabId);
        break;

      case "script":
        await executeScriptNode(config.scriptId, tabId);
        break;

      case "open_tab":
        await chrome.tabs.create({ url: config.url });
        break;

      case "close_tab":
        await chrome.tabs.remove(tabId);
        break;

      case "loop":
        await executeLoop(flow, config, tabId);
        break;

      case "extract":
        await injectAction(
          tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (el) {
            const val = ${config.attribute ? `el.getAttribute(${JSON.stringify(config.attribute)})` : "el.textContent"};
            window[${JSON.stringify(config.outputVar)}] = val;
          }
        `,
        );
        break;

      case "clipboard_copy":
        await injectAction(
          tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (el) { await navigator.clipboard.writeText(el.textContent ?? ''); }
        `,
        );
        break;

      case "clipboard_paste":
        await injectAction(
          tabId,
          `
          const el = __qsDeep(${JSON.stringify(config.selector)});
          if (el) { const text = await navigator.clipboard.readText(); el.value = text; el.dispatchEvent(new Event('input', {bubbles: true})); }
        `,
        );
        break;
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
  tabId: number,
): Promise<void> {
  const checkCode = `${DEEP_QUERY_SNIPPET}; return ${buildConditionCheck(config.check)}`;
  const results = await chrome.scripting.executeScript({
    target: { tabId },
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
      await executeNode(flow, targetNode, tabId);
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
  tabId: number,
): Promise<void> {
  const bodyNodes = config.bodyNodeIds
    .map((id) => flow.nodes.find((n) => n.id === id))
    .filter((n): n is FlowNode => n !== undefined);

  if (config.count !== undefined) {
    for (let i = 0; i < config.count; i++) {
      await walkNodes(flow, bodyNodes, tabId);
    }
  } else if (config.untilSelector) {
    const maxIterations = 1000;
    for (let i = 0; i < maxIterations; i++) {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
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
      await walkNodes(flow, bodyNodes, tabId);
    }
  }
}
