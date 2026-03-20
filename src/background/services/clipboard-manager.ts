import { localStore } from "@/shared/storage";
import { generateId, now } from "@/shared/utils";
import { DEFAULTS } from "@/shared/constants";
import type { ClipboardEntry, EntityId } from "@/shared/types/entities";

/**
 * Add a clipboard entry to the circular buffer.
 * Non-pinned entries are trimmed when over the max limit.
 */
export async function addClipboardEntry(
  entry: Omit<ClipboardEntry, "id" | "timestamp">,
): Promise<void> {
  await localStore.update(
    "clipboardHistory",
    (history) => {
      const newEntry: ClipboardEntry = {
        ...entry,
        id: generateId(),
        timestamp: now(),
      };

      const updated = [...history, newEntry];
      const pinned = updated.filter((e) => e.pinned);
      const unpinned = updated.filter((e) => !e.pinned);

      // Trim oldest non-pinned entries when over the limit
      const maxUnpinned = DEFAULTS.MAX_CLIPBOARD_ENTRIES - pinned.length;
      const trimmedUnpinned =
        unpinned.length > maxUnpinned ? unpinned.slice(unpinned.length - maxUnpinned) : unpinned;

      return [...pinned, ...trimmedUnpinned];
    },
    [],
  );
}

/**
 * Return the full clipboard history.
 */
export async function getClipboardHistory(): Promise<ClipboardEntry[]> {
  return (await localStore.get("clipboardHistory")) ?? [];
}

/**
 * Clear all non-pinned entries from the clipboard history.
 */
export async function clearClipboardHistory(): Promise<void> {
  await localStore.update("clipboardHistory", (history) => history.filter((e) => e.pinned), []);
}

/**
 * Toggle the pinned state of a clipboard entry.
 */
export async function togglePin(entryId: EntityId): Promise<void> {
  await localStore.update(
    "clipboardHistory",
    (history) => history.map((e) => (e.id === entryId ? { ...e, pinned: !e.pinned } : e)),
    [],
  );
}
