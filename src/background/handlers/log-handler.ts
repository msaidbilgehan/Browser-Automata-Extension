import { localStore } from "@/shared/storage";
import { DEFAULTS } from "@/shared/constants";
import { now } from "@/shared/utils";
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

// ─── Batched appends ─────────────────────────────────────────────────────────

/**
 * The whole log lives under one storage key, so every append is a
 * read-modify-write of the entire array — ~1.8 MB of (de)serialization plus a
 * chrome.storage round trip once the 5000-entry cap is reached. One write per
 * entry made logging the dominant cost of any burst: a flow run paid it between
 * every node, adding ~200 ms per node to the path between the user's keypress
 * and the click it triggers.
 *
 * Entries are therefore queued and flushed together. `timestamp` is stamped on
 * enqueue, so deferring the write cannot skew when an event is recorded as
 * having happened, and the queue preserves call order regardless of whether
 * callers await.
 */
type QueuedLogEntry = Omit<ActivityLogEntry, "seq">;

const pendingEntries: QueuedLogEntry[] = [];

/** In-flight (or scheduled) flush, shared by every caller queued behind it. */
let scheduledFlush: Promise<void> | null = null;

/**
 * How long to hold entries before writing. Long enough to coalesce a burst
 * (a flow node logs its own entry plus, on failure, the run's), short enough
 * that the popup's log view still reads as live.
 */
const FLUSH_DELAY_MS = 100;

/**
 * Write the queued batch.
 *
 * Never rejects: the activity log is best-effort telemetry, and every caller is
 * on some user-facing path (a flow node, a shortcut, a script run). A failed log
 * write must not fail the action that produced it, and — since callers may drop
 * the returned promise — must not surface as an unhandled rejection either. A
 * dropped batch is reported on the service worker console instead.
 */
function scheduleFlush(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      scheduledFlush = null;
      const batch = pendingEntries.splice(0, pendingEntries.length);
      if (batch.length === 0) {
        resolve();
        return;
      }
      localStore
        .update(
          "log",
          (log) => {
            let seq = log.length > 0 ? (log[log.length - 1]?.seq ?? 0) : 0;
            const updated = [...log];
            for (const entry of batch) {
              seq += 1;
              updated.push({ ...entry, seq });
            }
            // Enforce circular buffer cap
            if (updated.length > DEFAULTS.MAX_LOG_ENTRIES) {
              return updated.slice(updated.length - DEFAULTS.MAX_LOG_ENTRIES);
            }
            return updated;
          },
          [],
        )
        .then(
          () => {
            resolve();
          },
          (err: unknown) => {
            console.warn(
              `[Browser Automata] Dropped ${String(batch.length)} activity log entr${batch.length === 1 ? "y" : "ies"}:`,
              err,
            );
            resolve();
          },
        );
    }, FLUSH_DELAY_MS);
  });
}

/**
 * Queue an entry for the activity log (used internally by the service worker).
 *
 * The returned promise settles — never rejects — once the entry is persisted or
 * dropped; callers on a latency-sensitive path can ignore it and call
 * {@link flushLogEntries} at a natural boundary instead.
 */
export function appendLogEntry(entry: Omit<ActivityLogEntry, "seq" | "timestamp">): Promise<void> {
  pendingEntries.push({ ...entry, timestamp: now() });
  scheduledFlush ??= scheduleFlush();
  return scheduledFlush;
}

/**
 * Persist every queued entry.
 *
 * Call this before a task that logged without awaiting finishes, so nothing is
 * left in memory for a service-worker shutdown to drop.
 */
export async function flushLogEntries(): Promise<void> {
  while (scheduledFlush !== null || pendingEntries.length > 0) {
    // A flush may itself be followed by entries queued while it was in flight.
    await (scheduledFlush ?? (scheduledFlush = scheduleFlush()));
  }
}
