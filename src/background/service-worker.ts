// Service worker entry — all event listeners must be registered synchronously at top level.
// See: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle

import { registerMessageRouter } from "./message-router";
import { runMigrations } from "@/shared/storage";
import { DEFAULT_SETTINGS } from "@/shared/types/settings";
import { syncStore } from "@/shared/storage";
import { setupScheduledScripts } from "./services/schedule-manager";
import { handleAlarmFired } from "./services/schedule-manager";
import { setupNotificationAlarms } from "./services/notification-checker";
import { syncNetworkRules } from "./services/network-manager";
import { pushShortcutsToTab } from "./services/shortcut-manager";
import { injectPageLoadScripts } from "./services/script-manager";
import { injectMatchingCSS } from "./services/css-injector";
import { applyExtensionIcon } from "./services/icon-manager";

// Register message router synchronously at top level
registerMessageRouter();

// Register alarm listener synchronously at top level
chrome.alarms.onAlarm.addListener((alarm) => {
  void handleAlarmFired(alarm.name);
});

/**
 * Re-initialize all open tabs: push shortcuts, inject CSS, and run page-load scripts.
 * Mirrors the CONTENT_READY handler so tabs work immediately after extension
 * install/reload/browser restart without requiring a page refresh.
 */
async function reinitializeAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id == null || !tab.url) continue;
    // Skip non-injectable tabs (chrome://, edge://, about:, etc.)
    if (!/^https?:\/\//.test(tab.url)) continue;
    const tabId = tab.id;
    const url = tab.url;
    void Promise.all([
      injectPageLoadScripts(tabId, url),
      injectMatchingCSS(tabId, url),
      pushShortcutsToTab(tabId, url),
    ]).catch((err) => {
      console.warn(`[Browser Automata] Failed to reinitialize tab ${tabId}:`, err);
    });
  }
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      console.log("[Browser Automata] Extension installed");
      // Initialize default settings
      const existing = await syncStore.get("settings");
      if (existing === undefined) {
        await syncStore.set("settings", DEFAULT_SETTINGS);
      }
    }

    if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
      console.log("[Browser Automata] Extension updated");
    }

    // Run schema migrations on both install and update
    await runMigrations();

    // Set up scheduled script alarms after migrations
    await setupScheduledScripts();

    // Set up notification rule alarms after migrations
    await setupNotificationAlarms();

    // Sync network rules with declarativeNetRequest after migrations
    await syncNetworkRules();

    // Apply extension icon from saved settings
    const settings = (await syncStore.get("settings")) ?? DEFAULT_SETTINGS;
    await applyExtensionIcon(settings);

    // Re-initialize all already-open tabs (shortcuts, CSS, scripts) so they
    // work immediately after extension install/reload without a page refresh.
    await reinitializeAllTabs();
  })();
});

// When the browser starts, re-initialize all restored tabs.
// Service worker may have been terminated; content scripts need fresh data.
chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    const settings = (await syncStore.get("settings")) ?? DEFAULT_SETTINGS;
    await applyExtensionIcon(settings);
    await reinitializeAllTabs();
  })();
});

export {};
