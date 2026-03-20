# Browser Automata — Product Specification

## 1. Vision & Purpose

**Browser Automata** is a power-tool-first Chrome extension (Manifest V3) that puts browser automation in the hands of engineers, scripters, and power users. It lets users wire keyboard shortcuts to page elements or custom scripts, run JavaScript automation scoped to domains or URL patterns, and manage everything through a compact, developer-friendly popup UI.

**Core philosophy:** Engine first, convenience second. The extension is a programmable automation layer over any website. Pre-built templates lower the entry barrier for non-technical users, but never constrain what power users can do.

**Target users:**

- Primary: developers, QA engineers, scripters, sysadmins
- Secondary: power users who install templates and customize them

**What it is NOT:**

- Not a Selenium/Playwright alternative (no headless, no test frameworks)
- Not a bot or scraper service (user-initiated, local only)
- Not a Tampermonkey clone (shortcuts-first, not just userscripts)

---

## 2. Feature Catalog

### 2.1 Complete Feature Set

#### Core Engine

| # | Feature | Description |
| --- | ------- | ----------- |
| F1 | **Script Execution Engine** | Run arbitrary JavaScript per domain/URL-pattern. Triggers: page load, manual (from popup), keyboard shortcut, DOM event, or timer. Scripts run in ISOLATED world (safe default) or MAIN world (for page JS access, opt-in per script). |
| F2 | **Keyboard Shortcut Wiring** | Bind any key combo to: click an element (CSS selector), run a stored script, run an inline JS snippet, focus an element, or navigate to a URL. Scoped per domain, per URL pattern, or global. Unlimited shortcuts (handled via content script keydown, not Chrome's 4-command limit). |
| F3 | **Per-Domain/URL-Pattern Scoping** | Every script and shortcut is scoped. Supports: exact domain, glob patterns (`*.github.com/user/*`), regex, or global (`<all_urls>`). Specificity rules determine priority when multiple patterns match. |
| F4 | **Chord Shortcuts** | Multi-key sequences like Vim: `g` then `n` for "go next". Configurable timeout between keys. |
| F5 | **Shortcut Conflict Detection** | Warn when a configured shortcut collides with browser defaults or other Browser Automata shortcuts in the same scope. |
| F6 | **CSS Injection** | Inject custom CSS per domain (theme tweaks, layout fixes, element hiding via style). Separate from JS scripts for lightweight styling changes. |

#### Automation & Intelligence

| # | Feature | Description |
| --- | ------- | ----------- |
| F7 | **Visual Element Picker** | Click-to-select elements on any page, auto-generates CSS/XPath selector. Used for shortcut target configuration and script authoring assistance. |
| F8 | **Action Recorder** | Record click/type/scroll sequences on a page, replay as automation script. Generates editable JS code from recorded actions. |
| F9 | **Conditional Logic** | If element exists / text matches / URL matches → do X, else → do Y. Built-in branching for script templates without writing raw JS. |
| F10 | **Chained Actions / Flow Builder** | Sequential flows: click → wait → type → click → extract. Visual drag-and-drop node graph for building automation sequences. |
| F11 | **Cross-Tab Flows** | Automation that spans multiple tabs (open tab → do X → close/return). Tab lifecycle management within flows. |
| F12 | **Element Watcher** | Monitor elements for DOM mutations, trigger actions on change. Useful for dynamic pages (SPAs, live feeds). |
| F13 | **Structured Data Extraction** | Define extraction rules, pull data into JSON/CSV. Auto-detect HTML tables. Copy to clipboard or download. |
| F14 | **Script Scheduling** | Run scripts on a timer (every N minutes), at specific times, or on page idle. Uses `chrome.alarms` for reliability. |
| F15 | **Network Request Interceptor** | Modify/block/redirect network requests per domain. Advanced ad blocking, API response mocking, header injection. |

#### User Interface

| # | Feature | Description |
| --- | ------- | ----------- |
| F16 | **Popup UI** | Compact popup (400x580px) for quick access — script list, shortcut overview, domain toggles, activity log. React + Tailwind, dark theme default. |
| F17 | **Full-Page Options** | Full browser tab for heavy editing — larger CodeMirror editor, bulk management, drag-and-drop reordering, detailed configuration. Shared components with popup. |
| F18 | **Activity Log** | Timestamped, color-coded log of all actions (script executions, shortcut triggers, errors). Filterable by domain, action type, status. Expandable error details with stack traces. |
| F19 | **Pre-Built Templates** | Bundled starter automations: Cookie Banner Dismisser, Video Navigator, Element Hider, Dark Mode Injector, Auto-Clicker, and more. One-click install, editable after install. |
| F20 | **Template Marketplace / Sharing** | Community-shared scripts and templates beyond the bundled set. Import/export individual templates. |

#### Developer Experience

| # | Feature | Description |
| --- | ------- | ----------- |
| F16b | **Script Debugging Console** | In-popup/options console panel that captures `console.log`, `console.warn`, `console.error` from injected scripts. Displays output with timestamps. Filter by script. Clear/export. |
| F16c | **Script Dependencies / Shared Libraries** | Define shared utility modules (DOM helpers, common selectors, API wrappers) that any script can import via `@use('library-name')` syntax. Resolved at injection time. |
| F16d | **Script Variables / Secrets Vault** | Store reusable values (API keys, usernames, tokens, URLs) separately from script code. Inject at runtime via `{{variableName}}` template syntax. Secrets are masked in UI and never exported by default. |
| F16e | **Script Version History** | Track changes to scripts. View diff between versions. Rollback to any previous version. Auto-saved on every edit. |
| F16f | **TypeScript Support** | Write scripts in TypeScript. Transpiled on save via built-in mini compiler (esbuild/swc). Type errors shown inline in editor. Output is always JavaScript. |

#### Resilience & Smart Automation

| # | Feature | Description |
| --- | ------- | ----------- |
| F16g | **Element Fallback Selectors** | Ordered list of selectors to try when the primary one breaks. Per shortcut or script. Auto-detect selector staleness by testing on page load. |
| F16h | **Smart Wait Strategies** | Auto-detect SPA route changes, network idle, animation completion, React/Vue render cycles. Beyond `setTimeout` — intelligent page readiness detection. |
| F16i | **Retry Policies** | Configurable retry-on-failure with exponential backoff. Per script or per flow node. Max retries, delay between retries, fallback action on exhaustion. |
| F16j | **Page Readiness Detection** | Detect when a SPA page has fully rendered (beyond `DOMContentLoaded`). Monitor network activity, DOM stability, and framework-specific signals. |

#### Data & Integration

| # | Feature | Description |
| --- | ------- | ----------- |
| F16k | **Webhook / HTTP Requests** | Trigger outbound HTTP calls from scripts or flows. POST extracted data to an API, trigger webhooks, fetch remote config. Built-in `fetch` wrapper with auth headers. |
| F16l | **Local File Output** | Save extraction results, logs, or screenshots directly to a local file via `chrome.downloads`. Configurable output path and format. |
| F16m | **Multi-Format Extraction** | Beyond JSON/CSV: Markdown tables, HTML snippets, plain text, XML. Format selection per extraction rule. |
| F16n | **Clipboard History** | Keep last N clipboard operations (default 20) for paste-back. Accessible from popup. Searchable. Auto-expires after configurable time. |

#### Collaboration & Ecosystem

| # | Feature | Description |
| --- | ------- | ----------- |
| F16o | **Script Ratings & Reviews** | In the marketplace, rate and review community scripts. Sort by rating, downloads, recency. Flag inappropriate content. |
| F16p | **Script Auto-Update** | Installed marketplace scripts can check for newer versions. Notification when update available. One-click update with diff preview. |
| F16q | **Script Permissions Model** | Templates and marketplace scripts declare required capabilities (DOM access, network, clipboard, file system). User reviews and approves permissions before install. |

#### Advanced Automation

| # | Feature | Description |
| --- | ------- | ----------- |
| F16r | **Screenshot Capture** | Take screenshots of specific elements or full page as part of flows. Save to file or clipboard. Configurable format (PNG/JPEG) and quality. |
| F16s | **Form Auto-Fill Profiles** | Store complete form field mappings (field selector → value). Fill entire forms on shortcut. Multiple fill profiles per domain. |
| F16t | **Site-Specific Adapters** | Pre-built integration points for popular sites (YouTube, GitHub, Gmail, Twitter) with maintained stable selectors and common actions. Updated with extension releases. |
| F16u | **Background Tab Execution** | Run flows and scripts on background tabs without switching to them. Useful for monitoring, periodic scraping, and batch operations. |

#### Notifications & Monitoring

| # | Feature | Description |
| --- | ------- | ----------- |
| F16v | **Custom Notification Rules** | "Notify me when element X appears/disappears on site Y." Monitoring use case with configurable check intervals and notification channels (Chrome notification, badge, sound). |
| F16w | **Health Dashboard** | Overview of script health: failure rates, stale selectors, storage usage breakdown per entity type, most/least used automations. Available in options page. |

#### Management & Configuration

| # | Feature | Description |
| --- | ------- | ----------- |
| F21 | **Import/Export** | Export entire config (scripts, shortcuts, settings) as JSON. Import with validation and merge strategies (replace all, merge keep existing, merge overwrite). Partial export supported. |
| F22 | **Profiles** | Switch between automation sets (work mode, personal mode, project-specific). Each profile has its own scripts, shortcuts, and settings. |
| F23 | **Global Kill Switch** | Single toggle to enable/disable all automation instantly. Accessible from popup header and via Chrome command shortcut. |
| F24 | **Clipboard Integration** | Copy extracted data to clipboard, paste from clipboard into form fields as part of automation flows. |
| F25 | **Error Surfacing** | Badge on extension icon for unread errors. Chrome notifications for background errors (when popup is closed). Inline error display in script editor. All errors logged with context. |
| F26 | **Schema Versioning** | Config schema version tracked for migration support. Sequential migration framework for non-breaking upgrades across extension updates. |

---

## 3. Tech Stack

| Layer | Choice | Rationale |
| -------| -------- | ----------- |
| **Extension Platform** | Chrome Manifest V3 | Required for Chrome Web Store; future-proof (MV2 deprecated) |
| **Language** | TypeScript 5.x (strict mode) | Type safety across service worker, content script, and popup contexts |
| **UI Framework** | React 18 | Component model, ecosystem, team familiarity |
| **Styling** | Tailwind CSS 4 | Utility-first, compact output, dark theme support |
| **Build Tool** | Vite 6 + CRXJS (`@crxjs/vite-plugin` v2) | CRXJS handles MV3 multi-entry builds (popup, content script, service worker), HMR in dev, correct manifest output |
| **Code Editor** | CodeMirror 6 | ~100KB tree-shaken vs Monaco's 2MB+; critical for fast popup open/close (<50ms init) |
| **State Management** | Zustand | No Provider needed (ideal for popup mount/unmount lifecycle); slice pattern; tiny bundle |
| **Virtual Scroll** | `@tanstack/react-virtual` | For activity log (500+ entries); prevents popup jank |
| **Testing** | Vitest | Native Vite integration, fast, TypeScript-first |
| **IDs** | `crypto.randomUUID()` | Built-in, zero dependencies |
| **Icons** | Lucide React (tree-shaken) | Consistent, lightweight, MIT |

### MV3-Specific Constraints That Shape the Stack

| Constraint | Impact | Solution |
| ---------- | ------ | -------- |
| No persistent background page | All state must survive service worker termination | Everything in `chrome.storage.local`; no module-level state that matters |
| No `eval()` in content scripts | Can't run user code directly in content script context | Use `chrome.scripting.executeScript` with `new Function()` inside injected func (MV3-legal pattern) |
| `chrome.commands` limited to 4 | Can't register unlimited shortcuts via Chrome API | Per-domain shortcuts handled entirely by content script `keydown` listeners |
| Service worker event listeners must be synchronous | Can't register listeners inside async callbacks | All listeners at top-level of service worker entry; async init runs after |
| Service worker terminates after ~30s idle | Long operations may be interrupted | `chrome.alarms` keep-alive during multi-step operations; flow executor checkpoints state |
| `declarativeNetRequest` rule limits | Max 5000 dynamic rules | More than sufficient; each NetworkRule maps to 1-3 dynamic rules |
| No `webRequest` blocking in MV3 | Can't intercept requests programmatically | Use `declarativeNetRequest` for block/redirect/header modification |

### Required Permissions

```text
permissions: [
  "storage",                  // chrome.storage.local and sync
  "activeTab",                // Access active tab on user gesture
  "scripting",                // chrome.scripting.executeScript + insertCSS
  "tabs",                     // Tab URL reading, tab management for cross-tab flows
  "alarms",                   // Keep-alive + scheduled scripts
  "clipboardWrite",           // Clipboard integration for extraction
  "clipboardRead",            // Clipboard paste in automation
  "notifications",            // Error notifications when popup is closed
  "declarativeNetRequest",    // Network request blocking/modification
  "declarativeNetRequestFeedback"  // Log blocked requests
]

host_permissions: ["<all_urls>"]  // Required for scripting.executeScript on any site

optional_permissions: [
  "downloads"                 // Export to file functionality
]
```

---

## 4. Data Model

### 4.1 Core Entities

#### Script

```text
Script {
  id: EntityId
  name: string
  description: string
  code: string                          // Raw JavaScript source
  trigger: 'page_load' | 'manual' | 'shortcut' | 'event' | 'schedule'
  scope: UrlPattern                     // Where this script is active
  executionWorld: 'ISOLATED' | 'MAIN'   // MAIN = access page JS objects
  runAt: 'document_start' | 'document_idle' | 'document_end'
  enabled: boolean
  priority: number                      // Lower = runs first (default 100)
  profileId?: EntityId                  // Which profile this belongs to (null = all profiles)
  eventConfig?: {                       // When trigger = 'event'
    eventName: string                   // DOM event: 'click', 'scroll', 'DOMContentLoaded'
    targetSelector?: string             // Optional scope for the event listener
  }
  scheduleConfig?: {                    // When trigger = 'schedule'
    intervalMinutes?: number            // Run every N minutes
    cronExpression?: string             // Or cron-like schedule
  }
  meta: {
    createdAt, updatedAt: ISOTimestamp
    version: number                     // Bumped on every save
    tags: string[]
  }
  templateId?: string                   // If created from a template
}
```

#### Shortcut

```text
Shortcut {
  id: EntityId
  name: string
  keyCombo: KeyCombo | ChordCombo       // Single combo or multi-key chord
  action:
    | { type: 'click', selector: string }
    | { type: 'script', scriptId: string }
    | { type: 'inline_script', code: string }
    | { type: 'focus', selector: string }
    | { type: 'navigate', url: string }
    | { type: 'flow', flowId: string }
  scope: UrlPattern
  enabled: boolean
  profileId?: EntityId                  // Which profile this belongs to
  meta: { createdAt, updatedAt: ISOTimestamp }
}

KeyCombo {
  key: string                           // e.g. "k", "ArrowRight", "Enter"
  ctrlKey, shiftKey, altKey, metaKey: boolean
}

ChordCombo {
  sequence: KeyCombo[]                  // e.g. [g, n] for Vim-style "gn"
  timeoutMs: number                     // Max time between keys (default 500ms)
}
```

#### Flow (Chained Actions)

```text
Flow {
  id: EntityId
  name: string
  description: string
  scope: UrlPattern
  enabled: boolean
  profileId?: EntityId
  nodes: FlowNode[]                     // Ordered sequence of actions
  meta: { createdAt, updatedAt: ISOTimestamp }
}

FlowNode {
  id: EntityId                          // Node ID within flow
  type: 'action' | 'condition' | 'wait' | 'loop' | 'open_tab' | 'close_tab'
  config:
    | { type: 'click', selector: string }
    | { type: 'type', selector: string, text: string }
    | { type: 'scroll', direction: 'up' | 'down', amount: number }
    | { type: 'script', scriptId: string }
    | { type: 'extract', selector: string, attribute?: string, outputVar: string }
    | { type: 'wait_element', selector: string, timeoutMs: number }
    | { type: 'wait_ms', duration: number }
    | { type: 'wait_idle' }
    | { type: 'condition', check: ConditionCheck, thenNodeId: string, elseNodeId?: string }
    | { type: 'loop', count?: number, untilSelector?: string, bodyNodeIds: string[] }
    | { type: 'open_tab', url: string }
    | { type: 'close_tab' }
    | { type: 'navigate', url: string }
    | { type: 'clipboard_copy', selector: string }
    | { type: 'clipboard_paste', selector: string }
  nextNodeId?: string                   // Next node in sequence (null = end)
}

ConditionCheck {
  type: 'element_exists' | 'element_visible' | 'text_contains' | 'url_matches'
  selector?: string
  value?: string                        // Text to match or URL pattern
}
```

#### CSS Rule

```text
CSSRule {
  id: EntityId
  name: string
  css: string                           // Raw CSS to inject
  scope: UrlPattern
  enabled: boolean
  injectAt: 'document_start' | 'document_idle'
  profileId?: EntityId
  meta: { createdAt, updatedAt: ISOTimestamp }
}
```

#### Extraction Rule

```text
ExtractionRule {
  id: EntityId
  name: string
  scope: UrlPattern
  enabled: boolean
  profileId?: EntityId
  fields: ExtractionField[]
  outputFormat: 'json' | 'csv' | 'markdown' | 'html' | 'text' | 'xml'
  trigger: 'manual' | 'shortcut' | 'page_load'
  meta: { createdAt, updatedAt: ISOTimestamp }
}

ExtractionField {
  name: string                          // Column/key name
  selector: string                      // CSS selector
  attribute?: string                    // 'textContent' (default), 'href', 'src', etc.
  multiple: boolean                     // Extract all matches or just first
}
```

#### Network Rule

```text
NetworkRule {
  id: EntityId
  name: string
  scope: UrlPattern
  enabled: boolean
  profileId?: EntityId
  urlFilter: string                     // URL pattern to match requests
  resourceTypes?: string[]              // 'script', 'image', 'stylesheet', etc.
  action:
    | { type: 'block' }
    | { type: 'redirect', url: string }
    | { type: 'modify_headers', requestHeaders?: HeaderMod[], responseHeaders?: HeaderMod[] }
  meta: { createdAt, updatedAt: ISOTimestamp }
}

HeaderMod {
  operation: 'set' | 'append' | 'remove'
  header: string
  value?: string
}
```

#### Profile

```text
Profile {
  id: EntityId
  name: string                          // e.g. "Work", "Personal", "Project X"
  description: string
  isActive: boolean                     // Only one profile active at a time
  meta: { createdAt, updatedAt: ISOTimestamp }
}
```

#### Script Variable / Secret

```text
ScriptVariable {
  id: EntityId
  key: string                           // Variable name, e.g. "API_KEY", "USERNAME"
  value: string                         // The actual value
  isSecret: boolean                     // If true: masked in UI, excluded from export by default
  scope: UrlPattern                     // Which domains can access this variable
  profileId?: EntityId
  meta: { createdAt, updatedAt: ISOTimestamp }
}
```

Variables are injected into script code at runtime by replacing `{{variableName}}` placeholders before execution.

#### Shared Library

```text
SharedLibrary {
  id: EntityId
  name: string                          // Import name, e.g. "dom-helpers", "api-utils"
  description: string
  code: string                          // JavaScript module code
  exports: string[]                     // List of exported function/variable names (for autocomplete)
  meta: { createdAt, updatedAt: ISOTimestamp; version: number }
}
```

Scripts reference libraries via `// @use('dom-helpers')` directive. At injection time, the library code is prepended to the script code.

#### Script Version

```text
ScriptVersion {
  scriptId: EntityId
  version: number
  code: string                          // Snapshot of the code at this version
  savedAt: ISOTimestamp
  changeNote?: string                   // Optional user-provided note
}
```

Auto-saved on every script save. Stored as an array per script. Capped at last 50 versions per script. Older versions pruned automatically.

#### Form Fill Profile

```text
FormFillProfile {
  id: EntityId
  name: string                          // e.g. "Work Address", "Test Account"
  scope: UrlPattern
  enabled: boolean
  profileId?: EntityId
  fields: FormFieldMapping[]
  meta: { createdAt, updatedAt: ISOTimestamp }
}

FormFieldMapping {
  selector: string                      // CSS selector for the input element
  fallbackSelectors: string[]           // Backup selectors if primary fails
  value: string                         // Value to fill (supports {{variables}})
  type: 'text' | 'select' | 'checkbox' | 'radio' | 'file'
}
```

#### Notification Rule

```text
NotificationRule {
  id: EntityId
  name: string
  scope: UrlPattern
  enabled: boolean
  profileId?: EntityId
  condition: {
    type: 'element_appears' | 'element_disappears' | 'text_contains' | 'text_changes'
    selector: string
    value?: string                      // For text_contains
  }
  checkIntervalMinutes: number          // How often to check (default 5)
  notification: {
    title: string
    message: string                     // Supports {{element.text}} placeholders
    sound: boolean
  }
  meta: { createdAt, updatedAt: ISOTimestamp }
}
```

#### Site Adapter

```text
SiteAdapter {
  id: EntityId
  siteName: string                      // e.g. "YouTube", "GitHub", "Gmail"
  scope: UrlPattern                     // e.g. "*://*.youtube.com/*"
  version: string
  selectors: Record<string, string[]>   // Named selectors with fallbacks
                                        // e.g. "nextButton": [".ytp-next-button", "[aria-label='Next']"]
  actions: Record<string, string>       // Named actions as JS snippets
                                        // e.g. "skipAd": "document.querySelector('.ytp-ad-skip-button')?.click()"
  meta: { createdAt, updatedAt: ISOTimestamp }
}
```

Site adapters are bundled with the extension and maintained across releases. Users can also create custom adapters.

#### Clipboard History Entry

```text
ClipboardEntry {
  id: EntityId
  content: string
  contentType: 'text' | 'html' | 'image_url'
  source: {                             // Where this was copied from
    url?: string
    scriptId?: EntityId
    extractionRuleId?: EntityId
  }
  timestamp: ISOTimestamp
  pinned: boolean                       // Pinned items don't auto-expire
}
```

Circular buffer, max 20 entries by default (configurable). Non-pinned entries auto-expire after configurable duration.

#### Health Metrics

```text
HealthMetrics {
  scriptMetrics: Record<EntityId, {
    totalRuns: number
    successCount: number
    errorCount: number
    lastRunAt: ISOTimestamp
    lastError?: string
    avgDurationMs: number
  }>
  selectorHealth: Record<string, {      // Keyed by selector string
    lastTestedAt: ISOTimestamp
    lastFoundAt?: ISOTimestamp
    stale: boolean                      // True if not found in last 3 checks
    usedBy: EntityId[]                  // Scripts/shortcuts that reference this selector
  }>
  storageUsage: {
    total: number                       // Bytes
    byType: Record<string, number>      // scripts, shortcuts, flows, logs, etc.
    lastCheckedAt: ISOTimestamp
  }
}
```

Computed periodically by the service worker and cached in storage.

#### UrlPattern (shared value object)

```text
UrlPattern {
  type: 'exact' | 'glob' | 'regex' | 'global'
  value: string                         // Ignored when type is 'global'
}

Specificity ranking (highest first):
  1. exact    ("github.com")
  2. glob     ("github.com/user/*")     — no host wildcard
  3. glob     ("*.github.com")          — host wildcard
  4. regex    ("^https://github\.com/.*")
  5. global   (matches everything)
```

#### Activity Log Entry

```text
ActivityLogEntry {
  seq: number                           // Monotonically increasing
  timestamp: ISOTimestamp
  action: 'script_executed' | 'script_error' | 'shortcut_triggered' | 'flow_executed'
        | 'flow_error' | 'css_injected' | 'network_rule_applied' | 'extraction_completed'
        | 'schedule_fired' | 'profile_switched' | 'system' | ...
  status: 'success' | 'error' | 'warning' | 'info'
  url?: string
  domain?: string
  entityId?: EntityId                   // Script, shortcut, flow, etc.
  entityType?: 'script' | 'shortcut' | 'flow' | 'css_rule' | 'network_rule' | 'extraction'
  message: string
  error?: { name, message, stack }
  details?: Record<string, unknown>     // Extra context (extracted data, timing, etc.)
}
```

#### Template

```text
Template {
  id: EntityId
  name: string
  description: string
  category: 'form_fill' | 'scraping' | 'navigation' | 'ui_modification'
           | 'accessibility' | 'productivity' | 'privacy' | 'custom'
  tags: string[]
  scripts?: Script[] (without id/meta)
  shortcuts?: Shortcut[] (without id/meta)
  flows?: Flow[] (without id/meta)
  cssRules?: CSSRule[] (without id/meta)
  extractionRules?: ExtractionRule[] (without id/meta)
  networkRules?: NetworkRule[] (without id/meta)
  author?: string
  meta: { createdAt, updatedAt, templateVersion }
}
```

#### Settings

```text
Settings {
  globalEnabled: boolean                // Master kill switch
  activeProfileId?: EntityId            // Currently active profile (null = no profile filter)
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error' | 'off'
    maxEntries: number                  // Default 5000
  }
  ui: {
    theme: 'system' | 'light' | 'dark'
    confirmBeforeRun: boolean
  }
  execution: {
    scriptTimeoutMs: number             // Default 30000
    injectIntoIframes: boolean          // Default false
    chordTimeoutMs: number              // Default 500ms between chord keys
  }
}
```

### 4.2 Storage Strategy

| Storage | What | Why |
| ------- | ---- | --- |
| `chrome.storage.local` (~10MB) | Scripts, shortcuts, flows, CSS rules, extraction rules, network rules, profiles, logs, templates | Large payloads (script code, flows), high volume (logs) |
| `chrome.storage.sync` (~100KB) | Settings, schema version | Small data that should follow user across machines |

**Key layout** (flat, namespaced):

```text
chrome.storage.local:
  scripts             → Record<id, Script>
  shortcuts           → Record<id, Shortcut>
  flows               → Record<id, Flow>
  cssRules            → Record<id, CSSRule>
  extractionRules     → Record<id, ExtractionRule>
  networkRules        → Record<id, NetworkRule>
  profiles            → Record<id, Profile>
  variables           → Record<id, ScriptVariable>
  sharedLibraries     → Record<id, SharedLibrary>
  scriptVersions      → Record<scriptId, ScriptVersion[]>  (last 50 per script)
  formFillProfiles    → Record<id, FormFillProfile>
  notificationRules   → Record<id, NotificationRule>
  siteAdapters        → Record<id, SiteAdapter>
  clipboardHistory    → ClipboardEntry[]  (circular buffer, max 20)
  healthMetrics       → HealthMetrics
  log                 → ActivityLogEntry[]  (circular buffer, capped)
  schemaVersion       → number

chrome.storage.sync:
  settings            → Settings
```

### 4.3 Import/Export Format

```text
BrowserAutomataExport {
  _format: 'browser-automata-export'    // File validation marker
  _schemaVersion: number
  _exportedAt: ISOTimestamp
  settings: Settings
  profiles: Profile[]
  scripts: Script[]
  shortcuts: Shortcut[]
  flows: Flow[]
  cssRules: CSSRule[]
  extractionRules: ExtractionRule[]
  networkRules: NetworkRule[]
  variables: ScriptVariable[]           // Secrets excluded unless explicitly opted in
  sharedLibraries: SharedLibrary[]
  formFillProfiles: FormFillProfile[]
  notificationRules: NotificationRule[]
  siteAdapters: SiteAdapter[]
}
```

**Import merge strategies:**

- **Replace all** — wipe existing, write imported
- **Merge (keep existing)** — import only new IDs
- **Merge (overwrite)** — imported version wins for matching IDs

**Validation on import:** format check, schema version compatibility, referential integrity (shortcut → script/flow ID exists, flow nodes → script IDs exist), shortcut conflict warnings.

---

## 5. Architecture Overview

### 5.1 Extension Contexts

```text
┌──────────────────────────────────────────────────────────────────┐
│                          CHROME BROWSER                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐   msgs    ┌──────────────┐  storage│
│  │  Popup   │  │ Options  │◄─────────►│   Service     │◄───────►│ chrome.storage
│  │  (React) │  │  (React) │  port/msg │   Worker      │         │
│  └──────────┘  └──────────┘           │  (Background) │         │
│                                        └──────┬───────┘         │
│                                               │                  │
│                               chrome.scripting│.executeScript    │
│                               chrome.tabs     │.sendMessage      │
│                    chrome.declarativeNetRequest│ (network rules)  │
│                               chrome.alarms   │ (scheduling)     │
│                                               ▼                  │
│                                        ┌──────────────┐         │
│                                        │   Content     │         │
│                                        │   Script      │         │
│                                        │  (per tab)    │         │
│                                        └──────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Service Worker Subsystems

The service worker orchestrates all automation. Its internal modules:

| Module | Responsibility |
| ------ | -------------- |
| **message-router** | Single `onMessage` listener, dispatches by `message.type` |
| **script-manager** | CRUD + injection of user scripts via `chrome.scripting.executeScript` |
| **shortcut-manager** | Chrome commands + dispatching shortcut actions (single + chord) |
| **flow-executor** | Walks flow node graphs, executing each step sequentially with waits/conditions |
| **css-injector** | Injects CSS rules via `chrome.scripting.insertCSS` |
| **network-manager** | Manages `chrome.declarativeNetRequest` dynamic rules |
| **extraction-engine** | Injects extraction scripts, collects results, formats as JSON/CSV/MD/HTML/XML |
| **schedule-manager** | Creates/manages `chrome.alarms` for scheduled script triggers + notification checks |
| **profile-manager** | Switches active profile, filters entities by profile |
| **storage-controller** | Typed CRUD over `chrome.storage`, schema migration |
| **recorder** | Records user actions from content script, generates script code |
| **variable-resolver** | Resolves `{{variableName}}` placeholders in scripts before injection |
| **library-resolver** | Resolves `@use('lib-name')` directives, prepends library code |
| **version-tracker** | Auto-saves script versions on edit, manages rollback |
| **typescript-compiler** | Transpiles TypeScript scripts to JavaScript via esbuild/swc |
| **health-monitor** | Tracks script success/failure rates, tests selector staleness, monitors storage |
| **notification-checker** | Periodically checks notification rule conditions, fires Chrome notifications |
| **clipboard-manager** | Maintains clipboard history ring buffer |
| **form-filler** | Injects form fill values based on FormFillProfile mappings |
| **retry-handler** | Wraps script/flow execution with configurable retry + backoff logic |
| **smart-wait** | Intelligent page readiness detection (network idle, DOM stable, SPA route change) |

### 5.3 Key Message Flows

**Script execution (page load):**

```text
Tab navigates → content script sends CONTENT_READY { url } → SW
  → SW queries matching scripts (by URL pattern, trigger, profile)
  → For each match: chrome.scripting.executeScript(tabId, script)
  → Result/error captured, logged
```

**Shortcut triggered (single or chord):**

```text
User presses key combo → content script matches against active shortcuts
  → 'click'/'focus': directly interacts with DOM
  → 'script': sends SHORTCUT_FIRED → SW injects via scripting API
  → 'flow': sends SHORTCUT_FIRED → SW starts flow-executor
  → Result logged
```

**Flow execution:**

```text
Flow triggered (manual, shortcut, or schedule)
  → flow-executor loads Flow from storage
  → Walks nodes sequentially:
    → action nodes: inject script / click / type via content script
    → condition nodes: evaluate, branch to then/else
    → wait nodes: wait for element / timer
    → loop nodes: repeat body until condition
    → tab nodes: chrome.tabs.create / chrome.tabs.remove
  → Each step logged, errors halt flow (or skip if configured)
```

**Network rule application:**

```text
NetworkRule created/updated → network-manager
  → Converts to chrome.declarativeNetRequest.UpdateDynamicRules format
  → Rules applied at browser level (no content script needed)
  → Blocked/redirected requests logged
```

**Scheduled script:**

```text
Script with trigger='schedule' saved → schedule-manager
  → Creates chrome.alarm with intervalMinutes
  → On alarm fire: find matching tabs → inject script
  → Result logged
```

**Action recording:**

```text
User starts recording → SW sends START_RECORDING to content script
  → Content script captures clicks, keystrokes, scrolls, navigations
  → Each action sent as RECORDED_ACTION to SW
  → User stops recording → SW generates Script code from action sequence
  → Script saved to storage, available for editing
```

### 5.4 Message Protocol (Typed Discriminated Union)

```text
Popup / Options → Service Worker:
  SCRIPT_SAVE, SCRIPT_DELETE, SCRIPT_RUN_NOW, SCRIPT_TOGGLE
  SHORTCUT_SAVE, SHORTCUT_DELETE, SHORTCUT_TOGGLE
  FLOW_SAVE, FLOW_DELETE, FLOW_RUN_NOW
  CSS_RULE_SAVE, CSS_RULE_DELETE
  EXTRACTION_RULE_SAVE, EXTRACTION_RULE_DELETE, EXTRACTION_RUN_NOW
  NETWORK_RULE_SAVE, NETWORK_RULE_DELETE
  PROFILE_SAVE, PROFILE_DELETE, PROFILE_SWITCH
  START_RECORDING, STOP_RECORDING
  GET_STATE, IMPORT_CONFIG, EXPORT_CONFIG
  GET_LOG, CLEAR_LOG

Service Worker → Content Script:
  EXECUTE_SCRIPT, UPDATE_SHORTCUTS, UPDATE_CSS
  START_RECORDING, STOP_RECORDING
  EXTRACT_DATA, PICK_ELEMENT
  PING

Content Script → Service Worker:
  CONTENT_READY, EXECUTION_RESULT, EXECUTION_ERROR
  SHORTCUT_FIRED, RECORDED_ACTION
  EXTRACTION_RESULT, ELEMENT_PICKED
```

---

## 6. UX Design

### 6.1 Popup Layout

Target: **400w x 580h** (Chrome popup constraints: max 800x600)

```
┌────────────────────────────────────────┐
│ [icon] Browser Automata      [⚙] [●/○]│  ← 40px fixed header
├────────────────────────────────────────┤     (gear=settings, ●=global toggle)
│                                        │
│                                        │
│         Scrollable View Area           │  ← flex-1 overflow-y-auto
│         (changes per active tab)       │
│                                        │
│                                        │
├────────────────────────────────────────┤
│ Scripts │ Keys │ Flows │ Log │  ···   │  ← 44px fixed bottom tab bar
└────────────────────────────────────────┘    (··· = More menu: Domains, CSS,
                                                    Network, Extract, Templates,
                                                    Profiles, Settings)
```

**Design decisions:**

- **Bottom tab bar** — larger tap targets, leaves top for contextual actions
- **Full-view replacement** for editors (not modals) — modals waste space in 400x580
- **Dark theme default** (Slate-900 bg, Emerald active, Rose errors)
- **Compact typography** — `text-xs` (12px) base, `text-xxs` (10px) for timestamps/badges

### 6.2 Scripts View

**List state:**

```
┌────────────────────────────────────────┐
│ Scripts                  [+ New] [🔍]  │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ● Auto-fill Login          [▶] [≡]│ │  ← enabled script
│ │   github.com · on load            │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ ○ Cookie Cleaner           [▶] [≡]│ │  ← disabled (dimmed)
│ │   * · manual                      │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

**Editor state** (full-view replacement on card click):

```
┌────────────────────────────────────────┐
│ ← Back       Edit Script    [Save] [▶]│
├────────────────────────────────────────┤
│ Name:    [Auto-fill Login__________]   │
│ Domain:  [github.com_______________]   │
│ Trigger: [● Page Load ○ Manual ○ Key]  │
│ World:   [● Isolated  ○ Main]          │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ // your code here                  │ │  ← CodeMirror 6
│ │ document.querySelector('#login')   │ │
│ │   .value = 'user';                │ │
│ └────────────────────────────────────┘ │
│ [Enable ●]                    [Delete] │
└────────────────────────────────────────┘
```

### 6.3 Shortcuts View

Grouped by domain scope:

```
┌────────────────────────────────────────┐
│ Shortcuts                    [+ New]   │
├────────────────────────────────────────┤
│ ┌─ Global ─────────────────────────┐   │
│ │ [Ctrl+Shift+S] → Run "Scraper"  │   │
│ │ [Ctrl+Shift+D] → Click #dark-btn│   │
│ └──────────────────────────────────┘   │
│ ┌─ github.com ─────────────────────┐   │
│ │ [Ctrl+E] → Click .edit-btn      │   │
│ │ ⚠ [Ctrl+S] conflicts w/ browser │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

**Shortcut form:** Key capture input → action type radio → target (selector or script dropdown) → domain scope

### 6.4 Domains View

Derived data (not separate storage) — aggregated from scripts + shortcuts:

```
┌────────────────────────────────────────┐
│ Domains                        [🔍]   │
├────────────────────────────────────────┤
│ ● Current: github.com                 │  ← highlighted
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ github.com                  [●/○] │ │
│ │ 3 scripts · 2 shortcuts           │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ * (Global)                  [●/○] │ │
│ │ 2 scripts · 4 shortcuts           │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

Accordion expand shows associated scripts/shortcuts per domain.

### 6.5 Activity Log

```
┌────────────────────────────────────────┐
│ Activity Log             [Clear] [🔽] │
├─ Filters (collapsible) ───────────────┤
│ Domain: [All▾] Type: [All▾] Status: [All▾]│
├────────────────────────────────────────┤
│ 14:32:05 ● github.com                 │
│   Ran "Auto-fill Login" (12ms)        │
│ 14:31:58 ● github.com                 │
│   Shortcut Ctrl+E → clicked .edit     │
│ 14:30:12 ✕ *.google.com              │
│   Ran "Filter" — TypeError: null      │
│   [Show Details ▼]                    │
└────────────────────────────────────────┘
```

Virtual scroll for 500+ entries. Green dot = success, red X = error, amber = warning.

### 6.6 Templates Gallery

```
┌────────────────────────────────────────┐
│ Templates                      [🔍]   │
├────────────────────────────────────────┤
│ ┌────────────┐  ┌────────────┐        │
│ │  Cookie    │  │  Video     │        │  ← 2-column grid
│ │  Dismisser │  │  Navigator │        │
│ │ [Preview]  │  │ [Preview]  │        │
│ │ [Install]  │  │ [Install]  │        │
│ └────────────┘  └────────────┘        │
│ ┌────────────┐  ┌────────────┐        │
│ │  Element   │  │  Dark Mode │        │
│ │  Hider     │  │  Injector  │        │
│ │ [Preview]  │  │ [Preview]  │        │
│ │ [Install]  │  │ [Install]  │        │
│ └────────────┘  └────────────┘        │
└────────────────────────────────────────┘
```

Preview opens full-view with read-only CodeMirror showing the script code. Install copies to user's scripts collection with fresh IDs.

### 6.7 Flow Builder View

The flow builder is the visual automation editor. In the popup, flows appear as a simple list (like scripts). The full flow editor is in the options page where there is room for the node graph.

**Popup (list view):**

```text
┌────────────────────────────────────────┐
│ Flows                  [+ New] [🔍]   │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ● Login Sequence           [▶] [≡]│ │
│ │   github.com · 5 steps            │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ ● Scrape Prices            [▶] [≡]│ │
│ │   *.amazon.com · 8 steps · loop   │ │
│ └────────────────────────────────────┘ │
│         [Open Full Editor →]          │
└────────────────────────────────────────┘
```

**Options page (node graph):**

```text
┌──────────────────────────────────────────────────────────────┐
│ Flow: Login Sequence                    [Save] [▶ Run] [Del]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Navigate]──→[Wait #login]──→[Type user]──→[Type pass]     │
│                                     │                        │
│                                     ▼                        │
│                              [Click Submit]──→[Condition]    │
│                                              ╱          ╲    │
│                                      [success]      [retry]  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Node palette: [Click] [Type] [Wait] [Script] [Condition]    │
│               [Loop] [Extract] [Open Tab] [Navigate]        │
└──────────────────────────────────────────────────────────────┘
```

Nodes are draggable, connectable via edges. Each node opens a config panel on click (selector, text, timeout, etc.).

### 6.8 CSS Rules View

```text
┌────────────────────────────────────────┐
│ CSS Rules                    [+ New]   │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ● Dark Mode Override       [●/○]  │ │
│ │   *.reddit.com                    │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ ● Hide Sidebar             [●/○]  │ │
│ │   twitter.com                     │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

Editor view: CodeMirror with CSS syntax highlighting. Same full-view replacement pattern as scripts.

### 6.9 Network Rules View

```text
┌────────────────────────────────────────┐
│ Network Rules                [+ New]   │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ● Block Trackers           [●/○]  │ │
│ │   global · block · 12 patterns    │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ ● Mock API Response        [●/○]  │ │
│ │   localhost:3000 · redirect       │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

Form: URL filter pattern, resource types (checkboxes), action type (block/redirect/modify headers), header modifications.

### 6.10 Extraction Rules View

```text
┌────────────────────────────────────────┐
│ Extraction Rules             [+ New]   │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ● Product Prices           [▶] [≡]│ │
│ │   *.amazon.com · 3 fields · JSON  │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

Editor: field mapping table (name, CSS selector, attribute, multiple toggle). Preview button runs extraction on active tab and shows result in a data table.

### 6.11 Profiles View

```text
┌────────────────────────────────────────┐
│ Profiles                     [+ New]   │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ ● Work                  [Active ●]│ │
│ │   12 scripts · 5 shortcuts        │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │   Personal                 [Use]  │ │
│ │   8 scripts · 3 shortcuts         │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │   No Profile (all items)   [Use]  │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

Switching profiles filters which scripts, shortcuts, flows, etc. are active. Items not assigned to any profile are always active.

### 6.12 Action Recorder

Accessible via a floating button in the popup header or a Chrome command shortcut:

```text
┌────────────────────────────────────────┐
│ Recording...              [■ Stop]     │
├────────────────────────────────────────┤
│ 1. Clicked #username-input             │
│ 2. Typed "admin"                       │
│ 3. Clicked #password-input             │
│ 4. Typed "••••••"                      │
│ 5. Clicked button.submit               │
│ 6. Waited 2s (page navigation)         │
│                                        │
│ [▶ Replay] [Edit as Script] [Save]    │
└────────────────────────────────────────┘
```

"Edit as Script" converts the recorded actions to editable JS code in the script editor.

### 6.13 Element Picker

Triggered from shortcut form or script editor. Injects an overlay on the page:

- Hovering highlights elements with a blue border
- Clicking selects the element and copies its CSS selector
- Shows selector in a floating bar at the top: `#main > div.content > button.submit`
- Option to refine: "Use ID", "Use class", "Use XPath", "Use text content"
- Returns selector to the calling form field

### 6.14 Full-Page Options Page

The options page (`chrome.runtime.openOptionsPage()`) provides a full browser tab for heavy editing. Accessible via popup gear icon → "Open Full Editor" or right-clicking the extension icon → Options.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Browser Automata                                        [●/○] Global│
├────────────┬────────────────────────────────────────────────────────┤
│            │                                                        │
│  Scripts   │  Script Editor (full-width CodeMirror)                 │
│  Shortcuts │  ┌──────────────────────────────────────────────────┐  │
│  Flows     │  │ // Much larger editing area                      │  │
│  CSS Rules │  │ // Syntax highlighting, line numbers             │  │
│  Network   │  │ // Multiple cursors, find/replace                │  │
│  Extract   │  │                                                  │  │
│  Domains   │                                                        │
│  Templates │                                                        │
│  Profiles  │                                                        │
│  Log       │                                                        │
│  Settings  │  │                                                  │  │
│            │  │                                                  │  │
│            │  └──────────────────────────────────────────────────┘  │
│            │  Name: [...] Domain: [...] Trigger: [...] World: [...]  │
│            │  [Save] [Run] [Delete]                                 │
├────────────┴────────────────────────────────────────────────────────┤
│  Status bar: last action, error count, storage usage                │
└─────────────────────────────────────────────────────────────────────┘
```

**What the options page adds over popup:**

- **Larger code editor** — full-width CodeMirror with more lines visible, find/replace, minimap
- **Side-by-side layout** — persistent sidebar navigation + content area
- **Bulk operations** — multi-select scripts/shortcuts for enable/disable/delete/export
- **Detailed log view** — more columns, wider filters, export log as CSV
- **Drag-and-drop reordering** — script execution priority via drag
- **Status bar** — persistent display of storage usage, error count, last action

**Shared code:** Both popup and options page import from the same component library and Zustand store. Views are composed differently (popup = stacked, options = sidebar + content) but use identical data hooks and shared components.

### 6.15 Settings

```
┌────────────────────────────────────────┐
│ ← Back            Settings             │
├────────────────────────────────────────┤
│ General                                │
│   Global Enable            [●]        │
│   Theme              [Dark ▾]         │
│   Confirm Before Run       [○]        │
│ Execution                              │
│   Timeout (ms)       [30000__]        │
│   Inject in iframes       [○]        │
│ Logging                                │
│   Level              [Info ▾]         │
│   Max Entries        [5000___]        │
│ Data                                   │
│   [Export Config (JSON)]               │
│   [Import Config]                      │
│   [Reset All Data]                     │
└────────────────────────────────────────┘
```

---

## 7. Bundled Templates

| Template | Trigger | Scope | What It Does |
| ---------- | --------- | ------- | ------------- |
| **Cookie Banner Dismisser** | page_load | global | Clicks common cookie consent "Accept" buttons (covers ~20 popular selectors) |
| **Video Navigator** | shortcut | `*://*.youtube.com/*`, `*://*.vimeo.com/*` | Binds `N`/`P` keys to next/prev video buttons |
| **Element Hider** | page_load | user-configured | Hides specified CSS selectors (`display:none`) |
| **Dark Mode Injector** | page_load | user-configured | Inverts colors + adjusts images via CSS filter |
| **Auto-Clicker** | manual | user-configured | Clicks a specified selector on a configurable interval |

Templates are shipped as JSON files in the extension bundle. No network dependency.

---

## 8. Non-Functional Requirements

| Requirement | Target |
| ------------- | -------- |
| Popup open-to-interactive | < 200ms |
| Script injection latency | < 50ms after page ready |
| Storage usage | < 5MB typical, warn at 8MB |
| Content script weight | Minimal — thin listener shell only |
| CodeMirror load | Lazy, < 50ms init via React.lazy |
| Log capacity | 5000 entries default, circular buffer |
| Supported browsers | Chrome 116+ only for v0.1 (MV3 service worker + scripting API) |
| Offline capability | 100% — no network dependencies |
| Telemetry | Zero — no data leaves the device, no analytics code shipped |

---

## 9. Security Considerations

| Risk | Mitigation |
| ------ | ----------- |
| User scripts can access page DOM | Default to ISOLATED world; MAIN world is opt-in per script |
| Script code stored in chrome.storage | Local only, never transmitted; user is the author |
| Imported configs may contain malicious scripts | Validation on import; preview before install; user must explicitly enable |
| `<all_urls>` host permission | Required for `scripting.executeScript`; users control which scripts are active |
| Content script on every page | Thin shell only — no user code in declarative content script |
| `new Function()` usage | Only inside `chrome.scripting.executeScript` injected func (MV3-legal); never in content script CSP context |

---

## 10. Resolved Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| **Options page** | Both popup + full-page options | Popup for quick access; options page for heavy editing (larger code editor, bulk management) |
| **Sync across devices** | Import/export only (v0.1) | `chrome.storage.sync` 100KB limit is too tight for scripts; import/export is sufficient |
| **Browser support** | Chrome-only for v0.1 | Simplest path; Firefox/Edge support deferred to future version |
| **Telemetry** | Zero telemetry | No data leaves the device. Privacy-first. No analytics code shipped. |
| **Product identity** | Power tool first | Templates as secondary accessibility layer; never constrain power users |
