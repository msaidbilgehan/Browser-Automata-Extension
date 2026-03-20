import { localStore } from "@/shared/storage";
import type { ScriptVariable, EntityId } from "@/shared/types/entities";

/** Handle VARIABLE_SAVE: create or update a script variable */
export async function handleVariableSave(variable: ScriptVariable): Promise<{ ok: boolean }> {
  await localStore.update(
    "variables",
    (variables) => ({ ...variables, [variable.id]: variable }),
    {},
  );
  return { ok: true };
}

/** Handle VARIABLE_DELETE: remove a script variable by ID */
export async function handleVariableDelete(variableId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "variables",
    (variables) => {
      const next = { ...variables };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete next[variableId];
      return next;
    },
    {},
  );
  return { ok: true };
}
