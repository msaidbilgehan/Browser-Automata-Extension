import { localStore, syncStore } from "@/shared/storage";
import { matchUrl } from "@/shared/url-pattern/matcher";
import type { Shortcut, EntityId } from "@/shared/types/entities";
import { appendLogEntry } from "@/background/handlers/log-handler";
import { executeScript } from "./script-manager";

/**
 * Get all active shortcuts matching a URL.
 */
export async function getMatchingShortcuts(url: string): Promise<Shortcut[]> {
  const settings = await syncStore.get("settings");
  if (!settings?.globalEnabled) return [];

  const shortcuts = (await localStore.get("shortcuts")) ?? {};
  return Object.values(shortcuts).filter((s) => s.enabled && matchUrl(s.scope, url));
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
    console.debug(`[Browser Automata] pushShortcutsToTab(${tabId}) failed:`, err);
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
      const scripts = (await localStore.get("scripts")) ?? {};
      const script = scripts[shortcut.action.scriptId];
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
    // click and focus are handled directly in the content script
    case "click":
    case "focus":
    case "flow":
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
