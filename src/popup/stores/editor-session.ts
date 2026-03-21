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

/** Remove the persisted draft (call on explicit editor exit before popup closes). */
export async function clearEditorDraft(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEY);
}

// ─── Persistent Draft Auto-Save ──────────────────────────────────────────────
// Separate from the element-picker draft above. These persist editor field
// values across popup close/reopen and tab navigation so work is never lost.
// Each tab gets its own session-storage key: "_drafts_scripts", "_drafts_flows", etc.

export interface DraftEntry {
  isNew: boolean;
  draft: unknown;
  updatedAt: number;
}

type DraftMap = Record<string, DraftEntry>;

function draftKey(tab: string): string {
  return `_drafts_${tab}`;
}

/** Save or update a single entity draft. */
export async function saveDraft(tab: string, entityId: string, entry: DraftEntry): Promise<void> {
  const key = draftKey(tab);
  const result = await chrome.storage.session.get(key);
  const map: DraftMap = (result[key] as DraftMap | undefined) ?? {};
  map[entityId] = entry;
  await chrome.storage.session.set({ [key]: map });
}

/** Load a single entity draft. Returns null if none exists. */
export async function loadDraft(tab: string, entityId: string): Promise<DraftEntry | null> {
  const key = draftKey(tab);
  const result = await chrome.storage.session.get(key);
  const map: DraftMap = (result[key] as DraftMap | undefined) ?? {};
  return map[entityId] ?? null;
}

/** Remove a single entity draft (on Save or Discard). */
export async function removeDraft(tab: string, entityId: string): Promise<void> {
  const key = draftKey(tab);
  const result = await chrome.storage.session.get(key);
  const map: DraftMap = (result[key] as DraftMap | undefined) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete map[entityId];
  await chrome.storage.session.set({ [key]: map });
}

/** Load all drafts for a tab (for showing indicators in list view). */
export async function loadAllDrafts(tab: string): Promise<DraftMap> {
  const key = draftKey(tab);
  const result = await chrome.storage.session.get(key);
  return (result[key] as DraftMap | undefined) ?? {};
}
