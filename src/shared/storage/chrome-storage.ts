import type { StorageSchema, SyncStorageSchema, LocalStorageKey, SyncStorageKey } from "./keys";

/**
 * Raised when a `chrome.storage` write fails — typically a quota overflow
 * (`QUOTA_BYTES` on local; the smaller per-item/total quotas on sync) or the
 * sync write-rate limit (`MAX_WRITE_OPERATIONS_PER_*`). Translating the opaque
 * runtime rejection into a typed error lets callers surface an actionable
 * `{ ok: false, error }` instead of an unhandled rejection.
 */
export class StorageQuotaError extends Error {
  readonly area: "local" | "sync";
  readonly key: string;

  constructor(area: "local" | "sync", key: string, options?: { cause?: unknown }) {
    const detail = options?.cause instanceof Error ? `: ${options.cause.message}` : "";
    super(
      `Failed to write "${key}" to chrome.storage.${area} (quota or write-rate limit)${detail}`,
      options,
    );
    this.name = "StorageQuotaError";
    this.area = area;
    this.key = key;
  }
}

/**
 * Per-key write serialization for `localStore.update`.
 *
 * `chrome.runtime.onMessage` dispatches handlers concurrently, so two `update`
 * calls on the same key would otherwise both read the same snapshot at
 * `await get`, both apply their updater, and the second `set` would clobber the
 * first (a lost update). Chaining each update off the previous promise for the
 * same key serializes the read-modify-write. The service worker is a single
 * instance, so an in-memory chain is the correct serialization scope.
 *
 * The map holds at most one entry per `LocalStorageKey` (a small, fixed set),
 * so it cannot grow unbounded.
 */
const updateLocks = new Map<LocalStorageKey, Promise<unknown>>();

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
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (err) {
      throw new StorageQuotaError("local", key, { cause: err });
    }
  },

  async remove(key: LocalStorageKey): Promise<void> {
    await chrome.storage.local.remove(key);
  },

  /**
   * Update a record-type storage value (e.g. scripts, shortcuts).
   * Loads current value, applies updater, saves back.
   *
   * Read-modify-write is serialized per key against concurrent `update` calls
   * (see {@link updateLocks}), so interleaved updates to the same key no longer
   * lose writes.
   */
  async update<TKey extends LocalStorageKey>(
    key: TKey,
    updater: (current: StorageSchema[TKey]) => StorageSchema[TKey],
    defaultValue: StorageSchema[TKey],
  ): Promise<StorageSchema[TKey]> {
    const run = (updateLocks.get(key) ?? Promise.resolve()).then(async () => {
      const current = (await this.get(key)) ?? defaultValue;
      const updated = updater(current);
      await this.set(key, updated);
      return updated;
    });
    // Keep the chain alive even if this update rejects, so one failed update
    // does not wedge every subsequent update to the same key.
    updateLocks.set(
      key,
      run.catch(() => undefined),
    );
    return run;
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
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (err) {
      throw new StorageQuotaError("sync", key, { cause: err });
    }
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
