import { localStore } from "@/shared/storage";
import { matchUrlWithScopeMode } from "@/shared/url-pattern/matcher";
import { resolveTargetScopes } from "./scope-resolver";

/**
 * Push QuickRunActions to a tab's content script.
 *
 * Sends ALL enabled actions (sorted by order) together with the IDs of those
 * whose scope matches the current page URL.  The content script uses this to:
 *   - auto-show the bar when at least one action matches
 *   - display only matching actions by default
 *   - display all actions when the user force-toggles via shortcut
 */
export async function pushQuickRunActionsToTab(tabId: number, url: string): Promise<void> {
  const actions = (await localStore.get("quickRunActions")) ?? {};
  const allEnabled = Object.values(actions)
    .filter((a) => a.enabled)
    .sort((a, b) => a.order - b.order);

  const targetScopes = await resolveTargetScopes(allEnabled);

  const matchingIds = allEnabled
    .filter((a) => matchUrlWithScopeMode(a.scope, targetScopes.get(a.id) ?? null, a.scopeMode, url))
    .map((a) => a.id);

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "UPDATE_QUICK_RUN_ACTIONS",
      actions: allEnabled,
      matchingIds,
    });
  } catch {
    // Content script may not be ready yet — expected for non-http or still-loading tabs
  }
}
