import type {
  Script,
  Shortcut,
  CSSRule,
  Flow,
  ExtractionRule,
  Profile,
  ScriptVariable,
  SharedLibrary,
  ScriptVersion,
  NetworkRule,
  ClipboardEntry,
  FormFillProfile,
  NotificationRule,
  SiteAdapter,
  HealthMetrics,
  ISOTimestamp,
  QuickRunAction,
} from "../types/entities";

/** Tracks an installed template's version for update detection */
export interface InstalledTemplateRecord {
  templateId: string;
  templateVersion: string;
  installedAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  /** SHA-256 hash of the template content at install/update time (locally computed) */
  contentHash?: string | undefined;
  /** SHA-256 hash from the remote registry at install/update time (for cloud update detection) */
  remoteContentHash?: string | undefined;
  /** Template display name (stored for showing removed templates) */
  templateName?: string | undefined;
}
import type { Settings } from "../types/settings";
import type { ActivityLogEntry } from "../types/activity-log";

/**
 * Typed mapping from storage keys to their value types.
 * Used by chrome-storage.ts to enforce type safety on get/set operations.
 */
export interface StorageSchema {
  scripts: Record<string, Script>;
  shortcuts: Record<string, Shortcut>;
  flows: Record<string, Flow>;
  cssRules: Record<string, CSSRule>;
  extractionRules: Record<string, ExtractionRule>;
  profiles: Record<string, Profile>;
  variables: Record<string, ScriptVariable>;
  sharedLibraries: Record<string, SharedLibrary>;
  scriptVersions: Record<string, ScriptVersion[]>;
  networkRules: Record<string, NetworkRule>;
  clipboardHistory: ClipboardEntry[];
  formFillProfiles: Record<string, FormFillProfile>;
  notificationRules: Record<string, NotificationRule>;
  siteAdapters: Record<string, SiteAdapter>;
  healthMetrics: HealthMetrics;
  installedTemplates: Record<string, InstalledTemplateRecord>;
  quickRunActions: Record<string, QuickRunAction>;
  log: ActivityLogEntry[];
  schemaVersion: number;
}

export interface SyncStorageSchema {
  settings: Settings;
}

/** All valid local storage keys */
export type LocalStorageKey = keyof StorageSchema;

/** All valid sync storage keys */
export type SyncStorageKey = keyof SyncStorageSchema;
