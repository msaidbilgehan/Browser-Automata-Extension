import { syncStore } from "@/shared/storage";
import { DEFAULT_SETTINGS } from "@/shared/types/settings";
import type { EntityId } from "@/shared/types/entities";

/**
 * Switch the active profile. Pass null to deactivate all profiles.
 */
export async function switchProfile(profileId: EntityId | null): Promise<{ ok: boolean }> {
  const settings = (await syncStore.get("settings")) ?? DEFAULT_SETTINGS;
  await syncStore.set("settings", {
    ...settings,
    activeProfileId: profileId,
  });
  return { ok: true };
}

/**
 * Read the currently active profile ID from settings.
 */
export async function getActiveProfileId(): Promise<EntityId | null> {
  const settings = (await syncStore.get("settings")) ?? DEFAULT_SETTINGS;
  return settings.activeProfileId;
}
