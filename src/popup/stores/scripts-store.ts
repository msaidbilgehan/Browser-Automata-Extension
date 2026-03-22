import { create } from "zustand";
import type { Script, EntityId } from "@/shared/types/entities";
import type { ScriptRunResult } from "@/shared/types/script-run";
import { sendToBackground } from "@/shared/messaging";
import { localStore, onStorageChange } from "@/shared/storage";

interface ScriptsState {
  scripts: Record<string, Script>;
  loading: boolean;
  editingId: EntityId | null;

  load: () => Promise<void>;
  save: (script: Script) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
  toggle: (id: EntityId, enabled: boolean) => Promise<void>;
  runNow: (id: EntityId) => Promise<ScriptRunResult>;
  setEditing: (id: EntityId | null) => void;
}

export const useScriptsStore = create<ScriptsState>((set, get) => {
  // Subscribe to storage changes for reactive updates
  onStorageChange("scripts", (newValue) => {
    if (newValue) set({ scripts: newValue });
  });

  return {
    scripts: {},
    loading: false,
    editingId: null,

    load: async () => {
      set({ loading: true });
      const scripts = (await localStore.get("scripts")) ?? {};
      set({ scripts, loading: false });
    },

    save: async (script) => {
      await sendToBackground({ type: "SCRIPT_SAVE", script });
      set((state) => ({
        scripts: { ...state.scripts, [script.id]: script },
      }));
    },

    remove: async (id) => {
      await sendToBackground({ type: "SCRIPT_DELETE", scriptId: id });
      set((state) => {
        const next = { ...state.scripts };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[id];
        return { scripts: next, editingId: state.editingId === id ? null : state.editingId };
      });
    },

    toggle: async (id, enabled) => {
      await sendToBackground({ type: "SCRIPT_TOGGLE", scriptId: id, enabled });
      const { scripts } = get();
      const script = scripts[id];
      if (script) {
        set((state) => ({
          scripts: { ...state.scripts, [id]: { ...script, enabled } },
        }));
      }
    },

    runNow: async (id) => {
      const response = await sendToBackground({ type: "SCRIPT_RUN_NOW", scriptId: id });
      return response;
    },

    setEditing: (id) => {
      set({ editingId: id });
    },
  };
});
