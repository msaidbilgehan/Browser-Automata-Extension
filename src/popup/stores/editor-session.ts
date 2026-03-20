/**
 * Persists editor draft state to chrome.storage.session so that the popup
 * can restore the editor after closing (e.g. during element picking).
 *
 * Session storage survives popup close/reopen within the same browser session
 * but is cleared when the browser is closed.
 */

import type { TabId } from "./app-store";

const SESSION_KEY = "_editorDraft";

export interface EditorDraft {
  /** Which tab was active */
  tab: TabId;
  /** Whether the user was creating a new entity */
  isNew: boolean;
  /** For existing entities, the ID being edited */
  editingId: string | undefined;
  /** The serialized draft object (entity-specific) */
  draft: unknown;
}

/** Save the current editor context before element picking closes the popup. */
export async function saveEditorDraft(context: EditorDraft): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: context });
}

/** Read and consume a pending editor draft (returns null if none). */
export async function loadEditorDraft(): Promise<EditorDraft | null> {
  const result = await chrome.storage.session.get(SESSION_KEY);
  const draft = result[SESSION_KEY] as EditorDraft | undefined;
  if (draft) {
    await chrome.storage.session.remove(SESSION_KEY);
    return draft;
  }
  return null;
}
