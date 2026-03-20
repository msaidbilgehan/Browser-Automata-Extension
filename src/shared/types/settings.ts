import type { EntityId } from "./entities";

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
};
