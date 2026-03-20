import { localStore } from "@/shared/storage";
import type { Shortcut, EntityId } from "@/shared/types/entities";
import { pushShortcutsToTab } from "../services/shortcut-manager";

/**
 * Push updated shortcuts to all open tabs so changes take effect immediately
 * without requiring a page refresh.
 */
async function broadcastShortcutsToAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null && tab.url) {
      void pushShortcutsToTab(tab.id, tab.url);
    }
  }
}

/** Handle SHORTCUT_SAVE: create or update a shortcut */
export async function handleShortcutSave(shortcut: Shortcut): Promise<{ ok: boolean }> {
  await localStore.update(
    "shortcuts",
    (shortcuts) => ({ ...shortcuts, [shortcut.id]: shortcut }),
    {},
  );
  void broadcastShortcutsToAllTabs();
  return { ok: true };
}

/** Handle SHORTCUT_DELETE: remove a shortcut by ID */
export async function handleShortcutDelete(shortcutId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "shortcuts",
    (shortcuts) => {
      const next = { ...shortcuts };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete next[shortcutId];
      return next;
    },
    {},
  );
  void broadcastShortcutsToAllTabs();
  return { ok: true };
}

/** Handle SHORTCUT_TOGGLE: enable/disable a shortcut */
export async function handleShortcutToggle(
  shortcutId: EntityId,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  await localStore.update(
    "shortcuts",
    (shortcuts) => {
      const shortcut = shortcuts[shortcutId];
      if (!shortcut) return shortcuts;
      return { ...shortcuts, [shortcutId]: { ...shortcut, enabled } };
    },
    {},
  );
  void broadcastShortcutsToAllTabs();
  return { ok: true };
}
