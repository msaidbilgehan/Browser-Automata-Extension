import { localStore } from "@/shared/storage";
import { DEEP_QUERY_SNIPPET } from "@/shared/deep-query-snippet";
import type { NotificationRule } from "@/shared/types/entities";
import { isNotificationsEnabled } from "./error-surfacer";

/**
 * Alarm name prefix for notification rules.
 * Exported so the service-worker alarm listener can route notification
 * alarms (`notification-check:<id>`) to {@link checkNotificationRuleById}.
 */
export const NOTIFICATION_ALARM_PREFIX = "notification-check:";

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
      // Return the element's current text (or null when absent) so the service
      // worker can compare it against the last observed value and fire only on a
      // real change. (Previously this returned `el !== null`, identical to
      // element_appears, so it never actually detected a text change.)
      return `(() => {
        const el = __qsDeep(${JSON.stringify(condition.selector)});
        return el ? (el.textContent ?? "") : null;
      })()`;
  }
}

/**
 * Session key for per-rule+tab notification state (last observed text, last
 * boolean outcome, last fire time). Stored in `chrome.storage.session` so it
 * survives service-worker restarts within a browser session but resets on
 * browser restart — the right scope, since the tab IDs it is keyed by are also
 * only valid for the current session.
 */
const NOTIFICATION_STATE_SESSION_KEY = "_notificationState";

/** Minimum gap between notifications for the same rule+tab — bounds spam. */
const NOTIFICATION_COOLDOWN_MS = 60_000;

interface NotificationCondState {
  /** Last boolean outcome for non-`text_changes` conditions (edge detection). */
  lastResult?: boolean;
  /** Last observed text for `text_changes` conditions. */
  lastText?: string;
  /** Epoch ms of the most recent notification for this rule+tab (cooldown). */
  lastFiredAt?: number;
}

type NotificationStateMap = Record<string, NotificationCondState>;

async function loadNotificationState(): Promise<NotificationStateMap> {
  try {
    const stored = await chrome.storage.session.get(NOTIFICATION_STATE_SESSION_KEY);
    return (stored[NOTIFICATION_STATE_SESSION_KEY] as NotificationStateMap | undefined) ?? {};
  } catch {
    // Session storage unavailable — degrade to stateless (may re-notify).
    return {};
  }
}

async function saveNotificationState(state: NotificationStateMap): Promise<void> {
  try {
    await chrome.storage.session.set({ [NOTIFICATION_STATE_SESSION_KEY]: state });
  } catch {
    // Best-effort; losing state only risks a redundant notification later.
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

/**
 * Check a single notification rule, identified by the ID embedded in its alarm
 * name. Invoked once per fired `notification-check:<id>` alarm so each alarm
 * only re-scans its own rule's tabs instead of every rule's.
 * No-ops when notifications are globally disabled or the rule is missing/disabled.
 */
export async function checkNotificationRuleById(ruleId: string): Promise<void> {
  if (!(await isNotificationsEnabled())) return;

  const rulesMap = (await localStore.get("notificationRules")) ?? {};
  const rule = rulesMap[ruleId];
  if (!rule?.enabled) return;

  await checkSingleRule(rule);
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

  const state = await loadNotificationState();
  const liveKeys = new Set<string>();
  let stateChanged = false;

  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    const key = `${rule.id}:${String(tab.id)}`;
    liveKeys.add(key);

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

      const raw = results[0]?.result;
      const prev = state[key] ?? {};
      const next: NotificationCondState = { ...prev };
      let shouldFire = false;

      if (rule.condition.type === "text_changes") {
        // Fire only when the text actually differs from the last observed value
        // (and we have a prior value to compare against).
        const currentText = typeof raw === "string" ? raw : null;
        if (currentText !== null) {
          if (prev.lastText !== undefined && currentText !== prev.lastText) {
            shouldFire = true;
          }
          next.lastText = currentText;
        }
      } else {
        // Edge-trigger the boolean conditions: fire when the condition becomes
        // true, not on every interval it stays true (which spammed a
        // notification each check).
        const met = raw === true;
        if (met && prev.lastResult !== true) {
          shouldFire = true;
        }
        next.lastResult = met;
      }

      // Per rule+tab cooldown bounds rapid re-fires (e.g. oscillating text).
      const nowMs = Date.now();
      if (shouldFire && nowMs - (prev.lastFiredAt ?? 0) >= NOTIFICATION_COOLDOWN_MS) {
        chrome.notifications.create(`notification-rule:${rule.id}`, {
          type: "basic",
          iconUrl: chrome.runtime.getURL("src/assets/icons/icon-48.png"),
          title: rule.notification.title,
          message: rule.notification.message,
          silent: !rule.notification.sound,
        });
        next.lastFiredAt = nowMs;
      }

      state[key] = next;
      stateChanged = true;
    } catch (err) {
      // Tab may not be injectable (e.g. chrome:// pages).
      // Log at debug level to avoid noise from expected failures.
      console.debug(
        `[Browser Automata] Notification check failed for tab ${String(tab.id)} (rule "${rule.name}"):`,
        err,
      );
    }
  }

  // Prune this rule's entries for tabs that no longer match, so the state map
  // stays bounded to currently-matching tabs (tab IDs otherwise accumulate).
  // Rebuild rather than delete-in-place (avoids dynamic-delete and keeps other
  // rules' entries intact).
  const rulePrefix = `${rule.id}:`;
  let pruned = false;
  const finalState: NotificationStateMap = {};
  for (const [existingKey, value] of Object.entries(state)) {
    if (existingKey.startsWith(rulePrefix) && !liveKeys.has(existingKey)) {
      pruned = true;
      continue;
    }
    finalState[existingKey] = value;
  }

  if (stateChanged || pruned) {
    await saveNotificationState(finalState);
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
