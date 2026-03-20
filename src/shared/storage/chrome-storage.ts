import type { StorageSchema, SyncStorageSchema, LocalStorageKey, SyncStorageKey } from "./keys";

/**
 * Typed wrapper over chrome.storage.local.
 * All reads/writes go through this module for type safety and consistency.
 */
export const localStore = {
  async get<TKey extends LocalStorageKey>(key: TKey): Promise<StorageSchema[TKey] | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as StorageSchema[TKey] | undefined;
  },

  async set<TKey extends LocalStorageKey>(key: TKey, value: StorageSchema[TKey]): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },

  async remove(key: LocalStorageKey): Promise<void> {
    await chrome.storage.local.remove(key);
  },

  /**
   * Update a record-type storage value (e.g. scripts, shortcuts).
   * Loads current value, applies updater, saves back.
   */
  async update<TKey extends LocalStorageKey>(
    key: TKey,
    updater: (current: StorageSchema[TKey]) => StorageSchema[TKey],
    defaultValue: StorageSchema[TKey],
  ): Promise<StorageSchema[TKey]> {
    const current = (await this.get(key)) ?? defaultValue;
    const updated = updater(current);
    await this.set(key, updated);
    return updated;
  },
};

/**
 * Typed wrapper over chrome.storage.sync.
 * Used for small data that syncs across devices (settings).
 */
export const syncStore = {
  async get<TKey extends SyncStorageKey>(key: TKey): Promise<SyncStorageSchema[TKey] | undefined> {
    const result = await chrome.storage.sync.get(key);
    return result[key] as SyncStorageSchema[TKey] | undefined;
  },

  async set<TKey extends SyncStorageKey>(key: TKey, value: SyncStorageSchema[TKey]): Promise<void> {
    await chrome.storage.sync.set({ [key]: value });
  },
};

/** Subscribe to storage changes for a specific key */
export function onStorageChange<TKey extends LocalStorageKey>(
  key: TKey,
  callback: (newValue: StorageSchema[TKey] | undefined) => void,
): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === "local" && key in changes) {
      const change = changes[key];
      callback(change?.newValue as StorageSchema[TKey] | undefined);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

/** Subscribe to sync storage changes */
export function onSyncStorageChange<TKey extends SyncStorageKey>(
  key: TKey,
  callback: (newValue: SyncStorageSchema[TKey] | undefined) => void,
): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === "sync" && key in changes) {
      const change = changes[key];
      callback(change?.newValue as SyncStorageSchema[TKey] | undefined);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
