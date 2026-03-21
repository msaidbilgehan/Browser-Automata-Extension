import { sendToBackground } from "@/shared/messaging";
import type { BrowserAutomataExport, ImportMergeStrategy, EntityId } from "@/shared/types/entities";
import type { ActivityLogEntry } from "@/shared/types/activity-log";
import type {
  ImportConflictReport,
  ImportExportSectionKey,
  DependencySummary,
  ImportEntityOverride,
} from "@/shared/types/import-export";
import type {
  ExportWithDepsResponse,
  DetectImportConflictsResponse,
} from "@/shared/types/messages";

/**
 * Section keys that can be selectively exported/imported.
 */
export const EXPORT_SECTIONS = {
  scripts: "Scripts",
  shortcuts: "Shortcuts",
  flows: "Flows",
  settings: "Settings",
  cssRules: "CSS Rules",
  extractionRules: "Extraction Rules",
  networkRules: "Network Rules",
  profiles: "Profiles",
  variables: "Variables",
  sharedLibraries: "Shared Libraries",
  formFillProfiles: "Form Fill Profiles",
  notificationRules: "Notification Rules",
  siteAdapters: "Site Adapters",
} as const;

export type ExportSectionKey = keyof typeof EXPORT_SECTIONS;

/**
 * Download a JSON blob as a file.
 */
export function downloadJsonFile(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a timestamped filename for exports.
 */
export function exportFilename(label: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `browser-automata-${label}-${date}.json`;
}

/**
 * Read and parse a JSON file from a File input.
 * Returns the parsed data or throws on invalid JSON.
 */
export function readJsonFile<T>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== "string") {
        reject(new Error("Could not read file."));
        return;
      }
      try {
        resolve(JSON.parse(text) as T);
      } catch {
        reject(new Error("Invalid JSON file."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };
    reader.readAsText(file);
  });
}

/**
 * Validate that parsed data looks like a BrowserAutomataExport.
 */
export function isValidExport(data: unknown): data is BrowserAutomataExport {
  return (
    typeof data === "object" &&
    data !== null &&
    "_format" in data &&
    (data as Record<string, unknown>)["_format"] === "browser-automata-export"
  );
}

/**
 * Filter a full export to only include the specified sections.
 */
