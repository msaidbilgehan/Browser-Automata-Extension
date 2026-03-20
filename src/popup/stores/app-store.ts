import { create } from "zustand";
import type { Settings, StateResponse } from "@/shared/types";
import type { EntityId } from "@/shared/types/entities";
import { DEFAULT_SETTINGS } from "@/shared/types";
import { sendToBackground } from "@/shared/messaging";
import { onSyncStorageChange } from "@/shared/storage";

function mergeWithDefaults(stored: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    logging: { ...DEFAULT_SETTINGS.logging, ...stored.logging },
    ui: { ...DEFAULT_SETTINGS.ui, ...stored.ui },
    execution: { ...DEFAULT_SETTINGS.execution, ...stored.execution },
    feedback: { ...DEFAULT_SETTINGS.feedback, ...stored.feedback },
  };
}

export type TabId =
  | "scripts"
  | "shortcuts"
  | "flows"
  | "log"
  | "settings"
  | "css-rules"
  | "network-rules"
  | "extraction"
  | "domains"
  | "profiles"
  | "templates"
  | "import-export"
  | "health";

interface AppState {
  /** Currently active bottom tab */
  activeTab: TabId;
  /** Current settings */
  settings: Settings;
  /** Entity counts from background */
  counts: StateResponse["counts"];
  /** Active profile ID from background */
  activeProfileId: EntityId | null;
  /** Whether initial state has loaded */
  initialized: boolean;
  /** Loading state */
  loading: boolean;
  /** Last error message */
  error: string | null;

  /** Actions */
  setActiveTab: (tab: TabId) => void;
  initialize: () => Promise<void>;
  toggleGlobalEnabled: () => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => {
  onSyncStorageChange("settings", (newValue) => {
    if (newValue) set({ settings: mergeWithDefaults(newValue) });
  });

  return {
    activeTab: "scripts",
    settings: DEFAULT_SETTINGS,
    counts: {
      scripts: 0,
      shortcuts: 0,
      flows: 0,
      cssRules: 0,
      extractionRules: 0,
      networkRules: 0,
      profiles: 0,
    },
    activeProfileId: null,
    initialized: false,
    loading: false,
    error: null,

    setActiveTab: (tab) => {
      set({ activeTab: tab });
    },

    initialize: async () => {
      set({ loading: true, error: null });
      try {
        const state = await sendToBackground({ type: "GET_STATE" });
        set({
          settings: mergeWithDefaults(state.settings),
          counts: state.counts,
          activeProfileId: state.activeProfileId,
          initialized: true,
          loading: false,
        });
      } catch (err) {
        set({ error: String(err), loading: false, initialized: true });
      }
    },

    toggleGlobalEnabled: async () => {
      const { settings } = get();
      const newEnabled = !settings.globalEnabled;
      try {
        await sendToBackground({
          type: "SETTINGS_UPDATE",
          settings: { globalEnabled: newEnabled },
        });
        set({
          settings: { ...settings, globalEnabled: newEnabled },
        });
      } catch (err) {
        set({ error: String(err) });
      }
    },

    updateSettings: async (partial) => {
      const { settings } = get();
      try {
        await sendToBackground({ type: "SETTINGS_UPDATE", settings: partial });
        set({
          settings: {
            ...settings,
            ...partial,
            logging: { ...settings.logging, ...partial.logging },
            ui: { ...settings.ui, ...partial.ui },
            execution: { ...settings.execution, ...partial.execution },
            feedback: { ...settings.feedback, ...partial.feedback },
          },
        });
      } catch (err) {
        set({ error: String(err) });
      }
    },
  };
});
