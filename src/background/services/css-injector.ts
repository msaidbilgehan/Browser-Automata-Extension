import { localStore, syncStore } from "@/shared/storage";
import { matchUrl } from "@/shared/url-pattern/matcher";
import { appendLogEntry } from "@/background/handlers/log-handler";

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
}
