import { localStore } from "@/shared/storage";
import type { NetworkRule, EntityId, HeaderMod } from "@/shared/types/entities";

/**
 * Starting value for allocated numeric rule IDs. The offset keeps our dynamic
 * rule IDs clear of the low integers that static rulesets typically use.
 */
const RULE_ID_OFFSET = 10_000;

/**
 * Resolve a stable, collision-free numeric rule ID for every given EntityId.
 *
 * IDs are allocated locally and persisted in a bijective `EntityId → number`
 * map. The previous implementation hashed the UUID by summing char codes, which
 * is order-independent and collided on the tiny hex+dash alphabet — and a single
 * collision made `updateDynamicRules` reject the *entire* ruleset. Allocating the
 * next free integer instead guarantees uniqueness for any set of rules.
 *
 * Entries for rules that no longer exist are pruned so the map stays bounded.
 *
 * @param entityIds All current NetworkRule IDs (enabled or not) so allocations
 *   stay stable across enable/disable toggles.
 * @returns Map from each EntityId to its allocated numeric rule ID.
 */
async function resolveRuleIds(entityIds: readonly EntityId[]): Promise<Map<EntityId, number>> {
  const stored = (await localStore.get("networkRuleIds")) ?? {};
  const live = new Set<string>(entityIds);

  // Keep only entries for rules that still exist; remember used IDs for allocation.
  const next: Record<string, number> = {};
  const usedIds = new Set<number>();
  let changed = false;
  for (const [entityId, numericId] of Object.entries(stored)) {
    if (live.has(entityId)) {
      next[entityId] = numericId;
      usedIds.add(numericId);
    } else {
      changed = true; // pruned a stale entry
    }
  }

  // Allocate the next free integer (≥ offset) for any rule without an ID yet.
  let cursor = RULE_ID_OFFSET;
  const allocate = (): number => {
    while (usedIds.has(cursor)) cursor += 1;
    usedIds.add(cursor);
    return cursor;
  };

  const result = new Map<EntityId, number>();
  for (const entityId of entityIds) {
    let numericId = next[entityId];
    if (numericId === undefined) {
      numericId = allocate();
      next[entityId] = numericId;
      changed = true;
    }
    result.set(entityId, numericId);
  }

  if (changed) {
    await localStore.set("networkRuleIds", next);
  }

  return result;
}

/**
 * Convert a HeaderMod to the declarativeNetRequest header format.
 */
function toHeaderAction(mod: HeaderMod): chrome.declarativeNetRequest.ModifyHeaderInfo {
  const base: chrome.declarativeNetRequest.ModifyHeaderInfo = {
    header: mod.header,
    operation:
      mod.operation === "set"
        ? chrome.declarativeNetRequest.HeaderOperation.SET
        : mod.operation === "append"
          ? chrome.declarativeNetRequest.HeaderOperation.APPEND
          : chrome.declarativeNetRequest.HeaderOperation.REMOVE,
  };
  if (mod.value !== undefined && mod.operation !== "remove") {
    return { ...base, value: mod.value };
  }
  return base;
}

/**
 * Convert a NetworkRule entity to a chrome.declarativeNetRequest.Rule.
 * @param numericId Pre-allocated, collision-free rule ID (see {@link resolveRuleIds}).
 */
function toDeclarativeRule(
  rule: NetworkRule,
  numericId: number,
): chrome.declarativeNetRequest.Rule {
  const condition: chrome.declarativeNetRequest.RuleCondition = {
    urlFilter: rule.urlFilter,
  };

  if (rule.resourceTypes !== undefined && rule.resourceTypes.length > 0) {
    condition.resourceTypes = rule.resourceTypes as chrome.declarativeNetRequest.ResourceType[];
  }

  let action: chrome.declarativeNetRequest.RuleAction;

  switch (rule.action.type) {
    case "block": {
      action = { type: chrome.declarativeNetRequest.RuleActionType.BLOCK };
      break;
    }
    case "redirect": {
      action = {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: { url: rule.action.url },
      };
      break;
    }
    case "modify_headers": {
      const headerAction: chrome.declarativeNetRequest.RuleAction = {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      };
      if (rule.action.requestHeaders !== undefined) {
        headerAction.requestHeaders = rule.action.requestHeaders.map(toHeaderAction);
      }
      if (rule.action.responseHeaders !== undefined) {
        headerAction.responseHeaders = rule.action.responseHeaders.map(toHeaderAction);
      }
      action = headerAction;
      break;
    }
  }

  return { id: numericId, priority: 1, action, condition };
}

/**
 * Read all NetworkRules from storage, convert to declarativeNetRequest
 * dynamic rules, and apply them. Removes all existing dynamic rules first.
 */
export async function syncNetworkRules(): Promise<void> {
  const rulesMap = (await localStore.get("networkRules")) ?? {};
  const allRules = Object.values(rulesMap);

  // Allocate stable, collision-free numeric IDs for every rule (enabled or not).
  const idMap = await resolveRuleIds(allRules.map((r) => r.id));

  // Build the dynamic ruleset from enabled rules, de-duplicating by numeric ID
  // defensively so a stray duplicate can never make updateDynamicRules reject
  // the whole batch.
  const addRules: chrome.declarativeNetRequest.Rule[] = [];
  const seenIds = new Set<number>();
  for (const rule of allRules) {
    if (!rule.enabled) continue;
    const numericId = idMap.get(rule.id);
    if (numericId === undefined || seenIds.has(numericId)) continue;
    seenIds.add(numericId);
    addRules.push(toDeclarativeRule(rule, numericId));
  }

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
}

/**
 * Add a single network rule to storage and re-sync all rules.
 */
export async function addNetworkRule(rule: NetworkRule): Promise<void> {
  await localStore.update("networkRules", (rules) => ({ ...rules, [rule.id]: rule }), {});
  await syncNetworkRules();
}

/**
 * Remove a single network rule from storage and re-sync all rules.
 */
export async function removeNetworkRule(ruleId: EntityId): Promise<void> {
  await localStore.update(
    "networkRules",
    (rules) => {
      const updated = { ...rules };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete updated[ruleId];
      return updated;
    },
    {},
  );
  await syncNetworkRules();
}
