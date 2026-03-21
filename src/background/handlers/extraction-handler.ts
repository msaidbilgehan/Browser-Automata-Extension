import { localStore } from "@/shared/storage";
import { runExtraction, normalizeTriggers } from "@/background/services/extraction-engine";
import { generateId, now } from "@/shared/utils";
import type { ExtractionRule, EntityId, Shortcut } from "@/shared/types/entities";

/**
 * Find the linked shortcut for an extraction rule (action.type === "extraction"
 * and action.extractionRuleId matches).
 */
async function findLinkedShortcut(ruleId: EntityId): Promise<Shortcut | undefined> {
  const shortcuts = (await localStore.get("shortcuts")) ?? {};
  return Object.values(shortcuts).find(
    (s) => s.action.type === "extraction" && s.action.extractionRuleId === ruleId,
  );
}

/** Save an extraction rule to local storage and manage linked shortcut */
export async function handleExtractionRuleSave(rule: ExtractionRule): Promise<{ ok: boolean }> {
  await localStore.update("extractionRules", (rules) => ({ ...rules, [rule.id]: rule }), {});

  // Auto-manage linked shortcut for "shortcut" trigger
  const existing = await findLinkedShortcut(rule.id);
  const triggers = normalizeTriggers(rule);
  const hasShortcutTrigger = triggers.includes("shortcut");

  if (hasShortcutTrigger && rule.shortcutKeyCombo?.key) {
    const timestamp = now();
    if (existing) {
      // Update existing linked shortcut
      const updated: Shortcut = {
        ...existing,
        name: `Extraction: ${rule.name}`,
        keyCombo: rule.shortcutKeyCombo,
        scope: rule.scope,
        enabled: rule.enabled,
        profileId: rule.profileId,
        meta: { ...existing.meta, updatedAt: timestamp },
      };
      await localStore.update("shortcuts", (shortcuts) => ({ ...shortcuts, [updated.id]: updated }), {});
    } else {
      // Create new linked shortcut
      const shortcut: Shortcut = {
        id: generateId(),
        name: `Extraction: ${rule.name}`,
        keyCombo: rule.shortcutKeyCombo,
        action: { type: "extraction", extractionRuleId: rule.id },
        scope: rule.scope,
        enabled: rule.enabled,
        profileId: rule.profileId,
        meta: { createdAt: timestamp, updatedAt: timestamp },
      };
      await localStore.update("shortcuts", (shortcuts) => ({ ...shortcuts, [shortcut.id]: shortcut }), {});
    }
  } else if (!hasShortcutTrigger && existing) {
    // Trigger no longer includes "shortcut" — remove linked shortcut
    await localStore.update(
      "shortcuts",
      (shortcuts) => Object.fromEntries(Object.entries(shortcuts).filter(([key]) => key !== existing.id)),
      {},
    );
  }

  return { ok: true };
}

/** Delete an extraction rule from local storage and clean up linked shortcut */
export async function handleExtractionRuleDelete(ruleId: EntityId): Promise<{ ok: boolean }> {
  // Remove linked shortcut first
  const linked = await findLinkedShortcut(ruleId);
  if (linked) {
    await localStore.update(
      "shortcuts",
      (shortcuts) => Object.fromEntries(Object.entries(shortcuts).filter(([key]) => key !== linked.id)),
      {},
    );
  }

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
