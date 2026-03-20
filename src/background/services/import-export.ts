import type {
  BrowserAutomataExport,
  ImportMergeStrategy,
  ScriptVariable,
} from "@/shared/types/entities";
import type { StorageSchema } from "@/shared/storage/keys";
import { localStore, syncStore } from "@/shared/storage";
import { CURRENT_SCHEMA_VERSION } from "@/shared/constants";
import { now } from "@/shared/utils";

/**
 * Export all entities and settings into a BrowserAutomataExport object.
 */
export async function exportConfig(options?: {
  includeSecrets?: boolean;
}): Promise<{ data: BrowserAutomataExport }> {
  const includeSecrets = options?.includeSecrets ?? false;

  const settings = await syncStore.get("settings");
  const scripts = (await localStore.get("scripts")) ?? {};
  const shortcuts = (await localStore.get("shortcuts")) ?? {};
  const flows = (await localStore.get("flows")) ?? {};
  const cssRules = (await localStore.get("cssRules")) ?? {};
  const extractionRules = (await localStore.get("extractionRules")) ?? {};
  const profiles = (await localStore.get("profiles")) ?? {};
  const networkRules = (await localStore.get("networkRules")) ?? {};
  const variables = (await localStore.get("variables")) ?? {};
  const sharedLibraries = (await localStore.get("sharedLibraries")) ?? {};
  const formFillProfiles = (await localStore.get("formFillProfiles")) ?? {};
  const notificationRules = (await localStore.get("notificationRules")) ?? {};
  const siteAdapters = (await localStore.get("siteAdapters")) ?? {};

  const exportedVariables: ScriptVariable[] = includeSecrets
    ? Object.values(variables)
    : Object.values(variables).filter((v) => !v.isSecret);

  const data: BrowserAutomataExport = {
    _format: "browser-automata-export",
    _schemaVersion: CURRENT_SCHEMA_VERSION,
    _exportedAt: now(),
    _includesSecrets: includeSecrets,
    ...(settings ? { settings } : {}),
    profiles: Object.values(profiles),
    scripts: Object.values(scripts),
    shortcuts: Object.values(shortcuts),
    flows: Object.values(flows),
    cssRules: Object.values(cssRules),
    extractionRules: Object.values(extractionRules),
    networkRules: Object.values(networkRules),
    variables: exportedVariables,
    sharedLibraries: Object.values(sharedLibraries),
    formFillProfiles: Object.values(formFillProfiles),
    notificationRules: Object.values(notificationRules),
    siteAdapters: Object.values(siteAdapters),
  };

  return { data };
}

/**
 * Import a BrowserAutomataExport with the given merge strategy.
 */
export async function importConfig(
  data: BrowserAutomataExport,
  strategy: ImportMergeStrategy,
): Promise<{ ok: boolean }> {
  switch (strategy) {
    case "replace_all":
      return importReplaceAll(data);
    case "merge_keep":
      return importMergeKeep(data);
    case "merge_overwrite":
      return importMergeOverwrite(data);
  }
}

async function importReplaceAll(data: BrowserAutomataExport): Promise<{ ok: boolean }> {
  // Clear all and write imported data
  if (data.settings) {
    await syncStore.set("settings", data.settings);
  }

  await localStore.set("scripts", arrayToRecord(data.scripts));
  await localStore.set("shortcuts", arrayToRecord(data.shortcuts));
  await localStore.set("flows", arrayToRecord(data.flows));
  await localStore.set("cssRules", arrayToRecord(data.cssRules));
  await localStore.set("extractionRules", arrayToRecord(data.extractionRules));
  await localStore.set("profiles", arrayToRecord(data.profiles));
  await localStore.set("networkRules", arrayToRecord(data.networkRules));
  await localStore.set("variables", arrayToRecord(data.variables));
  await localStore.set("sharedLibraries", arrayToRecord(data.sharedLibraries));
  await localStore.set("formFillProfiles", arrayToRecord(data.formFillProfiles));
  await localStore.set("notificationRules", arrayToRecord(data.notificationRules));
  await localStore.set("siteAdapters", arrayToRecord(data.siteAdapters));

  return { ok: true };
}

async function importMergeKeep(data: BrowserAutomataExport): Promise<{ ok: boolean }> {
  // Only add entities with IDs that don't already exist
  await mergeEntities("scripts", data.scripts, false);
  await mergeEntities("shortcuts", data.shortcuts, false);
  await mergeEntities("flows", data.flows, false);
  await mergeEntities("cssRules", data.cssRules, false);
  await mergeEntities("extractionRules", data.extractionRules, false);
  await mergeEntities("profiles", data.profiles, false);
  await mergeEntities("networkRules", data.networkRules, false);
  await mergeEntities("variables", data.variables, false);
  await mergeEntities("sharedLibraries", data.sharedLibraries, false);
  await mergeEntities("formFillProfiles", data.formFillProfiles, false);
  await mergeEntities("notificationRules", data.notificationRules, false);
  await mergeEntities("siteAdapters", data.siteAdapters, false);

  return { ok: true };
}

async function importMergeOverwrite(data: BrowserAutomataExport): Promise<{ ok: boolean }> {
  // Imported version wins for matching IDs
  await mergeEntities("scripts", data.scripts, true);
  await mergeEntities("shortcuts", data.shortcuts, true);
  await mergeEntities("flows", data.flows, true);
  await mergeEntities("cssRules", data.cssRules, true);
  await mergeEntities("extractionRules", data.extractionRules, true);
  await mergeEntities("profiles", data.profiles, true);
  await mergeEntities("networkRules", data.networkRules, true);
  await mergeEntities("variables", data.variables, true);
  await mergeEntities("sharedLibraries", data.sharedLibraries, true);
  await mergeEntities("formFillProfiles", data.formFillProfiles, true);
  await mergeEntities("notificationRules", data.notificationRules, true);
  await mergeEntities("siteAdapters", data.siteAdapters, true);

  if (data.settings) {
    await syncStore.set("settings", data.settings);
  }

  return { ok: true };
}

async function mergeEntities(
  key: keyof StorageSchema,
  items: { id: string }[] | undefined,
  overwrite: boolean,
): Promise<void> {
  if (!items || items.length === 0) return;
  await localStore.update(
    key,
    (current) => {
      const updated = { ...(current as Record<string, unknown>) };
      for (const item of items) {
        if (overwrite || !(item.id in updated)) {
          updated[item.id] = item;
        }
      }
      return updated as StorageSchema[typeof key];
    },
    {} as StorageSchema[typeof key],
  );
}

function arrayToRecord<T extends { id: string }>(items: T[] | undefined): Record<string, T> {
  const record: Record<string, T> = {};
  if (items) {
    for (const item of items) {
      record[item.id] = item;
    }
  }
  return record;
}
