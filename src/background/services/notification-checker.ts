import { localStore } from "@/shared/storage";
import { DEEP_QUERY_SNIPPET } from "@/shared/deep-query-snippet";
import type { NotificationRule } from "@/shared/types/entities";
import { isNotificationsEnabled } from "./error-surfacer";

/**
 * Alarm name prefix for notification rules.
 */
const NOTIFICATION_ALARM_PREFIX = "notification-check:";

/**
 * Build a check script for the given notification condition.
 * Returns a function string that evaluates in the page context.
 */
function buildCheckScript(rule: NotificationRule): string {
  const { condition } = rule;

  switch (condition.type) {
    case "element_appears":
      return `(() => {
        const el = __qsDeep(${JSON.stringify(condition.selector)});
        return el !== null;
      })()`;
    case "element_disappears":
      return `(() => {
        const el = __qsDeep(${JSON.stringify(condition.selector)});
        return el === null;
      })()`;
    case "text_contains":
      return `(() => {
        const el = __qsDeep(${JSON.stringify(condition.selector)});
        if (!el) return false;
        return el.textContent?.includes(${JSON.stringify(condition.value ?? "")}) ?? false;
      })()`;
    case "text_changes":
      return `(() => {
        const el = __qsDeep(${JSON.stringify(condition.selector)});
        return el !== null;
      })()`;
  }
}

/**
 * Convert a UrlPattern scope to a chrome.tabs.query url pattern.
 */
function scopeToQueryUrl(rule: NotificationRule): string {
  const { scope } = rule;
  switch (scope.type) {
    case "global":
      return "<all_urls>";
    case "exact":
      return scope.value;
    case "glob":
      return scope.value;
    case "regex":
      // chrome.tabs.query does not support regex; fallback to all_urls.
      // The condition script still runs per-tab, but tabs.query cannot pre-filter.
      console.warn(
        `[Browser Automata] Notification rule "${rule.name}" uses regex scope — ` +
          `chrome.tabs.query cannot filter by regex, checking all tabs instead`,
      );
      return "<all_urls>";
  }
}

/**
 * Check all enabled notification rules: query matching tabs,
 * inject a condition-check script, and fire chrome.notifications
 * when the condition is met.
 * Skips entirely when the global notifications toggle is off.
 */
export async function checkNotificationRules(): Promise<void> {
  if (!(await isNotificationsEnabled())) return;

  const rulesMap = (await localStore.get("notificationRules")) ?? {};
  const enabledRules = Object.values(rulesMap).filter((r) => r.enabled);

  for (const rule of enabledRules) {
    await checkSingleRule(rule);
  }
}

async function checkSingleRule(rule: NotificationRule): Promise<void> {
  const urlPattern = scopeToQueryUrl(rule);

  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ url: urlPattern });
  } catch (err) {
    console.debug(
      `[Browser Automata] Notification rule "${rule.name}" skipped — invalid URL pattern "${urlPattern}":`,
      err,
    );
    return;
  }

  for (const tab of tabs) {
    if (tab.id === undefined) continue;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (script: string) => {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const fn: () => unknown = new Function(script) as () => unknown;
          return fn();
        },
        args: [`${DEEP_QUERY_SNIPPET}; return ${buildCheckScript(rule)}`],
      });

      const conditionMet = results[0]?.result === true;
      if (conditionMet) {
        chrome.notifications.create(`notification-rule:${rule.id}`, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("src/assets/icons/icon-48.png"),
          title: rule.notification.title,
          message: rule.notification.message,
          silent: !rule.notification.sound,
        });
      }
    } catch (err) {
      // Tab may not be injectable (e.g. chrome:// pages).
      // Log at debug level to avoid noise from expected failures.
      console.debug(
        `[Browser Automata] Notification check failed for tab ${String(tab.id)} (rule "${rule.name}"):`,
        err,
      );
    }
  }
}

/**
 * Create chrome.alarms for all enabled notification rules
 * at each rule's configured check interval.
 */
export async function setupNotificationAlarms(): Promise<void> {
  const rulesMap = (await localStore.get("notificationRules")) ?? {};
  const enabledRules = Object.values(rulesMap).filter((r) => r.enabled);

  // Clear all existing notification alarms
  const allAlarms = await chrome.alarms.getAll();
  const notificationAlarms = allAlarms.filter((a) => a.name.startsWith(NOTIFICATION_ALARM_PREFIX));
  for (const alarm of notificationAlarms) {
    await chrome.alarms.clear(alarm.name);
  }

  // Create new alarms for each enabled rule
  for (const rule of enabledRules) {
    const alarmName = `${NOTIFICATION_ALARM_PREFIX}${rule.id}`;
    await chrome.alarms.create(alarmName, {
      periodInMinutes: Math.max(1, rule.checkIntervalMinutes),
    });
  }
}
