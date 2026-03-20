import { localStore } from "@/shared/storage";
import { switchProfile } from "@/background/services/profile-manager";
import type { Profile, EntityId } from "@/shared/types/entities";

/** Save a profile to local storage */
export async function handleProfileSave(profile: Profile): Promise<{ ok: boolean }> {
  await localStore.update("profiles", (profiles) => ({ ...profiles, [profile.id]: profile }), {});
  return { ok: true };
}

/** Delete a profile from local storage */
export async function handleProfileDelete(profileId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "profiles",
    (profiles) => {
      return Object.fromEntries(Object.entries(profiles).filter(([key]) => key !== profileId));
    },
    {},
  );
  return { ok: true };
}

/** Switch active profile (delegates to profile-manager) */
export async function handleProfileSwitch(profileId: EntityId | null): Promise<{ ok: boolean }> {
  return switchProfile(profileId);
}
