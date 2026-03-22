import { localStore } from "@/shared/storage";
import type { KeyCombo, Shortcut } from "@/shared/types/entities";
import { scopesOverlap } from "@/shared/url-pattern";

/** Known browser keyboard shortcuts that should trigger warnings */
const BROWSER_SHORTCUTS: string[] = [
  "Ctrl+T",
  "Ctrl+W",
  "Ctrl+N",
  "Ctrl+Shift+T",
  "Ctrl+Shift+N",
  "Ctrl+Tab",
  "Ctrl+Shift+Tab",
  "Ctrl+L",
  "Ctrl+D",
  "Ctrl+H",
  "Ctrl+J",
  "Ctrl+S",
  "Ctrl+P",
  "Ctrl+F",
  "Ctrl+G",
  "Ctrl+R",
  "Ctrl+Shift+R",
  "F5",
  "F11",
  "F12",
  "Alt+F4",
  "Ctrl+Shift+I",
  "Ctrl+Shift+J",
];

export interface ConflictWarning {
  type: "browser" | "extension";
  message: string;
  conflictingShortcutId?: string;
}

/** Serialize a KeyCombo to a human-readable string for comparison */
export function serializeKeyCombo(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.ctrlKey) parts.push("Ctrl");
  if (combo.altKey) parts.push("Alt");
  if (combo.shiftKey) parts.push("Shift");
  if (combo.metaKey) parts.push("Meta");
  parts.push(combo.key);
  return parts.join("+");
}

/**
 * Check if a shortcut has conflicts with browser defaults or other extension shortcuts.
 * Returns warnings (non-blocking).
 */
export async function detectConflicts(shortcut: Shortcut): Promise<ConflictWarning[]> {
  const warnings: ConflictWarning[] = [];

  // Only check single key combos (not chords) for browser conflicts
  if ("key" in shortcut.keyCombo) {
    const serialized = serializeKeyCombo(shortcut.keyCombo);

    // Check against browser defaults
    if (BROWSER_SHORTCUTS.includes(serialized)) {
      warnings.push({
        type: "browser",
        message: `${serialized} conflicts with a browser default shortcut`,
      });
    }
  }

  // Check against other extension shortcuts in overlapping scopes
  const shortcuts = (await localStore.get("shortcuts")) ?? {};
  for (const existing of Object.values(shortcuts)) {
    if (existing.id === shortcut.id) continue;
    if (!existing.enabled) continue;

    // Check if scopes overlap (simplified: if either could match the other's scope)
    if (!scopesOverlap(shortcut.scope, existing.scope)) continue;

    if (keyComboEquals(shortcut.keyCombo, existing.keyCombo)) {
      warnings.push({
        type: "extension",
        message: `Conflicts with shortcut "${existing.name}" in overlapping scope`,
        conflictingShortcutId: existing.id,
      });
    }
  }

  return warnings;
}

/** Check if two key combos are the same */
function keyComboEquals(
  a: KeyCombo | { sequence: KeyCombo[] },
  b: KeyCombo | { sequence: KeyCombo[] },
): boolean {
  // Both must be the same type (single vs chord)
  const aIsChord = "sequence" in a;
  const bIsChord = "sequence" in b;
  if (aIsChord !== bIsChord) return false;

  if (!aIsChord && !bIsChord) {
    return (
      a.key === b.key &&
      a.ctrlKey === b.ctrlKey &&
      a.shiftKey === b.shiftKey &&
      a.altKey === b.altKey &&
      a.metaKey === b.metaKey
    );
  }

  // Chord comparison
  const aSeq = (a as { sequence: KeyCombo[] }).sequence;
  const bSeq = (b as { sequence: KeyCombo[] }).sequence;
  if (aSeq.length !== bSeq.length) return false;
  return aSeq.every((ac, i) => {
    const bc = bSeq[i];
    return bc !== undefined && keyComboEquals(ac, bc);
  });
}

