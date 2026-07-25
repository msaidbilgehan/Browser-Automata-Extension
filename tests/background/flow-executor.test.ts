import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeFlow } from "@/background/services/flow-executor";
import type { Flow, EntityId } from "@/shared/types/entities";
import type { ActivityLogEntry } from "@/shared/types/activity-log";
import { mockFn } from "../helpers";

/**
 * Regression: the flow `click` node injected `__qsDeep(sel)?.click()` and
 * discarded the result, so a selector that matched nothing silently no-op'd yet
 * the node was still marked "success" — the engine reported a click that never
 * happened. The node now returns whether an element was found and fails loudly
 * (logged `flow_error` + on-page toast) when it was not.
 *
 * Injected code reports outcomes through a `{ ok, value | error }` envelope
 * because `chrome.scripting.executeScript` cannot transport a rejected promise
 * (see `runInPage`), so these mocks return that envelope shape.
 */

/** Envelope a successful injected-code return value, as the page would. */
function pageOk(value: unknown): [{ result: { ok: true; value: unknown } }] {
  return [{ result: { ok: true, value } }];
}

/** Envelope an error raised inside injected code, as the page would. */
function pageErr(error: string): [{ result: { ok: false; error: string } }] {
  return [{ result: { ok: false, error } }];
}

function clickFlow(selector: string): Flow {
  return {
    id: "flow-1" as EntityId,
    name: "Click Flow",
    description: "",
    scope: { type: "global", value: "" },
    enabled: true,
    profileId: null,
    nodes: [
      {
        id: "node-1" as EntityId,
        type: "action",
        config: { type: "click", selector },
      },
    ],
    meta: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  } as Flow;
}

/** A flow whose only node waits for `selector`, then clicks it. */
function waitThenClickFlow(selector: string, timeoutMs: number): Flow {
  return {
    id: "flow-1" as EntityId,
    name: "Wait Flow",
    description: "",
    scope: { type: "global", value: "" },
    enabled: true,
    profileId: null,
    nodes: [
      {
        id: "node-1" as EntityId,
        type: "action",
        config: { type: "wait_element", selector, timeoutMs },
      },
      {
        id: "node-2" as EntityId,
        type: "action",
        config: { type: "click", selector },
      },
    ],
    meta: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  } as Flow;
}

describe("executeFlow — click node element resolution", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = { flows: { "flow-1": clickFlow(".next-button") }, log: [] };

    mockFn(chrome.storage.local.get).mockImplementation(async (key: string) =>
      key in store ? { [key]: store[key] } : {},
    );
    mockFn(chrome.storage.local.set).mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    });
    mockFn(chrome.storage.session.set).mockResolvedValue(undefined);
    mockFn(chrome.tabs.sendMessage).mockResolvedValue(undefined);
  });

  it("fails the flow and logs an error when the click selector matches nothing", async () => {
    // Page reports the element was not found → injected code resolves to `false`.
    mockFn(chrome.scripting.executeScript).mockResolvedValue(pageOk(false));

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no element matched/i);

    const log = store["log"] as ActivityLogEntry[];
    expect(log.some((e) => e.action === "flow_error" && e.status === "error")).toBe(true);
  });

  it("surfaces the failure on the page via an error toast", async () => {
    mockFn(chrome.scripting.executeScript).mockResolvedValue(pageOk(false));

    await executeFlow("flow-1" as EntityId, 42);

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ type: "SHOW_TOAST", level: "error" }),
    );
  });

  it("succeeds when the click selector matches an element", async () => {
    // Page reports a successful click → injected code resolves to `true`.
    mockFn(chrome.scripting.executeScript).mockResolvedValue(pageOk(true));

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(true);

    const log = store["log"] as ActivityLogEntry[];
    expect(log.some((e) => e.action === "flow_error")).toBe(false);
    expect(log.some((e) => e.action === "flow_executed" && e.status === "success")).toBe(true);
  });

  /**
   * Bookkeeping used to gate every step: an awaited log append (a
   * read-modify-write of the whole ~1.8 MB log array) plus two awaited session
   * writes per node. That delay sits between the user's keypress and the click
   * it triggers, and pushed activation-gated calls like `requestFullscreen()`
   * outside the browser's ~5s transient-activation window.
   */
  it("runs the first node before waiting on any log persistence", async () => {
    const order: string[] = [];
    mockFn(chrome.storage.local.set).mockImplementation(async (items: Record<string, unknown>) => {
      if ("log" in items) order.push("log-write");
      Object.assign(store, items);
    });
    mockFn(chrome.scripting.executeScript).mockImplementation(async () => {
      order.push("inject");
      return pageOk(true);
    });

    await executeFlow("flow-1" as EntityId, 1);

    expect(order[0]).toBe("inject");
    // The entries still land — just not on the critical path.
    expect(order).toContain("log-write");
  });

  it("reports an error raised inside the page instead of flattening it to a missing target", async () => {
    // e.g. an invalid selector: __qsDeep throws, the page catches and reports it.
    mockFn(chrome.scripting.executeScript).mockResolvedValue(
      pageErr("Failed to execute 'querySelector': '((' is not a valid selector."),
    );

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not a valid selector/i);
    expect(result.error).not.toMatch(/no element matched/i);
  });

  it("fails when the injection returns no envelope (tab navigated away mid-run)", async () => {
    mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: undefined }]);

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no result/i);
  });
});

/**
 * Regression: `wait_element` rejected inside injected code on timeout, but a
 * rejection cannot cross `chrome.scripting.executeScript` (the InjectionResult
 * has no error channel — the reason is dropped and `result` is `undefined`).
 * The node was therefore logged as *completed* after waiting out its full
 * timeout, the flow walked on, and the following node was blamed for a missing
 * element this node already knew never appeared.
 */
