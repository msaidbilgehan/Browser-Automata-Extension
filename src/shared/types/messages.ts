import type { EntityId, SelectorAlternative, ExtractionFieldTransform, QuickRunAction } from "./entities";
import type {
  Script,
  Shortcut,
  CSSRule,
  Flow,
  ExtractionRule,
  Profile,
  BrowserAutomataExport,
  ImportMergeStrategy,
  ScriptVariable,
  SharedLibrary,
  NetworkRule,
  FormFillProfile,
  NotificationRule,
  HealthMetrics,
} from "./entities";
import type { Settings } from "./settings";
import type { ActivityLogEntry, LogAction, LogStatus } from "./activity-log";
import type {
  ImportConflictReport,
  ImportEntityOverride,
  ImportExportSectionKey,
  DependencySummary,
} from "./import-export";

// ─── Content Script → Service Worker ────────────────────────────────────────

export interface ContentReadyMessage {
  type: "CONTENT_READY";
  url: string;
  /** True when this is a retry (only shortcuts need re-pushing, not extractions) */
  isRetry?: boolean;
}

export interface ShortcutFiredMessage {
  type: "SHORTCUT_FIRED";
  shortcutId: EntityId;
}

export interface ElementPickedMessage {
  type: "ELEMENT_PICKED";
  selector: string;
  /** All generated selector alternatives with strategy labels and match counts */
  alternatives?: SelectorAlternative[];
}

export interface RecordedActionMessage {
  type: "RECORDED_ACTION";
  action: {
    type: "click" | "type" | "scroll" | "navigate";
    selector?: string;
    value?: string;
    url?: string;
  };
}

export interface ExecutionResultMessage {
  type: "EXECUTION_RESULT";
  scriptId: EntityId;
  result: unknown;
}

export interface ExecutionErrorMessage {
  type: "EXECUTION_ERROR";
  scriptId: EntityId;
  error: string;
  stack?: string;
}

// ─── Service Worker → Content Script ────────────────────────────────────────

export interface PingMessage {
  type: "PING";
}

export interface UpdateShortcutsMessage {
  type: "UPDATE_SHORTCUTS";
  shortcuts: Shortcut[];
}

export interface StartRecordingMessage {
  type: "START_RECORDING";
}

export interface StopRecordingMessage {
  type: "STOP_RECORDING";
}

export interface PickElementMessage {
  type: "PICK_ELEMENT";
}

export interface ExtractDataMessage {
  type: "EXTRACT_DATA";
  ruleId: EntityId;
  fields: {
    name: string;
    selector: string;
    fallbackSelectors?: string[];
    attribute?: string;
    multiple: boolean;
    transforms?: ExtractionFieldTransform[];
  }[];
}

export interface TestSelectorMessage {
  type: "TEST_SELECTOR";
  selector: string;
}

export interface ClearTestHighlightMessage {
  type: "CLEAR_TEST_HIGHLIGHT";
}

// ─── Popup/Options → Service Worker ─────────────────────────────────────────

export interface GetStateMessage {
  type: "GET_STATE";
}

// Script messages
export interface ScriptSaveMessage {
  type: "SCRIPT_SAVE";
  script: Script;
}

export interface ScriptDeleteMessage {
  type: "SCRIPT_DELETE";
  scriptId: EntityId;
}

export interface ScriptToggleMessage {
  type: "SCRIPT_TOGGLE";
  scriptId: EntityId;
  enabled: boolean;
}

export interface ScriptRunNowMessage {
  type: "SCRIPT_RUN_NOW";
  scriptId: EntityId;
}

// Shortcut messages
export interface ShortcutSaveMessage {
  type: "SHORTCUT_SAVE";
  shortcut: Shortcut;
}

export interface ShortcutDeleteMessage {
  type: "SHORTCUT_DELETE";
  shortcutId: EntityId;
}

export interface ShortcutToggleMessage {
  type: "SHORTCUT_TOGGLE";
  shortcutId: EntityId;
  enabled: boolean;
}

// CSS Rule messages
export interface CSSRuleSaveMessage {
  type: "CSS_RULE_SAVE";
  cssRule: CSSRule;
}

