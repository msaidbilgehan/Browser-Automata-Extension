import { localStore, syncStore } from "@/shared/storage";
import { matchUrl } from "@/shared/url-pattern/matcher";
import { appendLogEntry } from "@/background/handlers/log-handler";
import type { CSSRule } from "@/shared/types/entities";

/** Tabs we can inject into — http(s) only (chrome://, about:, etc. are not injectable). */
async function getInjectableTabs(): Promise<{ id: number; url: string }[]> {
  const tabs = await chrome.tabs.query({});
  const injectable: { id: number; url: string }[] = [];
  for (const tab of tabs) {
    if (tab.id == null || !tab.url) continue;
    if (!/^https?:\/\//.test(tab.url)) continue;
    injectable.push({ id: tab.id, url: tab.url });
  }
  return injectable;
}

/** Insert one rule's CSS into a tab and log the outcome. */
async function insertRuleIntoTab(tabId: number, url: string, rule: CSSRule): Promise<void> {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: rule.css,
    });

    await appendLogEntry({
      action: "css_injected",
      status: "success",
      entityId: rule.id,
      entityType: "css_rule",
      url,
      message: `CSS rule "${rule.name}" injected`,
    });
  } catch (err) {
    await appendLogEntry({
      action: "css_injected",
      status: "error",
      entityId: rule.id,
      entityType: "css_rule",
      url,
      message: `CSS rule "${rule.name}" injection failed`,
      error: {
        name: "CSSInjectionError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

/**
 * Remove a previously-injected stylesheet from a tab.
 *
 * `removeCSS` rejects if the exact stylesheet was never inserted (e.g. the tab
 * was reloaded, or the service worker restarted and lost its in-tab state). That
 * is a harmless no-op for reconciliation, so it is swallowed at debug level.
 */
async function removeCSSFromTab(tabId: number, css: string): Promise<void> {
  try {
    await chrome.scripting.removeCSS({
      target: { tabId },
      css,
    });
  } catch (err) {
    console.debug(`[Browser Automata] removeCSS skipped for tab ${String(tabId)}:`, err);
  }
}

/**
 * Inject all matching CSS rules for a tab's URL.
 */
export async function injectMatchingCSS(tabId: number, url: string): Promise<void> {
  const settings = await syncStore.get("settings");
  if (!settings?.globalEnabled) return;

  const cssRules = (await localStore.get("cssRules")) ?? {};
  const matching = Object.values(cssRules).filter(
    (rule) => rule.enabled && matchUrl(rule.scope, url),
  );

  for (const rule of matching) {
    await insertRuleIntoTab(tabId, url, rule);
  }
}

/**
 * Reconcile a CSS rule change across every open tab so live pages reflect the
 * change immediately, without waiting for a reload.
 *
 * `insertCSS` is additive and has no implicit "replace": editing a rule used to
 * stack the new stylesheet on top of the old, and disabling or deleting a rule
 * left its stylesheet applied until the tab was refreshed. This removes the
 * previously-injected stylesheet and (re)injects the new one wherever it now
 * matches.
 *
 * @param previous The rule's prior state (undefined when newly created).
 * @param next The rule's new state (undefined when deleted).
 */
export async function reconcileCSSRule(
  previous: CSSRule | undefined,
  next: CSSRule | undefined,
): Promise<void> {
  // Still remove stale CSS when globally disabled — only injection is gated.
  const settings = await syncStore.get("settings");
  const globalEnabled = settings?.globalEnabled ?? false;

  const tabs = await getInjectableTabs();

  for (const tab of tabs) {
    const prevMatch =
      previous !== undefined && matchUrl(previous.scope, tab.url) ? previous : undefined;
    const nextMatch =
      next?.enabled && globalEnabled && matchUrl(next.scope, tab.url) ? next : undefined;

    // If the exact stylesheet is unchanged and still applies, leave it in place
    // to avoid a remove→reinsert flash (e.g. for `body { display: none }`).
    // Equal-or-both-absent: the both-absent case (a tab neither rule touches) is
    // a no-op anyway, since the remove/insert guards below would both be skipped.
    const unchanged = prevMatch?.css === nextMatch?.css;
    if (unchanged) continue;

    if (prevMatch !== undefined) {
      await removeCSSFromTab(tab.id, prevMatch.css);
    }
    if (nextMatch !== undefined) {
      await insertRuleIntoTab(tab.id, tab.url, nextMatch);
    }
  }
}
