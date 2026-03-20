import { localStore } from "@/shared/storage";
import { syncNetworkRules } from "@/background/services/network-manager";
import type { NetworkRule, EntityId } from "@/shared/types/entities";

/**
 * Save a network rule to storage and sync declarativeNetRequest rules.
 */
export async function handleNetworkRuleSave(rule: NetworkRule): Promise<{ ok: boolean }> {
  await localStore.update("networkRules", (rules) => ({ ...rules, [rule.id]: rule }), {});
  await syncNetworkRules();
  return { ok: true };
}

/**
 * Delete a network rule from storage and sync declarativeNetRequest rules.
 */
export async function handleNetworkRuleDelete(ruleId: EntityId): Promise<{ ok: boolean }> {
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
  return { ok: true };
}
