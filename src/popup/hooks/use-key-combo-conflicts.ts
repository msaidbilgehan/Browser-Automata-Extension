import { useState, useEffect } from "react";
import type { KeyCombo, UrlPattern, EntityId } from "@/shared/types/entities";
import { localStore } from "@/shared/storage";
import { serializeKeyCombo, type ConflictWarning } from "@/background/services/conflict-detector";

/** Known browser keyboard shortcuts that should trigger warnings */
const BROWSER_SHORTCUTS: string[] = [
  "Ctrl+T", "Ctrl+W", "Ctrl+N", "Ctrl+Shift+T", "Ctrl+Shift+N",
  "Ctrl+Tab", "Ctrl+Shift+Tab", "Ctrl+L", "Ctrl+D", "Ctrl+H",
  "Ctrl+J", "Ctrl+S", "Ctrl+P", "Ctrl+F", "Ctrl+G", "Ctrl+R",
  "Ctrl+Shift+R", "F5", "F11", "F12", "Alt+F4",
  "Ctrl+Shift+I", "Ctrl+Shift+J",
];

function keyComboEquals(a: KeyCombo, b: KeyCombo): boolean {
  return (
    a.key === b.key &&
    a.ctrlKey === b.ctrlKey &&
    a.shiftKey === b.shiftKey &&
    a.altKey === b.altKey &&
    a.metaKey === b.metaKey
  );
}

function scopesOverlap(a: UrlPattern, b: UrlPattern): boolean {
  if (a.type === "global" || b.type === "global") return true;
  if (a.type === b.type && a.value === b.value) return true;
  if (a.type === "exact" && b.type === "exact") return a.value === b.value;
  return true;
}

/**
 * Hook that detects key combo conflicts with browser shortcuts and
 * other extension shortcuts. Checks both explicit shortcuts and
 * extraction rules with shortcut triggers.
 */
export function useKeyComboConflicts(
  combo: KeyCombo | null | undefined,
  scope: UrlPattern,
  excludeId: EntityId,
): ConflictWarning[] {
  const [warnings, setWarnings] = useState<ConflictWarning[]>([]);

  useEffect(() => {
    if (!combo?.key) {
      setWarnings([]);
      return;
    }

    let cancelled = false;

    async function check() {
      if (!combo?.key) return;
      const results: ConflictWarning[] = [];

      // Check browser defaults
      const serialized = serializeKeyCombo(combo);
      if (BROWSER_SHORTCUTS.includes(serialized)) {
        results.push({
          type: "browser",
          message: `"${serialized}" conflicts with a browser default shortcut`,
        });
      }

      // Check other extension shortcuts
      const shortcuts = (await localStore.get("shortcuts")) ?? {};
      for (const existing of Object.values(shortcuts)) {
        if (existing.id === excludeId) continue;
        if (!existing.enabled) continue;
        if (!scopesOverlap(scope, existing.scope)) continue;
        if ("key" in existing.keyCombo && keyComboEquals(combo, existing.keyCombo)) {
          results.push({
            type: "extension",
            message: `Conflicts with shortcut "${existing.name || "Untitled"}" in overlapping scope`,
            conflictingShortcutId: existing.id,
          });
        }
      }

      // Check extraction rules with shortcut triggers
      const extractionRules = (await localStore.get("extractionRules")) ?? {};
      for (const rule of Object.values(extractionRules)) {
        if (rule.id === excludeId) continue;
        if (!rule.enabled) continue;
        if (!rule.shortcutKeyCombo) continue;
        if (!rule.triggers.includes("shortcut")) continue;
        if (!scopesOverlap(scope, rule.scope)) continue;
        if (keyComboEquals(combo, rule.shortcutKeyCombo)) {
          results.push({
            type: "extension",
            message: `Conflicts with extraction rule "${rule.name || "Untitled"}" shortcut`,
          });
        }
      }

      if (!cancelled) setWarnings(results);
    }

    void check();
    return () => { cancelled = true; };
  }, [combo, scope, excludeId]);

  return warnings;
}
