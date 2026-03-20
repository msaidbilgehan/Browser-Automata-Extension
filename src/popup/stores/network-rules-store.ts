import { create } from "zustand";
import type { NetworkRule, EntityId } from "@/shared/types/entities";
import { sendToBackground } from "@/shared/messaging";
import { localStore, onStorageChange } from "@/shared/storage";

interface NetworkRulesState {
  networkRules: Record<string, NetworkRule>;
  loading: boolean;
  editingId: EntityId | null;

  load: () => Promise<void>;
  save: (rule: NetworkRule) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
  setEditing: (id: EntityId | null) => void;
}

export const useNetworkRulesStore = create<NetworkRulesState>((set) => {
  onStorageChange("networkRules", (newValue) => {
    if (newValue) set({ networkRules: newValue });
  });

  return {
    networkRules: {},
    loading: false,
    editingId: null,

    load: async () => {
      set({ loading: true });
      const networkRules = (await localStore.get("networkRules")) ?? {};
      set({ networkRules, loading: false });
    },

    save: async (rule) => {
      await sendToBackground({ type: "NETWORK_RULE_SAVE", rule });
      set((state) => ({
        networkRules: { ...state.networkRules, [rule.id]: rule },
      }));
    },

    remove: async (id) => {
      await sendToBackground({ type: "NETWORK_RULE_DELETE", ruleId: id });
      set((state) => {
        const next = { ...state.networkRules };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[id];
        return { networkRules: next, editingId: state.editingId === id ? null : state.editingId };
      });
    },

    setEditing: (id) => {
      set({ editingId: id });
    },
  };
});
