/**
 * Surface errors to the user via badge and notifications.
 * F25: Badge on extension icon for unread errors. Chrome notifications for background errors.
 */

import { syncStore } from "@/shared/storage";
import { DEFAULT_SETTINGS } from "@/shared/types/settings";

/** Set error badge on extension icon */
export async function showErrorBadge(count?: number): Promise<void> {
  const text = count !== undefined && count > 0 ? String(count) : "!";
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: "#f43f5e" }); // rose-500
}

/** Clear error badge */
export async function clearErrorBadge(): Promise<void> {
  await chrome.action.setBadgeText({ text: "" });
}

/** Check whether the global notification switch is on */
export async function isNotificationsEnabled(): Promise<boolean> {
  const stored = await syncStore.get("settings");
  if (!stored) return DEFAULT_SETTINGS.notifications.enabled;
  const notifications = { ...DEFAULT_SETTINGS.notifications, ...stored.notifications };
  return notifications.enabled;
}

/** Send a Chrome notification for a background error. Respects the global notifications toggle. */
export async function notifyError(title: string, message: string): Promise<void> {
  if (!(await isNotificationsEnabled())) return;

  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("src/assets/icons/icon-128.png"),
      title: `Browser Automata: ${title}`,
      message,
    });
  } catch {
    // Notification permission may not be granted — log but don't throw
    console.warn("[Browser Automata] Failed to show notification:", title, message);
  }
}
