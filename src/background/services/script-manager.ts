import { localStore, syncStore } from "@/shared/storage";
import { matchUrl } from "@/shared/url-pattern/matcher";
import { sortBySpecificity } from "@/shared/url-pattern/specificity";
import { appendLogEntry } from "@/background/handlers/log-handler";
import type { Script, EntityId } from "@/shared/types/entities";

/**
 * Get all scripts matching a URL, sorted by specificity then priority.
 */
export async function getMatchingScripts(
  url: string,
  trigger: Script["trigger"],
): Promise<Script[]> {
  const settings = await syncStore.get("settings");
  if (!settings?.globalEnabled) return [];

  const scripts = (await localStore.get("scripts")) ?? {};
  const matching = Object.values(scripts).filter(
    (s) => s.enabled && s.trigger === trigger && matchUrl(s.scope, url),
  );

  return sortBySpecificity(matching).sort((a, b) => a.priority - b.priority);
}

/**
 * Execute a script on a specific tab via chrome.scripting.executeScript.
 * This is the MV3-legal pattern: inject a wrapper function that executes user code.
 */
export async function executeScript(
  tabId: number,
  script: Script,
): Promise<{ success: boolean; error?: string }> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: script.executionWorld,
      func: executeUserCode,
      args: [script.code],
    });

    const result = results[0];
    if (result?.result && typeof result.result === "object" && "error" in result.result) {
      const error = (result.result as { error: string }).error;
      await appendLogEntry({
        action: "script_error",
        status: "error",
        entityId: script.id,
        entityType: "script",
        message: `Script "${script.name}" failed`,
        error: { name: "ExecutionError", message: error },
      });
      return { success: false, error };
    }

    await appendLogEntry({
      action: "script_executed",
      status: "success",
      entityId: script.id,
      entityType: "script",
      message: `Script "${script.name}" executed`,
    });

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await appendLogEntry({
      action: "script_error",
      status: "error",
      entityId: script.id,
      entityType: "script",
      message: `Script "${script.name}" injection failed`,
      error: { name: "InjectionError", message: errorMessage },
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Execute a script by ID on the active tab.
 */
export async function runScriptNow(scriptId: EntityId): Promise<{ ok: boolean; error?: string }> {
  const scripts = (await localStore.get("scripts")) ?? {};
  const script = scripts[scriptId];
  if (!script) {
    return { ok: false, error: "Script not found" };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "No active tab" };
  }

  const result = await executeScript(tab.id, script);
  if (result.error) {
    return { ok: result.success, error: result.error };
  }
  return { ok: result.success };
}

/**
 * Inject and run all page_load scripts for a given tab URL.
 */
export async function injectPageLoadScripts(tabId: number, url: string): Promise<void> {
  const scripts = await getMatchingScripts(url, "page_load");
  for (const script of scripts) {
    await executeScript(tabId, script);
  }
}

/**
 * The function injected into the page via chrome.scripting.executeScript.
 * Wraps user code in try/catch and returns result.
 * Executes via new Function() — MV3-legal inside executeScript's func.
 */
function executeUserCode(code: string): { result?: unknown; error?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn: () => unknown = new Function(code) as () => unknown;
    const result: unknown = fn();
    return { result };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
