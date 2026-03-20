import { localStore } from "@/shared/storage";
import { fillForm } from "@/background/services/form-filler";
import type { FormFillProfile, EntityId } from "@/shared/types/entities";

/**
 * Save a FormFillProfile to local storage.
 */
export async function handleFormFillSave(profile: FormFillProfile): Promise<{ ok: boolean }> {
  await localStore.update(
    "formFillProfiles",
    (profiles) => ({ ...profiles, [profile.id]: profile }),
    {},
  );
  return { ok: true };
}

/**
 * Delete a FormFillProfile from local storage.
 */
export async function handleFormFillDelete(profileId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "formFillProfiles",
    (profiles) => {
      const updated = { ...profiles };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete updated[profileId];
      return updated;
    },
    {},
  );
  return { ok: true };
}

/**
 * Run a FormFillProfile on the currently active tab.
 */
export async function handleFormFillRun(
  profileId: EntityId,
): Promise<{ ok: boolean; filled?: number; skipped?: number; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "No active tab" };
  }

  try {
    const result = await fillForm(tab.id, profileId);
    return { ok: true, filled: result.filled, skipped: result.skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
