/**
 * Script version history (F16e).
 * Saves version snapshots of script code and supports rollback.
 */

import { localStore } from "@/shared/storage";
import { now } from "@/shared/utils";
import { DEFAULTS } from "@/shared/constants";
import type { EntityId, ScriptVersion } from "@/shared/types/entities";

/**
 * Save a version snapshot for a script.
 * Maintains a maximum of DEFAULTS.MAX_SCRIPT_VERSIONS versions per script,
 * trimming the oldest entries when the limit is exceeded.
 */
export async function saveVersion(scriptId: EntityId, code: string, note?: string): Promise<void> {
  await localStore.update(
    "scriptVersions",
    (allVersions) => {
      const existing = allVersions[scriptId] ?? [];

      // Determine next version number
      const maxVersion = existing.reduce((max, v) => (v.version > max ? v.version : max), 0);

      const newVersion: ScriptVersion = {
        scriptId,
        version: maxVersion + 1,
        code,
        savedAt: now(),
        ...(note ? { changeNote: note } : {}),
      };

      const updated = [...existing, newVersion];

      // Trim to max versions (keep most recent)
      const trimmed =
        updated.length > DEFAULTS.MAX_SCRIPT_VERSIONS
          ? updated.slice(updated.length - DEFAULTS.MAX_SCRIPT_VERSIONS)
          : updated;

      return { ...allVersions, [scriptId]: trimmed };
    },
    {},
  );
}

/** Get all version snapshots for a script, ordered by version number. */
export async function getVersions(scriptId: EntityId): Promise<ScriptVersion[]> {
  const allVersions = await localStore.get("scriptVersions");
  if (!allVersions) return [];

  const versions = allVersions[scriptId];
  if (!versions) return [];

  return [...versions].sort((a, b) => a.version - b.version);
}

/**
 * Rollback a script to a specific version.
 * Restores the script code from the version snapshot and saves it.
 */
export async function rollback(scriptId: EntityId, version: number): Promise<void> {
  const versions = await getVersions(scriptId);
  const target = versions.find((v) => v.version === version);

  if (!target) {
    throw new Error(`Version ${String(version)} not found for script ${scriptId}`);
  }

  // Update the script's code with the version's code
  await localStore.update(
    "scripts",
    (scripts) => {
      const script = scripts[scriptId];
      if (!script) return scripts;
      return {
        ...scripts,
        [scriptId]: {
          ...script,
          code: target.code,
          meta: { ...script.meta, updatedAt: now(), version: script.meta.version + 1 },
        },
      };
    },
    {},
  );

  // Save the rollback as a new version entry
  await saveVersion(scriptId, target.code, `Rollback to version ${String(version)}`);
}
