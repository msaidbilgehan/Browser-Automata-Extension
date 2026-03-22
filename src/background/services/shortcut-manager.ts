import { localStore, syncStore } from "@/shared/storage";
import { matchUrlWithScopeMode } from "@/shared/url-pattern/matcher";
import { resolveTargetScopes } from "./scope-resolver";
import type { Shortcut, EntityId } from "@/shared/types/entities";
import { DEFAULT_SETTINGS } from "@/shared/types/settings";
import { appendLogEntry } from "@/background/handlers/log-handler";
import { executeScript } from "./script-manager";
import { runExtraction, processOutputActions } from "./extraction-engine";
import { executeFlow } from "./flow-executor";

/**
 * Get all active shortcuts matching a URL.
 */
export async function getMatchingShortcuts(url: string): Promise<Shortcut[]> {
  // Parallel reads: settings and shortcuts are independent
  const [settings, shortcutsRecord] = await Promise.all([
    syncStore.get("settings"),
    localStore.get("shortcuts"),
  ]);
  if (!settings?.globalEnabled) return [];

  const shortcuts = shortcutsRecord ?? {};
  const allEnabled = Object.values(shortcuts).filter((s) => s.enabled);

  const targetScopes = await resolveTargetScopes(
    allEnabled.map((s) => ({ id: s.id, scopeMode: s.scopeMode, target: s.action })),
  );

  return allEnabled.filter((s) =>
    matchUrlWithScopeMode(s.scope, targetScopes.get(s.id) ?? null, s.scopeMode, url),
  );
}

/**
 * Send active shortcuts to a content script tab for key listening.
 */
export async function pushShortcutsToTab(tabId: number, url: string): Promise<void> {
  const shortcuts = await getMatchingShortcuts(url);

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "UPDATE_SHORTCUTS",
      shortcuts,
    });
  } catch (err) {
    // Tab may not have content script ready yet — expected for non-http tabs
    // or tabs still loading. Log at debug level for troubleshooting.
    console.debug(`[Browser Automata] pushShortcutsToTab(${String(tabId)}) failed:`, err);
  }
}

/**
 * Push matching shortcuts to a tab as a Quick Tip overlay.
 * Only sends if the quickTip feature is enabled in settings.
 * Accepts pre-fetched shortcuts to avoid redundant storage reads when
 * called alongside pushShortcutsToTab.
 */
export async function pushQuickTipToTab(
  tabId: number,
  url: string,
  prefetchedShortcuts?: Shortcut[],
): Promise<void> {
  const stored = await syncStore.get("settings");
  const quickTip = { ...DEFAULT_SETTINGS.quickTip, ...stored?.quickTip };
  if (!quickTip.enabled) return;

  const shortcuts = prefetchedShortcuts ?? await getMatchingShortcuts(url);
  if (shortcuts.length === 0) return;

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "UPDATE_QUICK_TIP_SHORTCUTS",
      shortcuts,
    });
  } catch (err) {
    console.debug(`[Browser Automata] pushQuickTipToTab(${String(tabId)}) failed:`, err);
  }
}

/**
 * Handle a shortcut being fired from the content script.
 * Executes the shortcut's action on the service worker side.
 */
export async function handleShortcutExecution(
  shortcutId: EntityId,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  const shortcuts = (await localStore.get("shortcuts")) ?? {};
  const shortcut = shortcuts[shortcutId];
  if (!shortcut) return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  await appendLogEntry({
    action: "shortcut_triggered",
    status: "info",
    entityId: shortcut.id,
    entityType: "shortcut",
    ...(sender.tab?.url ? { url: sender.tab.url, domain: extractDomain(sender.tab.url) } : {}),
    message: `Shortcut "${shortcut.name}" triggered`,
  });

  switch (shortcut.action.type) {
    case "script": {
      const allScripts = (await localStore.get("scripts")) ?? {};
      const script = allScripts[shortcut.action.scriptId];
      if (script) {
        await executeScript(tabId, script);
      }
      break;
    }
    case "inline_script": {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          world: "ISOLATED",
          func: (code: string) => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-implied-eval
              const fn: () => unknown = new Function(code) as () => unknown;
              fn();
            } catch (e) {
              console.error("[Browser Automata] Inline script error:", e);
            }
          },
          args: [shortcut.action.code],
        });
      } catch (err) {
        console.error("[Browser Automata] Failed to execute inline script:", err);
      }
      break;
    }
    case "navigate": {
      await chrome.tabs.update(tabId, { url: shortcut.action.url });
      break;
    }
    case "extraction": {
      const result = await runExtraction(shortcut.action.extractionRuleId, tabId);
      if (result.ok && result.formatted) {
        const extractionRules = (await localStore.get("extractionRules")) ?? {};
        const rule = extractionRules[shortcut.action.extractionRuleId];
        if (rule) {
          await processOutputActions(tabId, rule, result.formatted, result.data ?? []);
        }
      }
      break;
    }
    case "flow": {
      void executeFlow(shortcut.action.flowId, tabId);
      break;
    }
    // click and focus are handled directly in the content script
    case "click":
    case "focus":
      break;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}
