import { localStore } from "@/shared/storage";
import type { CSSRule, EntityId } from "@/shared/types/entities";
import { reconcileCSSRule } from "@/background/services/css-injector";

/** Handle CSS_RULE_SAVE: create or update a CSS rule */
export async function handleCSSRuleSave(cssRule: CSSRule): Promise<{ ok: boolean }> {
  const previous = (await localStore.get("cssRules"))?.[cssRule.id];
  await localStore.update("cssRules", (rules) => ({ ...rules, [cssRule.id]: cssRule }), {});
  // Apply the change to already-open tabs (remove old CSS, inject new).
  await reconcileCSSRule(previous, cssRule);
  return { ok: true };
}

/** Handle CSS_RULE_DELETE: remove a CSS rule by ID */
export async function handleCSSRuleDelete(cssRuleId: EntityId): Promise<{ ok: boolean }> {
  const previous = (await localStore.get("cssRules"))?.[cssRuleId];
  await localStore.update(
    "cssRules",
    (rules) => {
      const next = { ...rules };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete next[cssRuleId];
      return next;
    },
    {},
  );
  // Strip the deleted rule's CSS from any open tab it was injected into.
  await reconcileCSSRule(previous, undefined);
  return { ok: true };
}
