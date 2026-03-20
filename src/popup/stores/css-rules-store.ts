import { create } from "zustand";
import type { CSSRule, EntityId } from "@/shared/types/entities";
import { sendToBackground } from "@/shared/messaging";
import { localStore, onStorageChange } from "@/shared/storage";

interface CSSRulesState {
  cssRules: Record<string, CSSRule>;
  loading: boolean;
  editingId: EntityId | null;

  load: () => Promise<void>;
  save: (rule: CSSRule) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
  setEditing: (id: EntityId | null) => void;
}

export const useCSSRulesStore = create<CSSRulesState>((set) => {
  onStorageChange("cssRules", (newValue) => {
    if (newValue) set({ cssRules: newValue });
  });

  return {
    cssRules: {},
    loading: false,
    editingId: null,

    load: async () => {
      set({ loading: true });
      const cssRules = (await localStore.get("cssRules")) ?? {};
      set({ cssRules, loading: false });
    },

    save: async (rule) => {
      await sendToBackground({ type: "CSS_RULE_SAVE", cssRule: rule });
      set((state) => ({
        cssRules: { ...state.cssRules, [rule.id]: rule },
      }));
    },

    remove: async (id) => {
      await sendToBackground({ type: "CSS_RULE_DELETE", cssRuleId: id });
      set((state) => {
        const next = { ...state.cssRules };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[id];
        return { cssRules: next, editingId: state.editingId === id ? null : state.editingId };
      });
    },

    setEditing: (id) => {
      set({ editingId: id });
    },
  };
});
