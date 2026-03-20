import { localStore } from "@/shared/storage";
import type { CSSRule, EntityId } from "@/shared/types/entities";

/** Handle CSS_RULE_SAVE: create or update a CSS rule */
export async function handleCSSRuleSave(cssRule: CSSRule): Promise<{ ok: boolean }> {
  await localStore.update("cssRules", (rules) => ({ ...rules, [cssRule.id]: cssRule }), {});
  return { ok: true };
}

/** Handle CSS_RULE_DELETE: remove a CSS rule by ID */
export async function handleCSSRuleDelete(cssRuleId: EntityId): Promise<{ ok: boolean }> {
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
  return { ok: true };
}
