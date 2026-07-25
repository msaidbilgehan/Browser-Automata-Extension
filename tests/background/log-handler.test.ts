import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleGetLog,
  handleClearLog,
  appendLogEntry,
  flushLogEntries,
} from "@/background/handlers/log-handler";
import { DEFAULTS } from "@/shared/constants";
import type { ActivityLogEntry } from "@/shared/types/activity-log";
import { mockFn } from "../helpers";

describe("handleGetLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all log entries when no filters", async () => {
    const entries = [
      { seq: 1, action: "system", status: "info", message: "test" },
      { seq: 2, action: "script_executed", status: "success", message: "ran script" },
    ];
    mockFn(chrome.storage.local.get).mockResolvedValue({ log: entries });

    const result = await handleGetLog();
    expect(result.entries).toHaveLength(2);
  });

  it("filters entries by domain", async () => {
    const entries = [
      { seq: 1, action: "system", status: "info", message: "a", domain: "github.com" },
      { seq: 2, action: "system", status: "info", message: "b", domain: "google.com" },
    ];
    mockFn(chrome.storage.local.get).mockResolvedValue({ log: entries });

    const result = await handleGetLog({ domain: "github.com" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.domain).toBe("github.com");
  });

  it("filters entries by status", async () => {
    const entries = [
      { seq: 1, action: "system", status: "success", message: "ok" },
      { seq: 2, action: "system", status: "error", message: "fail" },
    ];
    mockFn(chrome.storage.local.get).mockResolvedValue({ log: entries });

    const result = await handleGetLog({ status: "error" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.status).toBe("error");
  });

  it("returns empty array when no log exists", async () => {
    mockFn(chrome.storage.local.get).mockResolvedValue({});

    const result = await handleGetLog();
    expect(result.entries).toEqual([]);
  });
});

describe("handleClearLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets log to empty array", async () => {
    const result = await handleClearLog();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ log: [] });
    expect(result).toEqual({ ok: true });
  });
});

describe("appendLogEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends entry with auto-incremented seq", async () => {
    const existingLog = [
      {
        seq: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        action: "system",
        status: "info",
        message: "first",
      },
    ];
    mockFn(chrome.storage.local.get).mockResolvedValue({ log: existingLog });

    await appendLogEntry({
      action: "script_executed",
      status: "success",
      message: "ran script",
    });

    const setCall = vi.mocked(chrome.storage.local.set).mock.calls[0];
    const savedLog = (setCall?.[0] as Record<string, unknown>)["log"] as Array<{ seq: number }>;
    expect(savedLog).toHaveLength(2);
    expect(savedLog[1]?.seq).toBe(2);
  });

  it("starts at seq 1 when log is empty", async () => {
    mockFn(chrome.storage.local.get).mockResolvedValue({ log: [] });

    await appendLogEntry({
      action: "system",
      status: "info",
      message: "init",
    });

    const setCall = vi.mocked(chrome.storage.local.set).mock.calls[0];
    const savedLog = (setCall?.[0] as Record<string, unknown>)["log"] as Array<{ seq: number }>;
    expect(savedLog[0]?.seq).toBe(1);
  });
});

/**
 * The whole log lives under one storage key, so each append rewrites the entire
 * array (~1.8 MB once the 5000-entry cap is reached). One write per entry made
 * logging the dominant cost of any burst — the flow executor paid it between
 * every node — so entries are queued and written together.
 */
describe("appendLogEntry — batching", () => {
  let store: Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    store = { log: [] };
    mockFn(chrome.storage.local.get).mockImplementation(async (key: string) =>
      key in store ? { [key]: store[key] } : {},
    );
    mockFn(chrome.storage.local.set).mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    });
    // Drain anything a previous test left queued so write counts are per-test.
    await flushLogEntries();
    vi.clearAllMocks();
  });

  const saved = (): ActivityLogEntry[] => store["log"] as ActivityLogEntry[];

  it("coalesces entries queued together into a single storage write", async () => {
    void appendLogEntry({ action: "system", status: "info", message: "a" });
    void appendLogEntry({ action: "system", status: "info", message: "b" });
    await appendLogEntry({ action: "system", status: "info", message: "c" });

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    expect(saved().map((e) => e.message)).toEqual(["a", "b", "c"]);
  });

  it("assigns gapless, call-ordered seq numbers across a batch", async () => {
    store["log"] = [{ seq: 41, timestamp: "2026-01-01T00:00:00.000Z" } as ActivityLogEntry];

    void appendLogEntry({ action: "system", status: "info", message: "first" });
    await appendLogEntry({ action: "system", status: "info", message: "second" });

    expect(saved().map((e) => e.seq)).toEqual([41, 42, 43]);
    expect(saved().map((e) => e.message)).toEqual([undefined, "first", "second"]);
  });

  it("stamps the timestamp when the entry is queued, not when it is written", async () => {
    const queuedAt = Date.now();
    const pending = appendLogEntry({ action: "system", status: "info", message: "queued" });
    // The write is deferred; the recorded time must still be the queue time.
    await pending;

    const written = Date.parse(saved()[0]?.timestamp ?? "");
    expect(written).toBeGreaterThanOrEqual(queuedAt);
    expect(written).toBeLessThanOrEqual(queuedAt + 100);
  });

  it("enforces the circular-buffer cap when a batch overflows it", async () => {
    store["log"] = Array.from({ length: DEFAULTS.MAX_LOG_ENTRIES }, (_, i) => ({
      seq: i + 1,
      timestamp: "2026-01-01T00:00:00.000Z",
      action: "system",
      status: "info",
      message: `old-${String(i)}`,
    })) as ActivityLogEntry[];

    void appendLogEntry({ action: "system", status: "info", message: "new-1" });
    await appendLogEntry({ action: "system", status: "info", message: "new-2" });

    expect(saved()).toHaveLength(DEFAULTS.MAX_LOG_ENTRIES);
    expect(saved().at(-1)?.message).toBe("new-2");
    expect(saved().at(-2)?.message).toBe("new-1");
    expect(saved()[0]?.message).toBe("old-2");
  });

  it("flushLogEntries persists entries queued without awaiting", async () => {
    void appendLogEntry({ action: "system", status: "info", message: "fire-and-forget" });

    await flushLogEntries();

    expect(saved().map((e) => e.message)).toEqual(["fire-and-forget"]);
  });

  it("flushLogEntries drains entries queued while a flush was in flight", async () => {
    void appendLogEntry({ action: "system", status: "info", message: "batch-1" });
    const inFlight = flushLogEntries();
    void appendLogEntry({ action: "system", status: "info", message: "batch-2" });

    await inFlight;

    expect(saved().map((e) => e.message)).toEqual(["batch-1", "batch-2"]);
  });
});
