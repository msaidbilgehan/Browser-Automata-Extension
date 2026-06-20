import type {
  BrowserAutomataExport,
  ImportMergeStrategy,
  ScriptVariable,
} from "@/shared/types/entities";
import type { StorageSchema } from "@/shared/storage/keys";
import type { ImportExportSectionKey } from "@/shared/types/import-export";
import { localStore, syncStore } from "@/shared/storage";
import { CURRENT_SCHEMA_VERSION } from "@/shared/constants";
import { now } from "@/shared/utils";
import { resyncEntitySideEffects } from "./side-effect-sync";

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

const EXPECTED_IMPORT_FORMAT = "browser-automata-export";

/**
 * Validate an import payload's envelope before any of it is written to storage.
 *
 * The payload comes from an untrusted file, so its declared type cannot be
 * trusted at runtime — it is inspected loosely. Rejects files that are not
 * Browser Automata exports and payloads produced by a newer schema than this
 * build understands (which could be shaped in ways the importer would corrupt).
 */
export function validateImportEnvelope(data: BrowserAutomataExport): {
  ok: boolean;
  reason?: string;
} {
  const envelope = data as { _format?: unknown; _schemaVersion?: unknown };
  if (envelope._format !== EXPECTED_IMPORT_FORMAT) {
    return { ok: false, reason: `unrecognized format ${JSON.stringify(envelope._format)}` };
  }
  if (typeof envelope._schemaVersion !== "number" || !Number.isFinite(envelope._schemaVersion)) {
    return { ok: false, reason: "missing or invalid schema version" };
  }
  if (envelope._schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `schema v${String(envelope._schemaVersion)} is newer than the supported v${String(CURRENT_SCHEMA_VERSION)}`,
    };
  }
  return { ok: true };
}

/**
 * Keep only entities that carry a non-empty string `id`. Anything else would be
 * keyed into the id-record under `"undefined"` and, for replace_all, silently
 * drop or corrupt existing data.
 */
export function withValidId<T extends { id: string }>(items: T[] | undefined): T[] {
  if (!items) return [];
  return items.filter((item) => typeof item.id === "string" && item.id.trim() !== "");
}

/**
 * Import a BrowserAutomataExport with the given merge strategy.
 */
export async function importConfig(
  data: BrowserAutomataExport,
  strategy: ImportMergeStrategy,
): Promise<{ ok: boolean }> {
  // Validate the envelope before touching storage — a malformed file must never
  // reach importReplaceAll, which would otherwise clear storage first.
  const validation = validateImportEnvelope(data);
  if (!validation.ok) {
    console.warn(`[Browser Automata] Import rejected: ${validation.reason ?? "invalid payload"}`);
    return { ok: false };
  }

  const result = await runImportStrategy(data, strategy);
  // A bulk import can add/replace network rules, notification rules, and
  // scheduled scripts. Re-sync the declarativeNetRequest engine and alarms so
  // they take effect immediately instead of only after a browser restart.
  await resyncEntitySideEffects();
  return result;
}

async function runImportStrategy(
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
  const valid = withValidId(items);
  if (valid.length === 0) return;
  await localStore.update(
    key,
    (current) => {
      const updated = { ...(current as Record<string, unknown>) };
      for (const item of valid) {
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
  for (const item of withValidId(items)) {
    record[item.id] = item;
  }
  return record;
}

/**
 * Filter a full export to only include the specified sections.
 * Background-safe variant (no popup dependencies).
 */
export function filterExportBySection(
  data: BrowserAutomataExport,
  sections: ReadonlySet<ImportExportSectionKey>,
): BrowserAutomataExport {
  const filtered: BrowserAutomataExport = {
    _format: data._format,
    _schemaVersion: data._schemaVersion,
    _exportedAt: data._exportedAt,
  };

  if (data._includesSecrets !== undefined) {
    filtered._includesSecrets = data._includesSecrets;
  }

  if (sections.has("scripts") && data.scripts) filtered.scripts = data.scripts;
  if (sections.has("shortcuts") && data.shortcuts) filtered.shortcuts = data.shortcuts;
  if (sections.has("flows") && data.flows) filtered.flows = data.flows;
  if (sections.has("settings") && data.settings) filtered.settings = data.settings;
  if (sections.has("cssRules") && data.cssRules) filtered.cssRules = data.cssRules;
  if (sections.has("extractionRules") && data.extractionRules)
    filtered.extractionRules = data.extractionRules;
  if (sections.has("networkRules") && data.networkRules)
    filtered.networkRules = data.networkRules;
  if (sections.has("profiles") && data.profiles) filtered.profiles = data.profiles;
  if (sections.has("variables") && data.variables) filtered.variables = data.variables;
  if (sections.has("sharedLibraries") && data.sharedLibraries)
    filtered.sharedLibraries = data.sharedLibraries;
  if (sections.has("formFillProfiles") && data.formFillProfiles)
    filtered.formFillProfiles = data.formFillProfiles;
  if (sections.has("notificationRules") && data.notificationRules)
    filtered.notificationRules = data.notificationRules;
  if (sections.has("siteAdapters") && data.siteAdapters)
    filtered.siteAdapters = data.siteAdapters;

  return filtered;
}
