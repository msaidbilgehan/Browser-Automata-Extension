import type { EntityId, KeyCombo } from "./entities";

/** Quick Run bar position anchor */
export type QuickRunBarPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface Settings {
  globalEnabled: boolean;
  activeProfileId: EntityId | null;
  logging: {
    level: "debug" | "info" | "warn" | "error" | "off";
    maxEntries: number;
  };
  ui: {
    theme: "system" | "light" | "dark";
    iconColor: "dark" | "white" | "system";
    iconTransparent: boolean;
    confirmBeforeRun: boolean;
    viewMode: "basic" | "advanced";
  };
  execution: {
    scriptTimeoutMs: number;
    injectIntoIframes: boolean;
    chordTimeoutMs: number;
  };
  feedback: {
    toastEnabled: boolean;
    toastDismissMode: "delay" | "key_release";
    toastDurationMs: number;
    highlightEnabled: boolean;
  };
  quickRun: {
    barEnabled: boolean;
    /** KeyCombo for toggling the in-page floating bar visibility */
    toggleShortcut: KeyCombo | null;
    /** Whether the popup shows the docked Quick Run bar */
    showInPopup: boolean;
    /** Bar position preference: which edge to dock to in-page */
    barPosition: QuickRunBarPosition;
    /** Persisted drag offset from the default anchor (pixels) */
    barOffsetX: number;
    barOffsetY: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  globalEnabled: true,
  activeProfileId: null,
  logging: {
    level: "info",
    maxEntries: 5000,
  },
  ui: {
    theme: "dark",
    iconColor: "system",
    iconTransparent: false,
    confirmBeforeRun: false,
    viewMode: "basic",
  },
  execution: {
    scriptTimeoutMs: 30_000,
    injectIntoIframes: false,
    chordTimeoutMs: 500,
  },
  feedback: {
    toastEnabled: true,
    toastDismissMode: "key_release",
    toastDurationMs: 3000,
    highlightEnabled: true,
  },
  quickRun: {
    barEnabled: true,
    toggleShortcut: { key: "q", ctrlKey: false, shiftKey: false, altKey: true, metaKey: false },
    showInPopup: true,
    barPosition: "bottom-right",
    barOffsetX: 0,
    barOffsetY: 0,
  },
};
