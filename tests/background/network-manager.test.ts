import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncNetworkRules } from "@/background/services/network-manager";
import { mockFn } from "../helpers";

/**
 * Regression tests for C3 — declarativeNetRequest numeric rule-ID collisions.
 *
 * The previous implementation derived each rule's numeric ID from a sum of the
 * EntityId's char codes. A sum is order-independent, so any two anagram UUIDs
 * collapsed to the same ID — and `updateDynamicRules` rejects the *entire*
 * addRules batch when two entries share an `id`, silently disabling every rule.
 */

/** Minimal block-rule fixture — runtime shape only, like the other background tests. */
function blockRule(id: string, enabled = true): Record<string, unknown> {
  return {
    id,
    name: `rule-${id}`,
    scope: { type: "global", value: "" },
    enabled,
    profileId: null,
    urlFilter: "||example.com^",
    action: { type: "block" },
    meta: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  };
}

/** The old, broken hash: sum of char codes — order-independent, so anagrams collide. */
function legacySumHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) % 100_000;
  }
  return hash + 10_000;
}

describe("syncNetworkRules — collision-free numeric rule IDs (C3)", () => {
  let networkRules: Record<string, unknown>;
  let ruleIdStore: Record<string, number> | undefined;
  let updateDynamicRules: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    networkRules = {};
    ruleIdStore = undefined;

    mockFn(chrome.storage.local.get).mockImplementation(async (key: string) => {
      if (key === "networkRules") return { networkRules };
      if (key === "networkRuleIds") return ruleIdStore ? { networkRuleIds: ruleIdStore } : {};
      return {};
    });
    mockFn(chrome.storage.local.set).mockImplementation(async (items: Record<string, unknown>) => {
      if ("networkRuleIds" in items) {
        ruleIdStore = items["networkRuleIds"] as Record<string, number>;
      }
    });

    updateDynamicRules = vi.fn(async () => undefined);
    Object.assign(chrome, {
      declarativeNetRequest: {
        getDynamicRules: vi.fn(async () => [] as { id: number }[]),
        updateDynamicRules,
        RuleActionType: { BLOCK: "block", REDIRECT: "redirect", MODIFY_HEADERS: "modifyHeaders" },
        HeaderOperation: { SET: "set", APPEND: "append", REMOVE: "remove" },
      },
    });
  });

  /** addRules from the most recent updateDynamicRules call. */
  function lastAddRules(): { id: number }[] {
    const call = updateDynamicRules.mock.calls.at(-1);
    const arg = call?.[0] as { addRules: { id: number }[] } | undefined;
    return arg?.addRules ?? [];
  }

  it("assigns distinct IDs to char-anagram UUIDs that collided under the old hash", async () => {
    const idA = "12345678-90ab-cdef-1234-567890abcdef";
    const idB = [...idA].reverse().join(""); // same characters → identical legacy hash

    // Guard: confirm this really is a collision pair for the old implementation.
    expect(idA).not.toBe(idB);
    expect(legacySumHash(idA)).toBe(legacySumHash(idB));

    networkRules = { [idA]: blockRule(idA), [idB]: blockRule(idB) };

    await syncNetworkRules();

    const ids = lastAddRules().map((r) => r.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2); // distinct — collision is gone
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(10_000);
    }
  });

  it("keeps IDs stable across repeated syncs (persisted allocation)", async () => {
    networkRules = { aaaa: blockRule("aaaa"), bbbb: blockRule("bbbb") };

    await syncNetworkRules();
    const first = lastAddRules()
      .map((r) => r.id)
      .sort((a, b) => a - b);

    await syncNetworkRules();
    const second = lastAddRules()
      .map((r) => r.id)
      .sort((a, b) => a - b);

    expect(second).toEqual(first);
  });

  it("never emits duplicate IDs across many rules", async () => {
    for (let i = 0; i < 50; i++) {
      networkRules[`rule-${String(i)}`] = blockRule(`rule-${String(i)}`);
    }

    await syncNetworkRules();

    const ids = lastAddRules().map((r) => r.id);
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
  });

  it("applies only enabled rules but allocates stable IDs for all of them", async () => {
    networkRules = { on: blockRule("on", true), off: blockRule("off", false) };

    await syncNetworkRules();

    expect(lastAddRules()).toHaveLength(1); // disabled rule is not applied
    expect(ruleIdStore).toBeDefined();
    expect(Object.keys(ruleIdStore ?? {}).sort()).toEqual(["off", "on"]);
  });

  it("prunes ID-map entries for rules that no longer exist", async () => {
    networkRules = { keep: blockRule("keep"), gone: blockRule("gone") };
    await syncNetworkRules();
    expect(Object.keys(ruleIdStore ?? {}).sort()).toEqual(["gone", "keep"]);

    // "gone" is deleted from storage; a re-sync should drop it from the ID map.
    networkRules = { keep: blockRule("keep") };
    await syncNetworkRules();
    expect(Object.keys(ruleIdStore ?? {})).toEqual(["keep"]);
  });
});
