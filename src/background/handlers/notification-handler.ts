import { localStore } from "@/shared/storage";
import type { NotificationRule, EntityId } from "@/shared/types/entities";
import { setupNotificationAlarms } from "../services/notification-checker";

/**
 * Save (create or update) a notification rule, then re-sync alarms.
 */
export async function handleNotificationRuleSave(rule: NotificationRule): Promise<{ ok: boolean }> {
  await localStore.update("notificationRules", (rules) => ({ ...rules, [rule.id]: rule }), {});
  await setupNotificationAlarms();
  return { ok: true };
}

/**
 * Delete a notification rule by ID, then re-sync alarms.
 */
export async function handleNotificationRuleDelete(ruleId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "notificationRules",
    (rules) => {
      const updated = { ...rules };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete updated[ruleId];
      return updated;
    },
    {},
  );
  await setupNotificationAlarms();
  return { ok: true };
}
