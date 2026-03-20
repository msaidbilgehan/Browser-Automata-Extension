import { localStore, syncStore } from "@/shared/storage";
import { executeScript, getMatchingScripts } from "./script-manager";
import { appendLogEntry } from "@/background/handlers/log-handler";
import type { EntityId } from "@/shared/types/entities";

const ALARM_PREFIX = "schedule:";

/**
 * Scan all scripts with trigger="schedule" and create chrome.alarms for each.
 * Should be called after migrations on install/update.
 */
export async function setupScheduledScripts(): Promise<void> {
  // Clear all existing schedule alarms first
  const existingAlarms = await chrome.alarms.getAll();
  const scheduleAlarms = existingAlarms.filter((a) => a.name.startsWith(ALARM_PREFIX));
  for (const alarm of scheduleAlarms) {
    await chrome.alarms.clear(alarm.name);
  }

  const scripts = (await localStore.get("scripts")) ?? {};
  const settings = await syncStore.get("settings");
  if (!settings?.globalEnabled) return;

  for (const script of Object.values(scripts)) {
    if (script.enabled && script.trigger === "schedule" && script.scheduleConfig?.intervalMinutes) {
      const alarmName = `${ALARM_PREFIX}${script.id}`;
      await chrome.alarms.create(alarmName, {
        periodInMinutes: script.scheduleConfig.intervalMinutes,
      });
    }
  }
}

/**
 * Handle a fired alarm — find the corresponding script, query matching tabs, and inject.
 */
export async function handleAlarmFired(alarmName: string): Promise<void> {
  if (!alarmName.startsWith(ALARM_PREFIX)) return;

  const scriptId = alarmName.slice(ALARM_PREFIX.length) as EntityId;
  const scripts = (await localStore.get("scripts")) ?? {};
  const script = scripts[scriptId];

  if (!script?.enabled) return;

  await appendLogEntry({
    action: "schedule_fired",
    status: "info",
    entityId: script.id,
    entityType: "script",
    message: `Scheduled script "${script.name}" alarm fired`,
  });

  // Query tabs matching the script's scope
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    // Use getMatchingScripts to check if this script matches the tab URL
    const matching = await getMatchingScripts(tab.url, "schedule");
    const found = matching.find((s) => s.id === scriptId);
    if (found) {
      await executeScript(tab.id, found);
    }
  }
}
