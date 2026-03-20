import { create } from "zustand";
import type { Shortcut, EntityId } from "@/shared/types/entities";
import { sendToBackground } from "@/shared/messaging";
import { localStore, onStorageChange } from "@/shared/storage";

interface ShortcutsState {
  shortcuts: Record<string, Shortcut>;
  loading: boolean;
  editingId: EntityId | null;

  load: () => Promise<void>;
  save: (shortcut: Shortcut) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
  toggle: (id: EntityId, enabled: boolean) => Promise<void>;
  setEditing: (id: EntityId | null) => void;
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => {
  onStorageChange("shortcuts", (newValue) => {
    if (newValue) set({ shortcuts: newValue });
  });

  return {
    shortcuts: {},
    loading: false,
    editingId: null,

    load: async () => {
      set({ loading: true });
      const shortcuts = (await localStore.get("shortcuts")) ?? {};
      set({ shortcuts, loading: false });
    },

    save: async (shortcut) => {
      await sendToBackground({ type: "SHORTCUT_SAVE", shortcut });
      set((state) => ({
        shortcuts: { ...state.shortcuts, [shortcut.id]: shortcut },
      }));
    },

    remove: async (id) => {
      await sendToBackground({ type: "SHORTCUT_DELETE", shortcutId: id });
      set((state) => {
        const next = { ...state.shortcuts };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[id];
        return { shortcuts: next, editingId: state.editingId === id ? null : state.editingId };
      });
    },

    toggle: async (id, enabled) => {
      await sendToBackground({ type: "SHORTCUT_TOGGLE", shortcutId: id, enabled });
      const { shortcuts } = get();
      const shortcut = shortcuts[id];
      if (shortcut) {
        set((state) => ({
          shortcuts: { ...state.shortcuts, [id]: { ...shortcut, enabled } },
        }));
      }
    },

    setEditing: (id) => {
      set({ editingId: id });
    },
  };
});
