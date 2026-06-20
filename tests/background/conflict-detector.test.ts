import { describe, it, expect } from "vitest";
import {
  serializeKeyCombo,
  BROWSER_SHORTCUTS,
} from "@/background/services/conflict-detector";
import type { KeyCombo } from "@/shared/types/entities";

function combo(overrides: Partial<KeyCombo>): KeyCombo {
  return {
    key: "",
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...overrides,
  };
}

describe("serializeKeyCombo", () => {
  it("upper-cases a single-character letter key (DOM e.key is lowercase)", () => {
    expect(serializeKeyCombo(combo({ key: "s", ctrlKey: true }))).toBe("Ctrl+S");
  });

  it("orders modifiers Ctrl, Alt, Shift, Meta", () => {
    expect(
      serializeKeyCombo(
        combo({ key: "k", ctrlKey: true, altKey: true, shiftKey: true, metaKey: true }),
      ),
    ).toBe("Ctrl+Alt+Shift+Meta+K");
  });

  it("leaves named (multi-character) keys untouched", () => {
    expect(serializeKeyCombo(combo({ key: "Tab", ctrlKey: true }))).toBe("Ctrl+Tab");
    expect(serializeKeyCombo(combo({ key: "F5" }))).toBe("F5");
  });

  it("produces a string that matches the browser-shortcut warning list for letter combos", () => {
    // The M11 regression: 'Ctrl+s' never matched 'Ctrl+S' in BROWSER_SHORTCUTS.
    expect(BROWSER_SHORTCUTS.includes(serializeKeyCombo(combo({ key: "s", ctrlKey: true })))).toBe(
      true,
    );
    expect(BROWSER_SHORTCUTS.includes(serializeKeyCombo(combo({ key: "w", ctrlKey: true })))).toBe(
      true,
    );
  });
});