export interface CSSRuleDeleteMessage {
  type: "CSS_RULE_DELETE";
  cssRuleId: EntityId;
}

// Flow messages
export interface FlowSaveMessage {
  type: "FLOW_SAVE";
  flow: Flow;
}

export interface FlowDeleteMessage {
  type: "FLOW_DELETE";
  flowId: EntityId;
}

export interface FlowRunNowMessage {
  type: "FLOW_RUN_NOW";
  flowId: EntityId;
}

// Extraction messages
export interface ExtractionRuleSaveMessage {
  type: "EXTRACTION_RULE_SAVE";
  rule: ExtractionRule;
}

export interface ExtractionRuleDeleteMessage {
  type: "EXTRACTION_RULE_DELETE";
  ruleId: EntityId;
}

export interface ExtractionRunNowMessage {
  type: "EXTRACTION_RUN_NOW";
  ruleId: EntityId;
}

export interface ExtractionTestMessage {
  type: "EXTRACTION_TEST";
  fields: {
    name: string;
    selector: string;
    fallbackSelectors?: string[];
    attribute?: string;
    multiple: boolean;
    transforms?: ExtractionFieldTransform[];
  }[];
  outputFormat: "json" | "csv" | "markdown" | "html" | "text" | "xml";
}

export interface ExtractionShowTabMessage {
  type: "EXTRACTION_SHOW_TAB";
  formatted: string;
  format: string;
  rowCount: number;
  name: string;
}

// Profile messages
export interface ProfileSaveMessage {
  type: "PROFILE_SAVE";
  profile: Profile;
}

export interface ProfileDeleteMessage {
  type: "PROFILE_DELETE";
  profileId: EntityId;
}

export interface ProfileSwitchMessage {
  type: "PROFILE_SWITCH";
  profileId: EntityId | null;
}

// Settings messages
export interface SettingsUpdateMessage {
  type: "SETTINGS_UPDATE";
  settings: Partial<Settings>;
}

// Import/Export messages
export interface ImportConfigMessage {
  type: "IMPORT_CONFIG";
  data: BrowserAutomataExport;
  strategy: ImportMergeStrategy;
}

export interface ExportConfigMessage {
  type: "EXPORT_CONFIG";
}

export interface ExportConfigWithDepsMessage {
  type: "EXPORT_CONFIG_WITH_DEPS";
  sections: ImportExportSectionKey[];
}

export interface DetectImportConflictsMessage {
  type: "DETECT_IMPORT_CONFLICTS";
  data: BrowserAutomataExport;
}

export interface ImportConfigSelectiveMessage {
  type: "IMPORT_CONFIG_SELECTIVE";
  data: BrowserAutomataExport;
  selectedIds: EntityId[];
  overrides?: Record<string, ImportEntityOverride>;
}

// Recording messages
export interface StartRecordingPopupMessage {
  type: "START_RECORDING_POPUP";
}

export interface StopRecordingPopupMessage {
  type: "STOP_RECORDING_POPUP";
}

// Element picker (popup requests pick on active tab)
export interface PickElementPopupMessage {
  type: "PICK_ELEMENT_POPUP";
  /** Stable identifier for the field that requested the pick */
  pickId: string;
}

// Live selector testing (popup requests highlight on active tab)
export interface TestSelectorPopupMessage {
  type: "TEST_SELECTOR_POPUP";
  selector: string;
}

export interface ClearTestHighlightPopupMessage {
  type: "CLEAR_TEST_HIGHLIGHT_POPUP";
}

// ─── Template status detection ──────────────────────────────────────────────

/** Possible template statuses after comparing cloud vs local */
export type TemplateStatus =
  | "not_installed"
  | "installed"
  | "update_available"
  | "local_modified"
  | "update_and_modified"
  | "removed";

export interface GetTemplateStatusesMessage {
  type: "GET_TEMPLATE_STATUSES";
  queries: {
    templateId: string;
    remoteContentHash?: string | undefined;
    templateName: string;
    templateDescription: string;
    templateCategory: string;
    templateTags: string[];
    templateAuthor?: string | undefined;
  }[];
}

export interface TemplateStatusesResponse {
  statuses: Record<string, TemplateStatus>;
}

