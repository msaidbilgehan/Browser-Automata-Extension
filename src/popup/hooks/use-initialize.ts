import { useEffect } from "react";
import { useAppStore, type TabId } from "../stores/app-store";

const SESSION_KEY = "_editorDraft";

/** Initialize the app store on mount (load state from background) */
export function useInitialize(): void {
  const initialized = useAppStore((s) => s.initialized);
  const initialize = useAppStore((s) => s.initialize);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  useEffect(() => {
    if (!initialized) {
      void initialize();

      // If there's a pending editor draft (e.g. from element picking),
      // restore the active tab so the correct view loads and can consume it.
      void chrome.storage.session.get(SESSION_KEY).then((result: Record<string, unknown>) => {
        const draft = result[SESSION_KEY] as { tab?: TabId } | undefined;
        if (draft?.tab) {
          setActiveTab(draft.tab);
        }
      });
    }
  }, [initialized, initialize, setActiveTab]);
}
