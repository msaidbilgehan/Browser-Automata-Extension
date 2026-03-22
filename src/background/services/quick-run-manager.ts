import { localStore } from "@/shared/storage";
import { matchUrl } from "@/shared/url-pattern/matcher";

/**
 * Push matching QuickRunActions to a tab's content script.
 * Called on CONTENT_READY alongside pushShortcutsToTab.
 */
export async function pushQuickRunActionsToTab(tabId: number, url: string): Promise<void> {
  const actions = (await localStore.get("quickRunActions")) ?? {};
  const matching = Object.values(actions)
    .filter((a) => a.enabled && matchUrl(a.scope, url))
    .sort((a, b) => a.order - b.order);

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "UPDATE_QUICK_RUN_ACTIONS",
      actions: matching,
    });
  } catch (err) {
    console.debug(`[Browser Automata] pushQuickRunActionsToTab(${String(tabId)}) failed:`, err);
  }
}
