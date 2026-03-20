export const STORAGE_KEYS = {
  SCRIPTS: "scripts",
  SHORTCUTS: "shortcuts",
  FLOWS: "flows",
  CSS_RULES: "cssRules",
  EXTRACTION_RULES: "extractionRules",
  NETWORK_RULES: "networkRules",
  PROFILES: "profiles",
  VARIABLES: "variables",
  SHARED_LIBRARIES: "sharedLibraries",
  SCRIPT_VERSIONS: "scriptVersions",
  FORM_FILL_PROFILES: "formFillProfiles",
  NOTIFICATION_RULES: "notificationRules",
  SITE_ADAPTERS: "siteAdapters",
  CLIPBOARD_HISTORY: "clipboardHistory",
  HEALTH_METRICS: "healthMetrics",
  LOG: "log",
  SCHEMA_VERSION: "schemaVersion",
  SETTINGS: "settings",
} as const;

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULTS = {
  MAX_LOG_ENTRIES: 5000,
  MAX_CLIPBOARD_ENTRIES: 20,
  MAX_SCRIPT_VERSIONS: 50,
  SCRIPT_TIMEOUT_MS: 30_000,
  CHORD_TIMEOUT_MS: 500,
} as const;
