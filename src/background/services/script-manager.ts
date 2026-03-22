import { localStore, syncStore } from "@/shared/storage";
import { matchUrl } from "@/shared/url-pattern/matcher";
import { sortBySpecificity } from "@/shared/url-pattern/specificity";
import { appendLogEntry } from "@/background/handlers/log-handler";
import type { Script, EntityId } from "@/shared/types/entities";
import type { ScriptRunResult } from "@/shared/types/script-run";

/**
 * Get all scripts matching a URL, sorted by specificity then priority.
 */
export async function getMatchingScripts(
  url: string,
  trigger: Script["trigger"],
): Promise<Script[]> {
  // Parallel reads: settings and scripts are independent
  const [settings, scriptsRecord] = await Promise.all([
    syncStore.get("settings"),
    localStore.get("scripts"),
  ]);
  if (!settings?.globalEnabled) return [];

  const scripts = scriptsRecord ?? {};
  const matching = Object.values(scripts).filter(
    (s) => s.enabled && s.trigger === trigger && matchUrl(s.scope, url),
  );

  return sortBySpecificity(matching).sort((a, b) => a.priority - b.priority);
}

/**
 * Execute a script on a specific tab via chrome.scripting.executeScript.
 * This is the MV3-legal pattern: inject a wrapper function that executes user code.
 * Returns full execution details including console output and return value.
 */
export async function executeScript(
  tabId: number,
  script: Script,
): Promise<ScriptRunResult> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: script.executionWorld,
      func: executeUserCode,
      args: [script.code],
    });

    const raw = results[0]?.result as ExecuteUserCodeResult | undefined;
    const consoleLogs = raw?.consoleLogs ?? [];
    const durationMs = raw?.durationMs ?? 0;

    if (raw?.error) {
      const logError: { name: string; message: string; stack?: string } = {
        name: "ExecutionError",
        message: raw.error,
      };
      if (raw.stack) logError.stack = raw.stack;

      await appendLogEntry({
        action: "script_error",
        status: "error",
        entityId: script.id,
        entityType: "script",
        message: `Script "${script.name}" failed`,
        error: logError,
        ...(consoleLogs.length > 0 ? { details: { consoleLogs } } : {}),
      });

      const result: ScriptRunResult = { ok: false, error: raw.error, consoleLogs, durationMs };
      if (raw.stack) result.stack = raw.stack;
      return result;
    }

    const returnValue = raw?.result;
    const details: Record<string, unknown> = { durationMs };
    if (consoleLogs.length > 0) details["consoleLogs"] = consoleLogs;
    if (returnValue !== undefined) details["returnValue"] = returnValue;

    await appendLogEntry({
      action: "script_executed",
      status: "success",
      entityId: script.id,
      entityType: "script",
      message: `Script "${script.name}" executed`,
      details,
    });

    const result: ScriptRunResult = { ok: true, consoleLogs, durationMs };
    if (returnValue !== undefined) result.returnValue = returnValue;
    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    const logError: { name: string; message: string; stack?: string } = {
      name: "InjectionError",
      message: errorMessage,
    };
    if (errorStack) logError.stack = errorStack;

    await appendLogEntry({
      action: "script_error",
      status: "error",
      entityId: script.id,
      entityType: "script",
      message: `Script "${script.name}" injection failed`,
      error: logError,
    });

    const result: ScriptRunResult = { ok: false, error: errorMessage, consoleLogs: [], durationMs: 0 };
    if (errorStack) result.stack = errorStack;
    return result;
  }
}

/**
 * Execute a script by ID on the active tab.
 * Returns full execution details including console output and return value.
 */
export async function runScriptNow(scriptId: EntityId): Promise<ScriptRunResult> {
  const scripts = (await localStore.get("scripts")) ?? {};
  const script = scripts[scriptId];
  if (!script) {
    return { ok: false, error: "Script not found", consoleLogs: [], durationMs: 0 };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "No active tab", consoleLogs: [], durationMs: 0 };
  }

  return executeScript(tab.id, script);
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

/** A single captured console entry — already serialized for safe structured cloning. */
interface ConsoleCaptureEntry {
  level: "log" | "info" | "warn" | "error";
  text: string;
  timestamp: number;
}

/** Full result returned by the injected wrapper. */
interface ExecuteUserCodeResult {
  result?: string;
  error?: string;
  stack?: string;
  consoleLogs: ConsoleCaptureEntry[];
  durationMs: number;
}

/**
 * The function injected into the page via chrome.scripting.executeScript.
 * Wraps user code in try/catch, captures console output, and returns
 * the return value + captured logs + execution duration.
 *
 * IMPORTANT: This function runs inside the page context and its return value
 * crosses the page→service worker boundary via structured cloning.
 * All values must be serialized to primitives (strings/numbers) here —
 * DOM nodes, functions, and circular refs would break the cloning.
 *
 * Executes via new Function() — MV3-legal inside executeScript's func.
 */
function executeUserCode(code: string): ExecuteUserCodeResult {
  const consoleLogs: ConsoleCaptureEntry[] = [];

  /** Safely stringify any value — must be self-contained (no external imports). */
  function serialize(value: unknown): string {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return value;
    if (typeof value === "function") {
      return `[Function: ${(value as { name?: string }).name || "anonymous"}]`;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  // Intercept console methods during execution
  const origLog = console.log;
  const origInfo = console.info;
  const origWarn = console.warn;
  const origError = console.error;

  const capture = (level: ConsoleCaptureEntry["level"]) =>
    (...args: unknown[]) => {
      // Serialize args immediately so only plain strings cross the boundary
      consoleLogs.push({ level, text: args.map(serialize).join(" "), timestamp: Date.now() });
      // Still forward to the real console
      const originals = { log: origLog, info: origInfo, warn: origWarn, error: origError };
      originals[level].apply(console, args);
    };

  console.log = capture("log");
  console.info = capture("info");
  console.warn = capture("warn");
  console.error = capture("error");

  const start = performance.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn: () => unknown = new Function(code) as () => unknown;
    const rawResult: unknown = fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    return { result: serialize(rawResult), consoleLogs, durationMs };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const result: ExecuteUserCodeResult = {
      error: err instanceof Error ? err.message : String(err),
      consoleLogs,
      durationMs,
    };
    if (err instanceof Error && err.stack) result.stack = err.stack;
    return result;
  } finally {
    // Restore original console methods
    console.log = origLog;
    console.info = origInfo;
    console.warn = origWarn;
    console.error = origError;
  }
}
