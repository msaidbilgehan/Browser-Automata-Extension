import { create } from "zustand";
import type { Settings, StateResponse } from "@/shared/types";
import type { EntityId } from "@/shared/types/entities";
import { DEFAULT_SETTINGS } from "@/shared/types";
import { sendToBackground } from "@/shared/messaging";
import { onSyncStorageChange } from "@/shared/storage";

/* ── Tabs visible per view mode ── */
const BASIC_TABS: Set<TabId> = new Set([
  "shortcuts", "flows", "extraction", "templates", "profiles",
  "import-export", "log", "settings",
]);
const ADVANCED_TABS: Set<TabId> = new Set([
  "scripts", "shortcuts", "flows", "log",
  "css-rules", "network-rules", "extraction", "domains",
  "profiles", "templates", "import-export", "health", "settings",
]);

function isTabVisibleInMode(tab: TabId, mode: "basic" | "advanced"): boolean {
  return mode === "basic" ? BASIC_TABS.has(tab) : ADVANCED_TABS.has(tab);
}

const DEFAULT_TAB_FOR_MODE: Record<"basic" | "advanced", TabId> = {
  basic: "templates",
  advanced: "scripts",
};

const SESSION_TAB_KEY = "_activeTab";

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
      void chrome.storage.session.set({ [SESSION_TAB_KEY]: tab });
    },

    initialize: async () => {
      set({ loading: true, error: null });
      try {
        // Try session cache first to avoid message round-trip on rapid popup re-opens
        const SESSION_STATE_KEY = "_cachedState";
        const TTL_MS = 2000;
        const cached = await chrome.storage.session.get(SESSION_STATE_KEY);
        const entry = cached[SESSION_STATE_KEY] as { ts: number; state: StateResponse } | undefined;
        let state: StateResponse;
        if (entry && Date.now() - entry.ts < TTL_MS) {
          state = entry.state;
        } else {
          state = await sendToBackground({ type: "GET_STATE" });
          // Cache for subsequent rapid re-opens
          await chrome.storage.session.set({ [SESSION_STATE_KEY]: { ts: Date.now(), state } });
        }
        // Restore persisted tab if it's visible in the current mode
        const settings = mergeWithDefaults(state.settings);
        const tabCache = await chrome.storage.session.get(SESSION_TAB_KEY);
        const savedTab = tabCache[SESSION_TAB_KEY] as TabId | undefined;
        const viewMode = settings.ui.viewMode;
        const activeTab = savedTab && isTabVisibleInMode(savedTab, viewMode)
          ? savedTab
          : DEFAULT_TAB_FOR_MODE[viewMode];

        set({
          settings,
          counts: state.counts,
          activeProfileId: state.activeProfileId,
          activeTab,
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
      const { settings, activeTab } = get();
      try {
        await sendToBackground({ type: "SETTINGS_UPDATE", settings: partial });
        const merged = {
          ...settings,
          ...partial,
          logging: { ...settings.logging, ...partial.logging },
          ui: { ...settings.ui, ...partial.ui },
          execution: { ...settings.execution, ...partial.execution },
          feedback: { ...settings.feedback, ...partial.feedback },
        };
        // If viewMode changed, reset active tab if it's not visible in the new mode
        const newMode = merged.ui.viewMode;
        const update: Partial<AppState> = { settings: merged };
        if (newMode !== settings.ui.viewMode && !isTabVisibleInMode(activeTab, newMode)) {
          update.activeTab = DEFAULT_TAB_FOR_MODE[newMode];
        }
        set(update);
      } catch (err) {
        set({ error: String(err) });
      }
    },
  };
});
