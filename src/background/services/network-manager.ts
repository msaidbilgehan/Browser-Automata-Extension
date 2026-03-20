import { localStore } from "@/shared/storage";
import type { NetworkRule, EntityId, HeaderMod } from "@/shared/types/entities";

/**
 * Offset for numeric rule IDs to avoid collisions with other extensions.
 */
const RULE_ID_OFFSET = 10_000;

/**
 * Simple hash: sum of char codes mod 100000, plus offset.
 * Produces a deterministic numeric ID from an EntityId string.
 */
function entityIdToNumericId(id: EntityId): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) % 100_000;
  }
  return hash + RULE_ID_OFFSET;
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
 */
function toDeclarativeRule(rule: NetworkRule): chrome.declarativeNetRequest.Rule {
  const numericId = entityIdToNumericId(rule.id);

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
  const enabledRules = Object.values(rulesMap).filter((r) => r.enabled);

  const addRules = enabledRules.map(toDeclarativeRule);

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
