import { localStore, syncStore } from "@/shared/storage";
import { DEFAULT_SETTINGS } from "@/shared/types/settings";
import type { Settings } from "@/shared/types/settings";
import type { StateResponse } from "@/shared/types/messages";

/** Handle GET_STATE: return settings and entity counts */
export async function handleGetState(): Promise<StateResponse> {
  const stored = await syncStore.get("settings");
  const settings: Settings = stored
    ? {
        ...DEFAULT_SETTINGS,
        ...stored,
        logging: { ...DEFAULT_SETTINGS.logging, ...stored.logging },
        ui: { ...DEFAULT_SETTINGS.ui, ...stored.ui },
        execution: { ...DEFAULT_SETTINGS.execution, ...stored.execution },
        feedback: { ...DEFAULT_SETTINGS.feedback, ...stored.feedback },
      }
    : DEFAULT_SETTINGS;
  const scripts = (await localStore.get("scripts")) ?? {};
  const shortcuts = (await localStore.get("shortcuts")) ?? {};
  const flows = (await localStore.get("flows")) ?? {};
  const cssRules = (await localStore.get("cssRules")) ?? {};
  const extractionRules = (await localStore.get("extractionRules")) ?? {};
  const networkRules = (await localStore.get("networkRules")) ?? {};
  const profiles = (await localStore.get("profiles")) ?? {};

  return {
    settings,
    counts: {
      scripts: Object.keys(scripts).length,
      shortcuts: Object.keys(shortcuts).length,
      flows: Object.keys(flows).length,
      cssRules: Object.keys(cssRules).length,
      extractionRules: Object.keys(extractionRules).length,
      networkRules: Object.keys(networkRules).length,
      profiles: Object.keys(profiles).length,
    },
    activeProfileId: settings.activeProfileId,
  };
}
