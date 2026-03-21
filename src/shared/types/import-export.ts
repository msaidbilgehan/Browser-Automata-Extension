import type { EntityId, ChordCombo, KeyCombo } from "./entities";

/** Entity section keys used in import/export */
export type ImportExportSectionKey =
  | "scripts"
  | "shortcuts"
  | "flows"
  | "settings"
  | "cssRules"
  | "extractionRules"
  | "networkRules"
  | "profiles"
  | "variables"
  | "sharedLibraries"
  | "formFillProfiles"
  | "notificationRules"
  | "siteAdapters";

/** Summary item for a new or unchanged entity in an import */
export interface ImportConflictItem {
  entityType: ImportExportSectionKey;
  entityId: EntityId;
  entityName: string;
}

/** A single field-level difference between existing and imported entity */
export interface FieldDifference {
  field: string;
  existingValue: string;
  importedValue: string;
}

/** An entity that exists locally with different field values */
export interface ImportConflict extends ImportConflictItem {
  differences: FieldDifference[];
}

/** Full conflict analysis report returned by the background service */
export interface ImportConflictReport {
  conflicts: ImportConflict[];
  newItems: ImportConflictItem[];
  unchangedItems: ImportConflictItem[];
}

/** Summary of dependencies added during export */
export interface DependencySummary {
  addedFlows: number;
  addedScripts: number;
  addedExtractionRules: number;
  addedProfiles: number;
}

/** Overrides applied to entities before selective import */
export interface ImportEntityOverride {
  keyCombo?: KeyCombo | ChordCombo;
}
