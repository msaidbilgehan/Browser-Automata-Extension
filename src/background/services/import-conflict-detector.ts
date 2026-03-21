import type {
  BrowserAutomataExport,
  EntityId,
  Shortcut,
  KeyCombo,
  ChordCombo,
} from "@/shared/types/entities";
import type { StorageSchema } from "@/shared/storage/keys";
import type {
  ImportConflictReport,
  ImportConflict,
  ImportConflictItem,
  FieldDifference,
  ImportExportSectionKey,
  ImportEntityOverride,
} from "@/shared/types/import-export";
import { localStore } from "@/shared/storage";

/** Entity sections that contain id-keyed records (excludes settings) */
const ENTITY_SECTIONS = [
  "scripts",
  "shortcuts",
  "flows",
  "cssRules",
  "extractionRules",
  "networkRules",
  "profiles",
  "variables",
  "sharedLibraries",
  "formFillProfiles",
  "notificationRules",
  "siteAdapters",
] as const;

type EntitySectionKey = (typeof ENTITY_SECTIONS)[number];

/**
 * Extract a human-readable name from an entity.
 */
function getEntityName(entity: Record<string, unknown>): string {
  if (typeof entity["name"] === "string") return entity["name"];
  if (typeof entity["key"] === "string") return entity["key"];
  if (typeof entity["siteName"] === "string") return entity["siteName"];
  const id = entity["id"];
  return typeof id === "string" ? id : "unknown";
}

/**
 * Format a key combo for display.
 */
function formatKeyCombo(combo: KeyCombo | ChordCombo): string {
  if ("sequence" in combo) {
    return combo.sequence.map(formatSingleKeyCombo).join(" → ");
  }
  return formatSingleKeyCombo(combo);
}

function formatSingleKeyCombo(k: KeyCombo): string {
  const parts: string[] = [];
  if (k.ctrlKey) parts.push("Ctrl");
  if (k.altKey) parts.push("Alt");
  if (k.shiftKey) parts.push("Shift");
  if (k.metaKey) parts.push("Meta");
  parts.push(k.key);
  return parts.join("+");
}

/**
 * Truncate a value for display in diff summaries.
 */
function truncate(value: unknown, maxLen = 60): string {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 3)}...`;
}

/**
 * Compare two values, returning a human-readable diff if they differ.
 */
function diffField(
  field: string,
  existing: unknown,
  imported: unknown,
): FieldDifference | null {
  const existingStr = JSON.stringify(existing);
  const importedStr = JSON.stringify(imported);
  if (existingStr === importedStr) return null;
  return {
    field,
    existingValue: truncate(existing),
    importedValue: truncate(imported),
  };
}

/**
 * Fields to compare per entity type (excludes meta timestamps).
 */
const COMPARISON_FIELDS: Record<EntitySectionKey, string[]> = {
  shortcuts: ["name", "keyCombo", "action", "scope", "enabled", "profileId"],
  scripts: ["name", "code", "trigger", "scope", "executionWorld", "enabled", "profileId"],
  flows: ["name", "description", "scope", "enabled", "nodes", "profileId"],
  cssRules: ["name", "css", "scope", "enabled", "injectAt", "profileId"],
  extractionRules: [
    "name",
    "scope",
    "enabled",
    "fields",
    "outputFormat",
    "outputActions",
    "triggers",
    "profileId",
  ],
  networkRules: ["name", "scope", "enabled", "urlFilter", "resourceTypes", "action", "profileId"],
  profiles: ["name", "description", "isActive"],
  variables: ["key", "value", "isSecret", "scope", "profileId"],
  sharedLibraries: ["name", "description", "code", "exports"],
  formFillProfiles: ["name", "scope", "enabled", "fields", "profileId"],
  notificationRules: [
    "name",
    "scope",
    "enabled",
    "condition",
    "checkIntervalMinutes",
    "notification",
    "profileId",
  ],
  siteAdapters: ["siteName", "scope", "version", "selectors", "actions"],
};

/**
 * Compute field-level differences between two entities of the same type.
 */
function computeFieldDifferences(
  existing: Record<string, unknown>,
  imported: Record<string, unknown>,
  entityType: EntitySectionKey,
): FieldDifference[] {
  const fields = COMPARISON_FIELDS[entityType];
  const diffs: FieldDifference[] = [];

  for (const field of fields) {
    const diff = diffField(field, existing[field], imported[field]);
    if (diff) {
      // Provide friendly display for shortcut keyCombo
      if (field === "keyCombo" && entityType === "shortcuts") {
        const existingShortcut = existing as unknown as Shortcut;
        const importedShortcut = imported as unknown as Shortcut;
        diff.existingValue = formatKeyCombo(existingShortcut.keyCombo);
        diff.importedValue = formatKeyCombo(importedShortcut.keyCombo);
      }
      diffs.push(diff);
    }
  }

  return diffs;
}

/**
 * Detect conflicts between imported data and existing storage.
 */
export async function detectImportConflicts(
  data: BrowserAutomataExport,
): Promise<ImportConflictReport> {
  const conflicts: ImportConflict[] = [];
  const newItems: ImportConflictItem[] = [];
  const unchangedItems: ImportConflictItem[] = [];

  for (const section of ENTITY_SECTIONS) {
    const importedItems = data[section];
    if (!importedItems || !Array.isArray(importedItems) || importedItems.length === 0) continue;

    const existingRecord =
      ((await localStore.get(section as keyof StorageSchema)) as Record<string, unknown> | null) ??
      {};

    for (const item of importedItems) {
      const entity = item as unknown as Record<string, unknown> & { id: string };
      const entityId = entity.id as EntityId;
      const entityName = getEntityName(entity);
      const entityType = section as ImportExportSectionKey;

      const existing = existingRecord[entityId] as Record<string, unknown> | undefined;

      if (!existing) {
        newItems.push({ entityType, entityId, entityName });
      } else {
        const diffs = computeFieldDifferences(existing, entity, section);
        if (diffs.length === 0) {
          unchangedItems.push({ entityType, entityId, entityName });
        } else {
          conflicts.push({ entityType, entityId, entityName, differences: diffs });
        }
      }
    }
  }

  return { conflicts, newItems, unchangedItems };
}

/**
 * Import only the selected entities from an export, applying optional overrides.
 */
export async function importSelective(
  data: BrowserAutomataExport,
  selectedIds: EntityId[],
  overrides?: Record<string, ImportEntityOverride>,
): Promise<{ ok: boolean }> {
  const selectedSet = new Set<string>(selectedIds);

  for (const section of ENTITY_SECTIONS) {
    const importedItems = data[section];
    if (!importedItems || !Array.isArray(importedItems) || importedItems.length === 0) continue;

    const itemsToImport: { id: string }[] = [];

    for (const item of importedItems) {
      const entity = item as unknown as Record<string, unknown> & { id: string };
      if (!selectedSet.has(entity.id)) continue;

      // Apply overrides for this entity
      const override = overrides?.[entity.id];
      if (override?.keyCombo && section === "shortcuts") {
        (entity as unknown as Shortcut).keyCombo = override.keyCombo;
      }

      itemsToImport.push(entity);
    }

    if (itemsToImport.length === 0) continue;

    await localStore.update(
      section as keyof StorageSchema,
      (current) => {
        const updated = { ...(current as Record<string, unknown>) };
        for (const item of itemsToImport) {
          updated[item.id] = item;
        }
        return updated as StorageSchema[keyof StorageSchema];
      },
      {} as StorageSchema[keyof StorageSchema],
    );
  }

  return { ok: true };
}
