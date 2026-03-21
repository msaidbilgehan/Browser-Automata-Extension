import { create } from "zustand";
import type { ExtractionRule, EntityId } from "@/shared/types/entities";
import type { ExtractionRunResponse } from "@/shared/types/messages";
import { sendToBackground } from "@/shared/messaging";
import { localStore, onStorageChange } from "@/shared/storage";

interface ExtractionRulesState {
  extractionRules: Record<string, ExtractionRule>;
  loading: boolean;
  editingId: EntityId | null;
  lastResult: ExtractionRunResponse | null;

  load: () => Promise<void>;
  save: (rule: ExtractionRule) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
  runNow: (id: EntityId) => Promise<ExtractionRunResponse>;
  setEditing: (id: EntityId | null) => void;
  clearResult: () => void;
}

export const useExtractionRulesStore = create<ExtractionRulesState>((set) => {
  onStorageChange("extractionRules", (newValue) => {
    if (newValue) set({ extractionRules: newValue });
  });

  return {
    extractionRules: {},
    loading: false,
    editingId: null,
    lastResult: null,

    load: async () => {
      set({ loading: true });
      const extractionRules = (await localStore.get("extractionRules")) ?? {};
      set({ extractionRules, loading: false });
    },

    save: async (rule) => {
      await sendToBackground({ type: "EXTRACTION_RULE_SAVE", rule });
      set((state) => ({
        extractionRules: { ...state.extractionRules, [rule.id]: rule },
      }));
    },

    remove: async (id) => {
      await sendToBackground({ type: "EXTRACTION_RULE_DELETE", ruleId: id });
      set((state) => {
        const next = { ...state.extractionRules };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[id];
        return {
          extractionRules: next,
          editingId: state.editingId === id ? null : state.editingId,
        };
      });
    },

    runNow: async (id) => {
      const raw = await sendToBackground({ type: "EXTRACTION_RUN_NOW", ruleId: id });
      // Guard against undefined responses (service worker messaging edge cases)
      const result = raw ?? { ok: false, error: "No response from background" };
      set({ lastResult: result });
      return result;
    },

    setEditing: (id) => {
      set({ editingId: id });
    },

    clearResult: () => {
      set({ lastResult: null });
    },
  };
});
