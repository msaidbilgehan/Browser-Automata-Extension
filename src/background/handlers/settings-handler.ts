import { syncStore } from "@/shared/storage";
import { DEFAULT_SETTINGS } from "@/shared/types/settings";
import type { Settings } from "@/shared/types/settings";
import { applyExtensionIcon } from "@/background/services/icon-manager";

/** Handle SETTINGS_UPDATE: merge partial settings and persist */
export async function handleSettingsUpdate(partial: Partial<Settings>): Promise<{ ok: boolean }> {
  const current = (await syncStore.get("settings")) ?? DEFAULT_SETTINGS;

  const updated: Settings = {
    ...current,
    ...partial,
    logging: { ...current.logging, ...partial.logging },
    ui: { ...current.ui, ...partial.ui },
    execution: { ...current.execution, ...partial.execution },
    feedback: { ...current.feedback, ...partial.feedback },
    quickRun: { ...current.quickRun, ...partial.quickRun },
  };

  await syncStore.set("settings", updated);

  // Update badge based on globalEnabled state
  if (partial.globalEnabled !== undefined) {
    await updateGlobalBadge(updated.globalEnabled);
  }

  // Update extension icon when any ui setting changes (theme, iconColor, or iconTransparent affect it)
  if (partial.ui !== undefined) {
    await applyExtensionIcon(updated);
  }

  return { ok: true };
}

/** Update the extension icon badge to reflect global enabled state */
async function updateGlobalBadge(enabled: boolean): Promise<void> {
  if (enabled) {
    await chrome.action.setBadgeText({ text: "" });
  } else {
    await chrome.action.setBadgeText({ text: "OFF" });
    await chrome.action.setBadgeBackgroundColor({ color: "#6b7280" });
  }
}