describe("executeFlow — wait_element timeout", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = { flows: { "flow-1": waitThenClickFlow(".skip-button", 300_000) }, log: [] };

    mockFn(chrome.storage.local.get).mockImplementation(async (key: string) =>
      key in store ? { [key]: store[key] } : {},
    );
    mockFn(chrome.storage.local.set).mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    });
    mockFn(chrome.storage.session.set).mockResolvedValue(undefined);
    mockFn(chrome.tabs.sendMessage).mockResolvedValue(undefined);
  });

  it("fails the flow — naming the wait, not the next node — when the element never appears", async () => {
    // Page polled to its deadline and found nothing → resolves `false`.
    mockFn(chrome.scripting.executeScript).mockResolvedValue(pageOk(false));

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/wait for element timed out after 300000ms/i);
    expect(result.error).toContain(".skip-button");
  });

  it("does not run subsequent nodes after a wait timeout", async () => {
    mockFn(chrome.scripting.executeScript).mockResolvedValue(pageOk(false));

    await executeFlow("flow-1" as EntityId, 1);

    // Only the wait node was injected — the click node never ran.
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    const log = store["log"] as ActivityLogEntry[];
    expect(log.some((e) => e.message.includes("node click"))).toBe(false);
  });

  it("continues to the next node when the element does appear", async () => {
    mockFn(chrome.scripting.executeScript).mockResolvedValue(pageOk(true));

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(true);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
  });
});

/**
 * Regression: the concurrency guard returned early before any logging, and
 * shortcut dispatch is fire-and-forget (`void executeFlow(...)`), so re-pressing
 * a shortcut while a long `wait_element` was parked produced no run, no log and
 * no toast — indistinguishable from a broken shortcut.
 */
describe("executeFlow — concurrent trigger", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = { flows: { "flow-1": waitThenClickFlow(".skip-button", 300_000) }, log: [] };

    mockFn(chrome.storage.local.get).mockImplementation(async (key: string) =>
      key in store ? { [key]: store[key] } : {},
    );
    mockFn(chrome.storage.local.set).mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    });
    mockFn(chrome.storage.session.set).mockResolvedValue(undefined);
    mockFn(chrome.tabs.sendMessage).mockResolvedValue(undefined);
  });

  it("logs and toasts when a trigger is ignored because the flow is mid-run", async () => {
    // First run parks in the page until released, holding the running lock.
    let release: (value: unknown) => void = () => undefined;
    mockFn(chrome.scripting.executeScript).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const firstRun = executeFlow("flow-1" as EntityId, 7);
    await Promise.resolve();

    const second = await executeFlow("flow-1" as EntityId, 7);
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/already running/i);

    const log = store["log"] as ActivityLogEntry[];
    expect(log.some((e) => e.message.includes("already running"))).toBe(true);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ type: "SHOW_TOAST" }),
    );

    release(pageOk(true));
    await firstRun;
  });
});

/**
 * The tests above mock `chrome.scripting.executeScript`, so they never exercise
 * the code that is actually injected. These drive the real injected string —
 * deep-query helpers, poll helper and result envelope — through
 * `cspSafeExecExpression` against a jsdom document, the way Chrome would:
 * `func(...args)` is invoked and its promise awaited before the result is
 * handed back.
 */
describe("executeFlow — injected code against a real DOM", () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = { flows: {}, log: [] };

    mockFn(chrome.storage.local.get).mockImplementation(async (key: string) =>
      key in store ? { [key]: store[key] } : {},
    );
    mockFn(chrome.storage.local.set).mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    });
    mockFn(chrome.storage.session.set).mockResolvedValue(undefined);
    mockFn(chrome.tabs.sendMessage).mockResolvedValue(undefined);

    // Run the injected code for real, mirroring how Chrome awaits a
    // promise-returning `func` before reporting its result.
    mockFn(chrome.scripting.executeScript).mockImplementation(
      async (injection: { func: (...args: unknown[]) => unknown; args?: unknown[] }) => [
        { result: await injection.func(...(injection.args ?? [])) },
      ],
    );

    document.body.innerHTML = "";
  });

  it("clicks a matching element and reports success", async () => {
    const button = document.createElement("button");
    button.className = "next-icon";
    const clicks: string[] = [];
    button.addEventListener("click", () => clicks.push("clicked"));
    document.body.appendChild(button);

    store["flows"] = { "flow-1": clickFlow("button.next-icon") };

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(true);
    expect(clicks).toEqual(["clicked"]);
  });

  it("reaches a target inside an open shadow root", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const button = document.createElement("button");
    button.className = "next-icon";
    const clicks: string[] = [];
    button.addEventListener("click", () => clicks.push("clicked"));
    shadow.appendChild(button);

    store["flows"] = { "flow-1": clickFlow("button.next-icon") };

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(true);
    expect(clicks).toEqual(["clicked"]);
  });

  it("surfaces an invalid selector as its own error, not a missing target", async () => {
    store["flows"] = { "flow-1": clickFlow("button:::broken") };

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/selector/i);
    expect(result.error).not.toMatch(/no element matched/i);
  });

  it("passes wait_element when the element is already present", async () => {
    const button = document.createElement("button");
    button.className = "skip";
    document.body.appendChild(button);

    store["flows"] = { "flow-1": waitThenClickFlow("button.skip", 1000) };

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(true);
  });

  it("fails wait_element — naming the wait — when the element never appears", async () => {
    store["flows"] = { "flow-1": waitThenClickFlow("button.never-there", 50) };

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/wait for element timed out after 50ms/i);
    // The wait is blamed, and the click node never runs.
    const log = store["log"] as ActivityLogEntry[];
    expect(log.some((e) => e.message.includes("node click"))).toBe(false);
  });
});