export function filterExportSections(
  data: BrowserAutomataExport,
  sections: ReadonlySet<ExportSectionKey>,
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

/**
 * Export specific sections and trigger a file download.
 * @returns Success message or throws on error.
 */
export async function exportSections(sections: ReadonlySet<ExportSectionKey>): Promise<string> {
  const response = await sendToBackground({ type: "EXPORT_CONFIG" });
  const fullExport = (response as { data: BrowserAutomataExport }).data;
  const filtered = filterExportSections(fullExport, sections);

  const label = sections.size === Object.keys(EXPORT_SECTIONS).length ? "export" : "partial-export";
  downloadJsonFile(filtered, exportFilename(label));
  return "Configuration exported successfully.";
}

/**
 * Export a single section and trigger a file download.
 */
export async function exportSection(section: ExportSectionKey): Promise<string> {
  const response = await sendToBackground({ type: "EXPORT_CONFIG" });
  const fullExport = (response as { data: BrowserAutomataExport }).data;
  const filtered = filterExportSections(fullExport, new Set([section]));

  downloadJsonFile(filtered, exportFilename(section));
  return `${EXPORT_SECTIONS[section]} exported successfully.`;
}

/**
 * Import a file for specific sections with a given merge strategy.
 */
export async function importFromFile(
  file: File,
  strategy: ImportMergeStrategy,
): Promise<{ data: BrowserAutomataExport }> {
  const parsed = await readJsonFile<unknown>(file);
  if (!isValidExport(parsed)) {
    throw new Error(
      'Invalid file format. Expected a Browser Automata export with "_format": "browser-automata-export".',
    );
  }
  await sendToBackground({ type: "IMPORT_CONFIG", data: parsed, strategy });
  return { data: parsed };
}

/**
 * Export activity log entries as JSON.
 */
export function exportLogs(entries: readonly ActivityLogEntry[]): void {
  const data = {
    _format: "browser-automata-log-export",
    _exportedAt: new Date().toISOString(),
    _count: entries.length,
    entries,
  };
  downloadJsonFile(data, exportFilename("log"));
}

/**
 * Export specific sections with dependency resolution and trigger a file download.
 * Resolves referenced entities (e.g. a shortcut's flow) and includes them.
 * @returns Success message and dependency summary.
 */
export async function exportSectionsWithDeps(
  sections: ReadonlySet<ExportSectionKey>,
): Promise<{ message: string; summary: DependencySummary }> {
  const response = await sendToBackground({
    type: "EXPORT_CONFIG_WITH_DEPS",
    sections: [...sections] as ImportExportSectionKey[],
  });
  const { data, dependencySummary } = response as ExportWithDepsResponse;

  const label = sections.size === Object.keys(EXPORT_SECTIONS).length ? "export" : "partial-export";
  downloadJsonFile(data, exportFilename(label));

  const depParts: string[] = [];
  if (dependencySummary.addedFlows > 0)
    depParts.push(`${String(dependencySummary.addedFlows)} flow(s)`);
  if (dependencySummary.addedScripts > 0)
    depParts.push(`${String(dependencySummary.addedScripts)} script(s)`);
  if (dependencySummary.addedExtractionRules > 0)
    depParts.push(`${String(dependencySummary.addedExtractionRules)} extraction rule(s)`);
  if (dependencySummary.addedProfiles > 0)
    depParts.push(`${String(dependencySummary.addedProfiles)} profile(s)`);

  const depMsg =
    depParts.length > 0 ? ` (added ${depParts.join(", ")} as dependencies)` : "";

  return {
    message: `Configuration exported successfully.${depMsg}`,
    summary: dependencySummary,
  };
}

/**
 * Detect conflicts between a parsed export file and existing storage.
 */
export async function detectConflicts(
  data: BrowserAutomataExport,
): Promise<ImportConflictReport> {
  const response = await sendToBackground({
    type: "DETECT_IMPORT_CONFLICTS",
    data,
  });
  return (response as DetectImportConflictsResponse).report;
}

/**
 * Import only selected entities, with optional overrides (e.g. changed key combos).
 */
export async function importSelective(
  data: BrowserAutomataExport,
  selectedIds: EntityId[],
  overrides?: Record<string, ImportEntityOverride>,
): Promise<void> {
  const msg = overrides
    ? { type: "IMPORT_CONFIG_SELECTIVE" as const, data, selectedIds, overrides }
    : { type: "IMPORT_CONFIG_SELECTIVE" as const, data, selectedIds };
  await sendToBackground(msg);
}

/**
 * Count non-empty sections in an export for summary display.
 */
export function summarizeExport(data: BrowserAutomataExport): string[] {
  const items: string[] = [];
  if (data.scripts?.length) items.push(`${String(data.scripts.length)} scripts`);
  if (data.shortcuts?.length) items.push(`${String(data.shortcuts.length)} shortcuts`);
  if (data.flows?.length) items.push(`${String(data.flows.length)} flows`);
  if (data.cssRules?.length) items.push(`${String(data.cssRules.length)} CSS rules`);
  if (data.extractionRules?.length)
    items.push(`${String(data.extractionRules.length)} extraction rules`);
  if (data.networkRules?.length) items.push(`${String(data.networkRules.length)} network rules`);
  if (data.profiles?.length) items.push(`${String(data.profiles.length)} profiles`);
  if (data.variables?.length) items.push(`${String(data.variables.length)} variables`);
  if (data.sharedLibraries?.length)
    items.push(`${String(data.sharedLibraries.length)} shared libraries`);
  if (data.formFillProfiles?.length)
    items.push(`${String(data.formFillProfiles.length)} form fill profiles`);
  if (data.notificationRules?.length)
    items.push(`${String(data.notificationRules.length)} notification rules`);
  if (data.siteAdapters?.length) items.push(`${String(data.siteAdapters.length)} site adapters`);
  if (data.settings) items.push("settings");
  return items;
}
