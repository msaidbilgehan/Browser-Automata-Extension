import { localStore } from "@/shared/storage";
import type { Script, EntityId } from "@/shared/types/entities";

/** Handle SCRIPT_SAVE: create or update a script */
export async function handleScriptSave(script: Script): Promise<{ ok: boolean }> {
  await localStore.update("scripts", (scripts) => ({ ...scripts, [script.id]: script }), {});
  return { ok: true };
}

/** Handle SCRIPT_DELETE: remove a script by ID */
export async function handleScriptDelete(scriptId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "scripts",
    (scripts) => {
      const next = { ...scripts };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete next[scriptId];
      return next;
    },
    {},
  );
  return { ok: true };
}

/** Handle SCRIPT_TOGGLE: enable/disable a script */
export async function handleScriptToggle(
  scriptId: EntityId,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  await localStore.update(
    "scripts",
    (scripts) => {
      const script = scripts[scriptId];
      if (!script) return scripts;
      return { ...scripts, [scriptId]: { ...script, enabled } };
    },
    {},
  );
  return { ok: true };
}