// Template install & remote catalog
export interface InstallTemplateMessage {
  type: "INSTALL_TEMPLATE";
  templateId: string;
}

export interface UpdateTemplateMessage {
  type: "UPDATE_TEMPLATE";
  templateId: string;
}

export interface UninstallTemplateMessage {
  type: "UNINSTALL_TEMPLATE";
  templateId: string;
}

export interface ResetTemplateMessage {
  type: "RESET_TEMPLATE";
  templateId: string;
}

export interface GetInstalledTemplatesMessage {
  type: "GET_INSTALLED_TEMPLATES";
}

export interface FetchTemplateCatalogMessage {
  type: "FETCH_TEMPLATE_CATALOG";
}

export interface FetchSingleTemplateMessage {
  type: "FETCH_SINGLE_TEMPLATE";
  slug: string;
}

// Log messages
export interface GetLogMessage {
  type: "GET_LOG";
  filters?: {
    domain?: string;
    action?: LogAction;
    status?: LogStatus;
  };
}

export interface ClearLogMessage {
  type: "CLEAR_LOG";
}

// ─── Phase 4: Variable messages ──────────────────────────────────────────────

export interface VariableSaveMessage {
  type: "VARIABLE_SAVE";
  variable: ScriptVariable;
}

export interface VariableDeleteMessage {
  type: "VARIABLE_DELETE";
  variableId: EntityId;
}

// ─── Phase 4: Library messages ───────────────────────────────────────────────

export interface LibrarySaveMessage {
  type: "LIBRARY_SAVE";
  library: SharedLibrary;
}

export interface LibraryDeleteMessage {
  type: "LIBRARY_DELETE";
  libraryId: EntityId;
}

// ─── Phase 4: Network rule messages ──────────────────────────────────────────

export interface NetworkRuleSaveMessage {
  type: "NETWORK_RULE_SAVE";
  rule: NetworkRule;
}

export interface NetworkRuleDeleteMessage {
  type: "NETWORK_RULE_DELETE";
  ruleId: EntityId;
}

// ─── Phase 4: Form fill messages ─────────────────────────────────────────────

export interface FormFillSaveMessage {
  type: "FORM_FILL_SAVE";
  profile: FormFillProfile;
}

export interface FormFillDeleteMessage {
  type: "FORM_FILL_DELETE";
  profileId: EntityId;
}

export interface FormFillRunMessage {
  type: "FORM_FILL_RUN";
  profileId: EntityId;
}

// ─── Phase 4: Notification rule messages ─────────────────────────────────────

export interface NotificationRuleSaveMessage {
  type: "NOTIFICATION_RULE_SAVE";
  rule: NotificationRule;
}

export interface NotificationRuleDeleteMessage {
  type: "NOTIFICATION_RULE_DELETE";
  ruleId: EntityId;
}

// ─── Phase 4: Health messages ────────────────────────────────────────────────

export interface GetHealthMessage {
  type: "GET_HEALTH";
}

// ─── Phase 4: Health response ────────────────────────────────────────────────

export interface HealthResponse {
  metrics: HealthMetrics;
}

// ─── Quick Run messages ─────────────────────────────────────────────────────

export interface QuickRunSaveMessage {
  type: "QUICK_RUN_SAVE";
  action: QuickRunAction;
}

export interface QuickRunDeleteMessage {
  type: "QUICK_RUN_DELETE";
  actionId: EntityId;
}

export interface QuickRunReorderMessage {
  type: "QUICK_RUN_REORDER";
  orderedIds: EntityId[];
}

export interface QuickRunExecuteMessage {
  type: "QUICK_RUN_EXECUTE";
  actionId: EntityId;
}

export interface QuickRunGetMatchingMessage {
  type: "QUICK_RUN_GET_MATCHING";
  url: string;
}

export interface QuickRunGetMatchingResponse {
  actions: QuickRunAction[];
}

// ─── Service Worker → Content Script (Quick Tip) ────────────────────────────

export interface UpdateQuickTipShortcutsMessage {
  type: "UPDATE_QUICK_TIP_SHORTCUTS";
  /** Shortcuts matching the current page (for the quick tip overlay) */
  shortcuts: Shortcut[];
}

// ─── Service Worker → Content Script (Quick Run) ────────────────────────────

