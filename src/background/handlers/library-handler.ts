import { localStore } from "@/shared/storage";
import type { SharedLibrary, EntityId } from "@/shared/types/entities";

/** Handle LIBRARY_SAVE: create or update a shared library */
export async function handleLibrarySave(library: SharedLibrary): Promise<{ ok: boolean }> {
  await localStore.update(
    "sharedLibraries",
    (libraries) => ({ ...libraries, [library.id]: library }),
    {},
  );
  return { ok: true };
}

/** Handle LIBRARY_DELETE: remove a shared library by ID */
export async function handleLibraryDelete(libraryId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "sharedLibraries",
    (libraries) => {
      const next = { ...libraries };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete next[libraryId];
      return next;
    },
    {},
  );
  return { ok: true };
}
