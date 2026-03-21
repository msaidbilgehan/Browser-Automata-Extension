import { useState, useEffect, useRef, useCallback } from "react";
import { saveDraft, loadDraft, removeDraft } from "../stores/editor-session";

interface UseEditorDraftOptions<T> {
  /** Tab identifier, e.g. "scripts", "shortcuts" */
  tab: string;
  /** Entity ID (generated for new items too) */
  entityId: string;
  /** Whether the entity is being created (not yet persisted) */
  isNew: boolean;
  /** The initial value used to seed the draft state (new or existing entity). */
  initial: T;
  /** The persisted version from the store. Pass null for new entities. */
  saved: T | null;
  /** Debounce interval in ms before writing to session storage. Default: 400 */
  debounceMs?: number;
}

interface UseEditorDraftReturn<T> {
  /** Current draft value. Feed into your form fields. */
  draft: T;
  /** Update the draft. Triggers debounced auto-save to session storage. */
  setDraft: React.Dispatch<React.SetStateAction<T>>;
  /** Whether the draft differs from the saved version. */
  isDirty: boolean;
  /** Whether the draft was restored from session storage on mount. */
  wasRestored: boolean;
  /** Call after a successful save — removes the draft from session storage. */
  commitDraft: () => Promise<void>;
  /** Discard unsaved changes — removes draft and resets to saved version. */
  discardDraft: () => Promise<void>;
}

export function useEditorDraft<T>(options: UseEditorDraftOptions<T>): UseEditorDraftReturn<T> {
  const { tab, entityId, isNew, initial, saved, debounceMs = 400 } = options;

  const [draft, setDraft] = useState<T>(initial);
  const [wasRestored, setWasRestored] = useState(false);

  // Track whether we've completed the initial hydration from session storage
  // to avoid writing the initial value back as a draft.
  const hydratedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs for options to avoid re-running effects on every render
  const tabRef = useRef(tab);
  const entityIdRef = useRef(entityId);
  const isNewRef = useRef(isNew);
  tabRef.current = tab;
  entityIdRef.current = entityId;
  isNewRef.current = isNew;

  // ── Restore draft from session storage on mount ──
  useEffect(() => {
    let cancelled = false;

    void loadDraft(tab, entityId).then((entry) => {
      if (cancelled) return;
      if (entry) {
        setDraft(entry.draft as T);
        setWasRestored(true);
      }
      hydratedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
    // Only run on mount — tab and entityId are stable for a given editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save draft on every change (debounced) ──
  useEffect(() => {
    if (!hydratedRef.current) return;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void saveDraft(tabRef.current, entityIdRef.current, {
        isNew: isNewRef.current,
        draft,
        updatedAt: Date.now(),
      });
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [draft, debounceMs]);

  // ── isDirty ──
  const savedJson = useRef(JSON.stringify(saved));
  savedJson.current = JSON.stringify(saved);

  const isDirty = isNew || JSON.stringify(draft) !== savedJson.current;

  // ── commitDraft: call after successful save ──
  const commitDraft = useCallback(async () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await removeDraft(tabRef.current, entityIdRef.current);
  }, []);

  // ── discardDraft: reset to saved version ──
  const discardDraft = useCallback(async () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await removeDraft(tabRef.current, entityIdRef.current);
    if (saved !== null) {
      setDraft(saved);
    }
  }, [saved]);

  return { draft, setDraft, isDirty, wasRestored, commitDraft, discardDraft };
}