export interface UpdateQuickRunActionsMessage {
  type: "UPDATE_QUICK_RUN_ACTIONS";
  /** All enabled actions (sorted by order) */
  actions: QuickRunAction[];
  /** IDs of actions whose scope matches the current page URL */
  matchingIds: string[];
}

// ─── Service Worker → Popup/Options (Responses) ────────────────────────────

export interface StateResponse {
  settings: Settings;
  counts: {
    scripts: number;
    shortcuts: number;
    flows: number;
    cssRules: number;
    extractionRules: number;
    networkRules: number;
    profiles: number;
  };
  activeProfileId: EntityId | null;
}

export interface LogResponse {
  entries: ActivityLogEntry[];
}

export interface ExportResponse {
  data: BrowserAutomataExport;
}

export interface ExportWithDepsResponse {
  data: BrowserAutomataExport;
  dependencySummary: DependencySummary;
}

export interface DetectImportConflictsResponse {
  report: ImportConflictReport;
}

export interface ExtractionRunResponse {
  ok: boolean;
  data?: Record<string, unknown>[];
  formatted?: string;
  error?: string;
}

// ─── Union Types ────────────────────────────────────────────────────────────

/** Messages from popup/options to service worker */
export type PopupToSWMessage =
  | GetStateMessage
  | ScriptSaveMessage
  | ScriptDeleteMessage
  | ScriptToggleMessage
  | ScriptRunNowMessage
  | ShortcutSaveMessage
  | ShortcutDeleteMessage
  | ShortcutToggleMessage
  | CSSRuleSaveMessage
  | CSSRuleDeleteMessage
  | FlowSaveMessage
  | FlowDeleteMessage
  | FlowRunNowMessage
  | ExtractionRuleSaveMessage
  | ExtractionRuleDeleteMessage
  | ExtractionRunNowMessage
  | ExtractionTestMessage
  | ExtractionShowTabMessage
  | ProfileSaveMessage
  | ProfileDeleteMessage
  | ProfileSwitchMessage
  | SettingsUpdateMessage
  | ImportConfigMessage
  | ExportConfigMessage
  | ExportConfigWithDepsMessage
  | DetectImportConflictsMessage
  | ImportConfigSelectiveMessage
  | StartRecordingPopupMessage
  | StopRecordingPopupMessage
  | InstallTemplateMessage
  | UpdateTemplateMessage
  | UninstallTemplateMessage
  | ResetTemplateMessage
  | GetInstalledTemplatesMessage
  | FetchTemplateCatalogMessage
  | FetchSingleTemplateMessage
  | GetTemplateStatusesMessage
  | GetLogMessage
  | ClearLogMessage
  | VariableSaveMessage
  | VariableDeleteMessage
  | LibrarySaveMessage
  | LibraryDeleteMessage
  | NetworkRuleSaveMessage
  | NetworkRuleDeleteMessage
  | FormFillSaveMessage
  | FormFillDeleteMessage
  | FormFillRunMessage
  | NotificationRuleSaveMessage
  | NotificationRuleDeleteMessage
  | GetHealthMessage
  | PickElementPopupMessage
  | TestSelectorPopupMessage
  | ClearTestHighlightPopupMessage
  | QuickRunSaveMessage
  | QuickRunDeleteMessage
  | QuickRunReorderMessage
  | QuickRunExecuteMessage
  | QuickRunGetMatchingMessage;

/** Messages from content script to service worker */
export type ContentToSWMessage =
  | ContentReadyMessage
  | ShortcutFiredMessage
  | ElementPickedMessage
  | RecordedActionMessage
  | ExecutionResultMessage
  | ExecutionErrorMessage;

/** Messages from service worker to content script */
export type SWToContentMessage =
  | PingMessage
  | UpdateShortcutsMessage
  | StartRecordingMessage
  | StopRecordingMessage
  | PickElementMessage
  | ExtractDataMessage
  | TestSelectorMessage
  | ClearTestHighlightMessage
  | UpdateQuickRunActionsMessage
  | UpdateQuickTipShortcutsMessage;

/** All messages */
export type Message = PopupToSWMessage | ContentToSWMessage | SWToContentMessage;
