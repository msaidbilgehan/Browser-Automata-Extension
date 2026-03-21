import type { Settings } from "./settings";

/** Branded type for entity identifiers (UUID v4) */
export type EntityId = string & { readonly __brand: "EntityId" };

/** Branded type for ISO 8601 timestamps */
export type ISOTimestamp = string & { readonly __brand: "ISOTimestamp" };

/** URL pattern for scoping scripts, shortcuts, and rules */
export interface UrlPattern {
  type: "exact" | "glob" | "regex" | "global";
  value: string;
}

/** Common metadata shared by all entities */
export interface EntityMeta {
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/** Key combination for a single shortcut */
export interface KeyCombo {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/** Multi-key sequence (Vim-style chords) */
export interface ChordCombo {
  sequence: KeyCombo[];
  timeoutMs: number;
}

/** Shortcut action — discriminated union */
export type ShortcutAction =
  | { type: "click"; selector: string }
  | { type: "script"; scriptId: EntityId }
  | { type: "inline_script"; code: string }
  | { type: "focus"; selector: string }
  | { type: "navigate"; url: string }
  | { type: "flow"; flowId: EntityId }
  | { type: "extraction"; extractionRuleId: EntityId };

/** Script entity */
export interface Script {
  id: EntityId;
  name: string;
  description: string;
  code: string;
  trigger: "page_load" | "manual" | "shortcut" | "event" | "schedule";
  scope: UrlPattern;
  executionWorld: "ISOLATED" | "MAIN";
  runAt: "document_start" | "document_idle" | "document_end";
  enabled: boolean;
  priority: number;
  profileId: EntityId | null;
  eventConfig?: {
    eventName: string;
    targetSelector?: string;
  };
  scheduleConfig?: {
    intervalMinutes?: number;
    cronExpression?: string;
  };
  meta: EntityMeta & {
    version: number;
    tags: string[];
  };
  templateId?: string;
}

/** Shortcut entity */
export interface Shortcut {
  id: EntityId;
  name: string;
  keyCombo: KeyCombo | ChordCombo;
  action: ShortcutAction;
  scope: UrlPattern;
  enabled: boolean;
  profileId: EntityId | null;
  meta: EntityMeta;
}

/** CSS injection rule */
export interface CSSRule {
  id: EntityId;
  name: string;
  css: string;
  scope: UrlPattern;
  enabled: boolean;
  injectAt: "document_start" | "document_idle";
  profileId: EntityId | null;
  meta: EntityMeta;
}

/** Profile for grouping automations */
export interface Profile {
  id: EntityId;
  name: string;
  description: string;
  isActive: boolean;
  meta: EntityMeta;
}

/** Condition check for flow nodes */
export interface ConditionCheck {
  type: "element_exists" | "element_visible" | "text_contains" | "url_matches";
  selector?: string;
  value?: string;
}

/** Flow node configuration — discriminated union */
export type FlowNodeConfig =
  | { type: "click"; selector: string }
  | { type: "type"; selector: string; text: string }
  | { type: "scroll"; direction: "up" | "down"; amount: number }
  | { type: "script"; scriptId: EntityId }
  | { type: "extract"; selector: string; fallbackSelectors?: string[]; attribute?: string; outputVar: string; outputActions?: ExtractionOutputAction[]; transforms?: ExtractionFieldTransform[] }
  | { type: "run_extraction"; extractionRuleId: EntityId }
  | { type: "wait_element"; selector: string; timeoutMs: number }
  | { type: "wait_ms"; duration: number }
  | { type: "wait_idle" }
  | { type: "condition"; check: ConditionCheck; thenNodeId: string; elseNodeId?: string }
  | { type: "loop"; count?: number; untilSelector?: string; bodyNodeIds: string[] }
  | { type: "open_tab"; url: string }
  | { type: "close_tab" }
  | { type: "navigate"; url: string }
  | { type: "clipboard_copy"; selector: string }
  | { type: "clipboard_paste"; selector: string };

/** A single node in a flow */
export interface FlowNode {
  id: EntityId;
  type: "action" | "condition" | "wait" | "loop" | "open_tab" | "close_tab";
  config: FlowNodeConfig;
  nextNodeId?: string;
}

/** Flow (chained automation sequence) */
export interface Flow {
  id: EntityId;
  name: string;
  description: string;
  scope: UrlPattern;
  enabled: boolean;
  profileId: EntityId | null;
  nodes: FlowNode[];
  meta: EntityMeta;
}

/** Transform applied to an extracted field value after extraction */
export type ExtractionFieldTransform =
  | { type: "trim" }
  | { type: "lowercase" }
  | { type: "uppercase" }
  | { type: "strip_html" }
  | { type: "normalize_url" }
  | { type: "normalize_whitespace" }
  | { type: "replace"; search: string; replacement: string }
  | { type: "regex_replace"; pattern: string; flags: string; replacement: string };

/** Extraction field mapping */
export interface ExtractionField {
  name: string;
  selector: string;
  /** Additional selectors tried in order if the primary returns empty */
  fallbackSelectors?: string[];
  attribute?: string;
  multiple: boolean;
  transforms?: ExtractionFieldTransform[];
}

/** Actions to perform with extracted data */
export type ExtractionOutputAction = "show" | "show_page" | "show_tab" | "clipboard" | "download";

/** How an extraction rule can be triggered */
export type ExtractionTrigger = "manual" | "shortcut" | "page_load";

/** Extraction rule entity */
export interface ExtractionRule {
  id: EntityId;
  name: string;
  scope: UrlPattern;
  enabled: boolean;
  profileId: EntityId | null;
  fields: ExtractionField[];
  outputFormat: "json" | "csv" | "markdown" | "html" | "text" | "xml";
  outputActions: ExtractionOutputAction[];
  /**
   * How this rule is triggered. Array allows combining page_load + shortcut.
   * "manual" is exclusive — selecting it deselects the others.
   * Legacy rules may still have a string value; use `normalizeTriggers()` to migrate.
   */
  triggers: ExtractionTrigger[];
  /** Key combo for shortcut trigger — auto-manages a linked Shortcut entity */
  shortcutKeyCombo?: KeyCombo;
  meta: EntityMeta;
}

/** Template category */
export type TemplateCategory =
  | "form_fill"
  | "scraping"
  | "navigation"
  | "ui_modification"
  | "accessibility"
  | "productivity"
  | "privacy"
  | "custom";

/** Bundled or community template */
export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  scripts?: Omit<Script, "id" | "meta">[];
  shortcuts?: Omit<Shortcut, "id" | "meta">[];
  cssRules?: Omit<CSSRule, "id" | "meta">[];
  flows?: Omit<Flow, "id" | "meta">[];
  extractionRules?: Omit<ExtractionRule, "id" | "meta">[];
  networkRules?: Omit<NetworkRule, "id" | "meta">[];
  author?: string;
  meta: EntityMeta & { templateVersion: string };
}

/** Import/export format */
export interface BrowserAutomataExport {
  _format: "browser-automata-export";
  _schemaVersion: number;
  _exportedAt: ISOTimestamp;
  settings?: Settings;
  profiles?: Profile[];
  scripts?: Script[];
  shortcuts?: Shortcut[];
  flows?: Flow[];
  cssRules?: CSSRule[];
  extractionRules?: ExtractionRule[];
  networkRules?: NetworkRule[];
  variables?: ScriptVariable[];
  sharedLibraries?: SharedLibrary[];
  formFillProfiles?: FormFillProfile[];
  notificationRules?: NotificationRule[];
  siteAdapters?: SiteAdapter[];
  _includesSecrets?: boolean;
}

/** Import merge strategy */
export type ImportMergeStrategy = "replace_all" | "merge_keep" | "merge_overwrite";

// ─── Phase 4 Entities ───────────────────────────────────────────────────────

/** Script variable / secret vault (F16d) */
export interface ScriptVariable {
  id: EntityId;
  key: string;
  value: string;
  isSecret: boolean;
  scope: UrlPattern;
  profileId: EntityId | null;
  meta: EntityMeta;
}

/** Shared library for @use() imports (F16c) */
export interface SharedLibrary {
  id: EntityId;
  name: string;
  description: string;
  code: string;
  exports: string[];
  meta: EntityMeta & { version: number };
}

/** Script version snapshot (F16e) */
export interface ScriptVersion {
  scriptId: EntityId;
  version: number;
  code: string;
  savedAt: ISOTimestamp;
  changeNote?: string;
}

/** Network rule for declarativeNetRequest (F15) */
export interface HeaderMod {
  operation: "set" | "append" | "remove";
  header: string;
  value?: string;
}

export type NetworkRuleAction =
  | { type: "block" }
  | { type: "redirect"; url: string }
  | { type: "modify_headers"; requestHeaders?: HeaderMod[]; responseHeaders?: HeaderMod[] };

export interface NetworkRule {
  id: EntityId;
  name: string;
  scope: UrlPattern;
  enabled: boolean;
  profileId: EntityId | null;
  urlFilter: string;
  resourceTypes?: string[];
  action: NetworkRuleAction;
  meta: EntityMeta;
}

/** Clipboard history entry (F16n) */
export interface ClipboardEntry {
  id: EntityId;
  content: string;
  contentType: "text" | "html" | "image_url";
  source?: {
    url?: string;
    scriptId?: EntityId;
    extractionRuleId?: EntityId;
  };
  timestamp: ISOTimestamp;
  pinned: boolean;
}

/** Form fill profile (F16s) */
export interface FormFieldMapping {
  selector: string;
  fallbackSelectors: string[];
  value: string;
  type: "text" | "select" | "checkbox" | "radio" | "file";
}

export interface FormFillProfile {
  id: EntityId;
  name: string;
  scope: UrlPattern;
  enabled: boolean;
  profileId: EntityId | null;
  fields: FormFieldMapping[];
  meta: EntityMeta;
}

/** Notification rule (F16v) */
export interface NotificationRule {
  id: EntityId;
  name: string;
  scope: UrlPattern;
  enabled: boolean;
  profileId: EntityId | null;
  condition: {
    type: "element_appears" | "element_disappears" | "text_contains" | "text_changes";
    selector: string;
    value?: string;
  };
  checkIntervalMinutes: number;
  notification: {
    title: string;
    message: string;
    sound: boolean;
  };
  meta: EntityMeta;
}

/** Site adapter (F16t) */
export interface SiteAdapter {
  id: EntityId;
  siteName: string;
  scope: UrlPattern;
  version: string;
  selectors: Record<string, string[]>;
  actions: Record<string, string>;
  meta: EntityMeta;
}

/** Health metrics (F16w) */
export interface HealthMetrics {
  scriptMetrics: Record<
    string,
    {
      totalRuns: number;
      successCount: number;
      errorCount: number;
      lastRunAt: ISOTimestamp;
      lastError?: string;
      avgDurationMs: number;
    }
  >;
  selectorHealth: Record<
    string,
    {
      lastTestedAt: ISOTimestamp;
      lastFoundAt?: ISOTimestamp;
      stale: boolean;
      usedBy: EntityId[];
    }
  >;
  storageUsage: {
    total: number;
    byType: Record<string, number>;
    lastCheckedAt: ISOTimestamp;
  };
}

/** Retry policy configuration (F16i) */
export interface RetryPolicy {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier: number;
  fallbackAction?: "skip" | "abort" | "notify";
}

/** Element fallback selector config (F16g) */
export interface FallbackSelectors {
  primary: string;
  fallbacks: string[];
  lastTested?: ISOTimestamp;
  stale: boolean;
}

/** Strategy label for a selector alternative */
export type SelectorStrategy =
  | "id"
  | "data-attr"
  | "aria"
  | "attribute"
  | "class"
  | "ancestor"
  | "nth-child"
  | "xpath-text"
  | "xpath-attr";

/** A single selector alternative with metadata */
export interface SelectorAlternative {
  /** The actual selector string (CSS or XPath) */
  selector: string;
  /** Human-readable strategy label */
  strategy: SelectorStrategy;
  /** Whether this is an XPath (vs CSS) selector */
  isXPath: boolean;
  /** Number of elements matched in the current document */
  matchCount: number;
}
