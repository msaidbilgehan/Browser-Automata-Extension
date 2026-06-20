import { localStore } from "@/shared/storage";
import { generateId, now } from "@/shared/utils";
import { DEFAULTS } from "@/shared/constants";
import type { ClipboardEntry, EntityId } from "@/shared/types/entities";

/**
 * Add a clipboard entry to the circular buffer.
 *
 * The total history is capped at `MAX_CLIPBOARD_ENTRIES`. Pinned entries take
 * priority over unpinned ones, but the cap is absolute: if pinned entries alone
 * exceed the limit, the oldest pinned entries are evicted too, so the buffer can
 * never grow without bound.
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

      const max = DEFAULTS.MAX_CLIPBOARD_ENTRIES;

      // Pinned entries are kept first, but bounded by the absolute cap (newest win).
      const cappedPinned = pinned.length > max ? pinned.slice(pinned.length - max) : pinned;

      // Fill any remaining slots with the newest unpinned entries.
      const remaining = max - cappedPinned.length;
      const cappedUnpinned =
        remaining > 0 ? unpinned.slice(Math.max(0, unpinned.length - remaining)) : [];

      return [...cappedPinned, ...cappedUnpinned];
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
