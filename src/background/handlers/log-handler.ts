import { localStore } from "@/shared/storage";
import { DEFAULTS } from "@/shared/constants";
import type { ActivityLogEntry, LogAction, LogStatus } from "@/shared/types/activity-log";
import type { LogResponse } from "@/shared/types/messages";

/** Handle GET_LOG: return filtered log entries */
export async function handleGetLog(filters?: {
  domain?: string;
  action?: LogAction;
  status?: LogStatus;
}): Promise<LogResponse> {
  const log = (await localStore.get("log")) ?? [];

  if (!filters) {
    return { entries: log };
  }

  const filtered = log.filter((entry) => {
    if (filters.domain && entry.domain !== filters.domain) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.status && entry.status !== filters.status) return false;
    return true;
  });

  return { entries: filtered };
}

/** Handle CLEAR_LOG: empty the activity log */
export async function handleClearLog(): Promise<{ ok: boolean }> {
  await localStore.set("log", []);
  return { ok: true };
}

/** Append a new entry to the activity log (used internally by service worker) */
export async function appendLogEntry(
  entry: Omit<ActivityLogEntry, "seq" | "timestamp">,
): Promise<void> {
  await localStore.update(
    "log",
    (log) => {
      const seq = log.length > 0 ? (log[log.length - 1]?.seq ?? 0) + 1 : 1;
      const newEntry: ActivityLogEntry = {
        ...entry,
        seq,
        timestamp: new Date().toISOString() as ActivityLogEntry["timestamp"],
      };
      const updated = [...log, newEntry];
      // Enforce circular buffer cap
      if (updated.length > DEFAULTS.MAX_LOG_ENTRIES) {
        return updated.slice(updated.length - DEFAULTS.MAX_LOG_ENTRIES);
      }
      return updated;
    },
    [],
  );
}
