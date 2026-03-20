import { localStore } from "@/shared/storage";
import { runExtraction } from "@/background/services/extraction-engine";
import type { ExtractionRule, EntityId } from "@/shared/types/entities";

/** Save an extraction rule to local storage */
export async function handleExtractionRuleSave(rule: ExtractionRule): Promise<{ ok: boolean }> {
  await localStore.update("extractionRules", (rules) => ({ ...rules, [rule.id]: rule }), {});
  return { ok: true };
}

/** Delete an extraction rule from local storage */
export async function handleExtractionRuleDelete(ruleId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "extractionRules",
    (rules) => {
      return Object.fromEntries(Object.entries(rules).filter(([key]) => key !== ruleId));
    },
    {},
  );
  return { ok: true };
}

/** Run an extraction rule immediately on the active tab */
export async function handleExtractionRunNow(
  ruleId: EntityId,
): Promise<{ ok: boolean; data?: Record<string, unknown>[]; formatted?: string; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "No active tab" };
  }
  return runExtraction(ruleId, tab.id);
}
