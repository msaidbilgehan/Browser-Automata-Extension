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
 */

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
    mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: false }]);

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no element matched/i);

    const log = store["log"] as ActivityLogEntry[];
    expect(log.some((e) => e.action === "flow_error" && e.status === "error")).toBe(true);
  });

  it("surfaces the failure on the page via an error toast", async () => {
    mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: false }]);

    await executeFlow("flow-1" as EntityId, 42);

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ type: "SHOW_TOAST", level: "error" }),
    );
  });

  it("succeeds when the click selector matches an element", async () => {
    // Page reports a successful click → injected code resolves to `true`.
    mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: true }]);

    const result = await executeFlow("flow-1" as EntityId, 1);

    expect(result.ok).toBe(true);

    const log = store["log"] as ActivityLogEntry[];
    expect(log.some((e) => e.action === "flow_error")).toBe(false);
    expect(log.some((e) => e.action === "flow_executed" && e.status === "success")).toBe(true);
  });
});
