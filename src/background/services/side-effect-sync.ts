import { syncNetworkRules } from "./network-manager";
import { setupNotificationAlarms } from "./notification-checker";
import { setupScheduledScripts } from "./schedule-manager";

/**
 * Re-synchronize every subsystem that derives live runtime state from stored
 * entities: the declarativeNetRequest dynamic rules (from `networkRules`), the
 * notification-check alarms (from `notificationRules`), and the scheduled-script
 * alarms (from scheduled `scripts`).
 *
 * Per-entity handlers (`network-handler`, `notification-handler`, …) already
 * call the relevant sync after each individual mutation. Bulk paths — config
 * import and template install/update/uninstall — mutate many entity types at
 * once and previously skipped these bridges entirely, leaving imported/installed
 * rules inert and uninstalled rules stale until a browser restart. They call
 * this instead so all three subsystems re-sync in one shot.
 *
 * Each underlying sync is idempotent (it reads the full entity set and rebuilds
 * the corresponding rules/alarms), so calling this after a bulk mutation always
 * reconciles the live engines with final storage state.
 */
export async function resyncEntitySideEffects(): Promise<void> {
  await Promise.all([
    syncNetworkRules(),
    setupNotificationAlarms(),
    setupScheduledScripts(),
  ]);
}
