# Changelog

All notable changes to Browser Automata are documented in this file.

---

## v0.2.6 — 2026-03-22

> Backend and UI performance optimizations, template management improvements, and build fixes.

### Bug Fixes

- **Stale Declaration Build Errors** — Fixes stale `.d.ts` build errors by redirecting declarations to a temp directory, eliminating false type-check failures from leftover artifacts.
- **Silent Error Handling** — Replaces 12 silent `catch` blocks across backend services with `console.debug` logging for improved debuggability.
- **Library Resolver Regex Bug** — Fixes global regex `lastIndex` state bug in `library-resolver.ts` that caused intermittent resolution failures.
- **Template Metadata** — Fixes template field issues and updates content hashes across bundled templates.

### Improvements

- **Cookie Banner Dismisser** — Updates the cookie banner dismisser template to support newer consent platforms (Usercentrics, Klaro, CookieYes, Termly, Axeptio).
- **Template Organization** — Separates bundled templates into individual JSON files and removes inline bundled templates for cleaner maintenance.
- **Content Script Reliability** — Increases content script retry count from 2 to 5 for improved cold-start reliability on slow pages.

### Performance

- **Flow Executor Lookups** — Replaces O(n) `find`/`findIndex` calls with O(1) Map lookups for node and step resolution in the flow executor.
- **Parallel Storage Reads** — Parallelizes storage reads across `script-manager`, `shortcut-manager`, `extraction-engine`, and `dependency-resolver`.
- **Shadow DOM Traversal** — Uses `TreeWalker` for deep-query shadow DOM traversal with early exit, replacing full `NodeList` materialization.
- **DOM Batch Operations** — Uses `DocumentFragment` batch DOM insertion in `quick-run-bar` and single-pass children iteration in `element-picker`.
- **MutationObserver Debounce** — Adds 100ms debounce to `element-watcher` `MutationObserver` to reduce high-frequency callback overhead.

### Architecture

- **SettingsView Decomposition** — Decomposes the monolithic `SettingsView` (562 LOC) into 9 focused sub-components wrapped with `React.memo` for granular re-render control.
- **Shared UI Components** — Adds reusable `EditorHeader`, `EmptyState`, and `ListHeader` components, eliminating ~200 lines of duplication across views.
- **Memoized UI Primitives** — Wraps base UI primitives (`Button`, `Card`, `Input`, `Select`, `Toggle`) and layout components (`Header`, `ViewRouter`, `LogEntry`) with `React.memo`.

### Accessibility

- **ARIA Attributes** — Adds `role` attributes and `aria-label` annotations to buttons and toolbars across the popup UI.

---

## v0.2.5 — 2026-03-22

> Quick Tip shortcut overlay, scope mode inheritance for Quick Run and Shortcuts, and Quick Run Bar UX refinements.

### New Features

- **Quick Tip Overlay** — Auto-dismissing tooltip on page load that shows active keyboard shortcuts for the current page, with configurable timeout and enable/disable toggle in Settings.
- **Scope Mode (Follow / Override)** — Quick Run actions and Shortcuts can now inherit their target entity's URL scope (`follow`), combine it with a custom scope (`override`), or use a standalone custom scope (`custom`, default). Eliminates duplicate scope configuration when the action already targets a scoped entity.

### Improvements

- **Quick Run Bar Viewport Clamping** — Bar position is clamped to stay within the visible viewport with an 8px edge margin, preventing it from being dragged off-screen.
- **Quick Run Live Broadcast** — Saving, deleting, or reordering quick run actions immediately pushes updates to all open tabs without requiring a page refresh.
- **Quick Run Auto-Show/Hide** — Bar auto-shows when domain-matched actions exist and auto-hides otherwise; manual toggle via shortcut overrides to show all actions regardless of scope.
- **Quick Tip Settings** — New settings section with enable toggle and auto-dismiss timeout (default 3000ms).

### Architecture

- **Scope Resolver Service** — New `scope-resolver.ts` resolves the URL scope of a Quick Run or Shortcut's target entity (script, flow, extraction rule, or form fill profile) for scope mode evaluation.
- **`matchUrlWithScopeMode` Utility** — New URL pattern matcher that respects scope mode (`custom`, `follow`, `override`) when determining if an action applies to a page.
- **`UPDATE_QUICK_TIP_SHORTCUTS` Message** — New SW-to-content message type for pushing matching shortcuts to the Quick Tip overlay.

### Code Quality

- **Quick Run Bar drag logic simplified** — Replaced conditional direction calculations with a unified offset formula based on anchor position.
- **Settings handler merge** — `quickRun` settings are now properly deep-merged during `SETTINGS_UPDATE`, and bar position persistence routes through the message handler instead of direct storage writes.

---

## v0.2.4 — 2026-03-22

> Quick Run Bar settings UI, shared URL pattern utilities, and build/template maintenance.

### New Features

- **Quick Run Bar Settings** — Adds a dedicated settings section for configuring the in-page Quick Run bar: toggle visibility, set the toggle hotkey, and choose bar position (top/bottom).

### Improvements

- **Cookie Banner Dismisser** — Updates the bundled cookie banner dismisser template.
- **Auto Hash-Templates Build Script** — Adds a build script that automatically hashes templates during the build process.

### Code Quality

- **Shared `scopesOverlap` Utility** — Deduplicates the `scopesOverlap` function from `conflict-detector.ts` and `use-key-combo-conflicts.ts` into the shared `url-pattern` module with an improved implementation that performs real domain extraction and glob matching.
- **`extractPatternDomains` Utility** — New shared helper that extracts base domains from URL pattern glob values for more precise overlap detection.

---

## v0.2.3 — 2026-03-22

> Quick Run floating action bar, template lifecycle management, and new entity type for single-click automation execution.

### New Features

- **Quick Run Action Bar** — Floating, draggable action bar rendered on web pages for one-click execution of scripts, flows, extraction rules, or form fill profiles. Scoped to URL patterns so only relevant actions appear. Toggle visibility with `Alt+Q` (configurable). Position persists across sessions.
- **Quick Run Popup View** — New 14th tab in the popup for creating, editing, reordering, and toggling quick actions. Each action targets a specific entity (script, flow, extraction rule, or form fill profile) and can be scoped globally or to URL patterns.
- **Quick Run In-Popup Buttons** — Quick action buttons also appear in the popup UI above the tab bar for fast access without switching to the Quick Run tab.
- **Template Status Tracking** — Templates now track installation status with six states: `not_installed`, `installed`, `update_available`, `local_modified`, `update_and_modified`, and `removed`. Content hashing (SHA-256) detects both upstream updates and local modifications.
- **Template Uninstall & Reset** — Uninstall removes all entities installed by a template and clears the installation record. Reset discards local modifications and reinstalls from the bundled source.

### Architecture

- **QuickRunAction entity** — New entity type with discriminated union target (`script`, `flow`, `extraction`, `form_fill`), URL pattern scoping, ordering, enable/disable toggle, and optional custom color.
- **Quick Run handler & manager** — New `quick-run-handler.ts` dispatches `QUICK_RUN_SAVE`, `QUICK_RUN_DELETE`, `QUICK_RUN_REORDER`, `QUICK_RUN_EXECUTE`, and `QUICK_RUN_GET_MATCHING` messages. `quick-run-manager.ts` handles storage CRUD, URL-scoped matching, and execution routing.
- **Quick Run bar content script** — New `quick-run-bar.ts` renders a shadow-DOM-isolated floating bar with icon buttons per action, drag-to-reposition, and keyboard toggle.
- **Template content hashing** — New `template-hash.ts` utility computes SHA-256 hashes for template content comparison. `template-installer.ts` now stores `contentHash` and `templateName` with each installation record.
- **Template status detection** — New `GET_TEMPLATE_STATUSES` message compares local hash against remote hash to compute per-template status (installed, modified, update available, etc.).
- **Entity origin tracking** — All entity types now include an optional `templateId` field to track which template installed them, enabling uninstall and reset operations.

### Improvements

- **Template registry entries** now include `contentHash` and `updatedAt` fields for update detection.
- **Bundled templates** updated with content hashes and timestamps.
- **Default landing tab** changed to Quick Run for faster access to common actions.

---

## v0.2.1 — 2026-03-21

> Performance optimization, code quality overhaul, and accessibility improvements across the entire codebase.

### Performance

- **Popup session cache** — GET_STATE response is cached in `chrome.storage.session` with a 2-second TTL, eliminating redundant service worker round-trips on popup reopen.
- **React memoization** — Added `React.memo` and stable `useCallback` wrappers across the four largest views (ExtractionView, NetworkRulesView, ShortcutsView, FlowsView) to reduce unnecessary re-renders.
- **Shared ViewRouter** — Extracted lazy-loaded view routing into a single `ViewRouter` component shared between popup and options pages. Popup App reduced from 100 to 33 lines; options App removed 13 duplicate view imports.

### Reliability

- **Message router error boundary** — All handler dispatches are wrapped in try-catch, returning structured `{ ok: false, error }` responses instead of propagating errors silently.
- **Concurrent flow execution guard** — A module-level `runningFlows` Set prevents the same flow from executing twice simultaneously. Returns an error if a duplicate run is attempted; cleans up via `finally` block.
- **Shortcut debounce** — 100ms debounce per shortcut ID prevents accidental rapid-fire triggers from key repeats.
- **Extraction payload validation** — Fields are validated for non-empty `name` and `selector` before sending to the content script. Invalid fields are filtered with warnings logged; returns an error if all fields are invalid.
- **Content script error boundary** — Message handler switch wrapped in try-catch; returns `{ ok: false, error }` on failure instead of crashing the content script message loop.
- **Schema migration safety** — Each migration step is wrapped in try-catch. The schema version is only updated after a step succeeds; further migrations stop on first failure.
- **Element watcher cleanup** — New `stopAllWatchers()` export for bulk MutationObserver disconnection on flow completion.
- **ResponseMap exhaustiveness** — Compile-time `AssertResponseMapComplete` type ensures every `PopupToSWMessage` type has a corresponding `ResponseMap` entry. Fallback type changed from `unknown` to `never`.

### Bug Fixes

- **Fixed "Show in New Tab" blank page** — The "Show in New Tab" output action for both flow extract nodes and extraction rules opened a blank tab. Root cause: `chrome.scripting.executeScript` fails silently on `about:blank` tabs in MV3 because host permissions don't consistently match `about:blank`. Replaced with a dedicated extension-hosted results page (`src/results/index.html`) that reads pre-built HTML from `chrome.storage.session`, eliminating the dependency on `about:blank` and `executeScript` entirely.

### Architecture

- **FlowNodeEditor split** — Monolithic 1,072-line component split into 7 focused sub-components in `editor/flow-nodes/`: `NodeConfigForm`, `FlowNodeRow`, `AddNodeMenu`, `OutputActionCheckboxes`, `ExtractTestButton`, `ExtractionRuleSelect`, and `constants`. Main file reduced to ~130 lines (thin orchestrator). Same public API — no consumer changes needed.
- **Dedicated results page** — New `src/results/index.html` + `main.ts` for rendering extraction results in a new tab. Bundled via Vite/CRXJS as an additional Rollup input. Replaces the unreliable `about:blank` + `executeScript` pattern.

### Accessibility

- **TabBar keyboard navigation** — Arrow Left/Right with wrapping between tabs, Home/End to jump to first/last tab, Escape to close the More menu. Proper ARIA roles (`tablist`, `tab`, `tabpanel`), `aria-selected`, and roving `tabIndex`. More menu uses `role="menu"` with ArrowUp/Down navigation.
- **Options page ARIA** — Sidebar navigation annotated with `role="tablist"` / `role="tab"` / `role="tabpanel"`.
- **Focus-visible outlines** — All 5 base UI components (Button, Card, Input, Select, Toggle) now have consistent `focus-visible:outline-2` styles for keyboard users.

### Code Quality

- **ESLint zero errors** — Resolved all 109 ESLint errors across 35+ files (was 109 errors + 6 warnings; now 0/0).
- **Non-null assertions eliminated** — Replaced `!` assertions with proper null guards throughout (SelectorSourceList, FlowNodeEditor, element-picker, result-display).
- **Optional chaining adopted** — Converted `&&` null checks to `?.` syntax across handlers and UI components.
- **Modern iteration** — Converted 6 C-style `for` loops to `for...of` in deep-query-snippet.
- **Template literal safety** — Wrapped numeric values in `String()` for all template literal expressions (selector-tester, action-highlight, toast, shortcut-manager, service-worker).
- **Unnecessary conditions removed** — Eliminated dead code paths flagged by `noUncheckedIndexedAccess` and strict type narrowing.

---

## v0.2.0 — 2026-03-21

> Extraction overhaul, flow reliability, and quality-of-life improvements across all entity views.

### New Features

- **Extraction Field Transforms** — Apply post-extraction transforms per field: trim, lowercase, uppercase, strip HTML, normalize URL, collapse whitespace, find-and-replace, and regex replace. Available in both extraction rules and flow extract nodes.
- **Multiple Selector Sources (Fallback Chains)** — Each extraction field supports an ordered list of CSS selectors. Selectors are tried top-to-bottom; first non-empty match wins. Reorderable via up/down arrows in the UI. Supported in extraction rules and flow extract nodes.
- **Flow "Run Extraction Rule" Node** — New flow node type that references a saved extraction rule by ID, reusing all its fields, transforms, fallback selectors, output format, and output actions. Eliminates duplication between flow extraction and standalone extraction rules.
- **Flow Variable Interpolation** — Use `{{varName}}` syntax in Navigate URLs, Open Tab URLs, and Type Text fields to pass extracted values between flow nodes.
- **Extraction Test Buttons** — Live "Test Extract" button on flow extract nodes and "Run Extraction Rule" nodes. Runs the extraction against the current page and shows inline results with copy/download support.
- **Duplicate Button** — One-click duplicate for all 6 entity types (flows, scripts, shortcuts, CSS rules, network rules, extraction rules). Creates a copy with fresh ID, "(Copy)" suffix, and opens directly in the editor.
- **Shortcut Key Conflict Warnings** — Real-time warnings when assigning keyboard shortcuts that conflict with browser defaults (Ctrl+T, F5, etc.) or other extension shortcuts/extraction rules in overlapping scopes. Displayed in both shortcuts and extraction rule editors.
- **Run Flow Shortcut Action** — Shortcuts can now trigger flow execution. Added missing "Run Flow" action type to the shortcuts editor with a flow selector dropdown.

### Bug Fixes

- **Fixed "New Tab" blank page** — Extraction's "Show in New Tab" output action opened a blank tab because the popup closed before `executeScript` could write content. Delegated tab creation to the background service worker with `waitForTabReady` to ensure content is written after the tab loads.
- **Fixed flow extract on CSP-restricted pages** — Flow extract nodes used `new Function()` in the MAIN world, which silently failed on pages with Content Security Policy. Rewrote to use the content script's `EXTRACT_DATA` message path (same reliable path as extraction rules and test buttons).
- **Fixed flow navigate on CSP-restricted pages** — Navigate nodes used `window.location.href` via `injectAction` (MAIN world `new Function`), blocked by CSP. Replaced with `chrome.tabs.update` API which bypasses page restrictions and properly waits for page load.
- **Fixed flow shortcut execution** — The "Run Flow" shortcut action type existed in the type system but execution was a no-op. Wired it to call `executeFlow()`.

### Improvements

- **Extraction engine unified** — All extraction paths (extraction rules, flow extract nodes, test buttons, shortcut-triggered extractions) now go through the same content script `extractFromDOM` function, ensuring consistent behavior regardless of trigger source.
- **Result display helpers** — New `openResultTab` with `waitForTabReady` used by all "Show in New Tab" actions. New `injectResultWidget` for floating on-page result display with shadow DOM isolation.
- **Editor draft persistence** — All entity editors persist unsaved drafts across popup close/reopen cycles (e.g., when element picker activation closes the popup). Draft indicators shown in list views.

---

## v0.1.0 — 2026-03-21

> Initial release. Power-tool-first Chrome extension (Manifest V3) that turns the browser into a programmable automation platform. Everything runs locally — no external servers, no data leaves your machine.

### Core Engine

- **Script Execution Engine** — Run arbitrary JavaScript on any page with five trigger modes: `page_load`, `manual`, `shortcut`, `event`, and `schedule`. Supports `ISOLATED` (default) and `MAIN` execution worlds, three run-at timings, priority ordering, and profile scoping.
- **Keyboard Shortcuts** — Unlimited keyboard shortcuts (bypasses Chrome's 4-command limit) with Vim-style chord sequences, configurable chord timeout, and six action types: click element, run script, run inline JS, focus element, navigate URL, and execute flow. Includes shortcut conflict detection.
- **URL Pattern Scoping** — Four scoping modes (`exact`, `glob`, `regex`, `global`) with specificity-based resolution applied across all automation entities.
- **CSS Injection** — Inject custom stylesheets per domain with `document_start` or `document_idle` timing.
- **Flow Builder** — Visual drag-and-drop node graph editor with action nodes (click, type, scroll, navigate, run script, extract data, tab operations, clipboard), conditional logic (element existence, text/URL matching, if/then/else), wait strategies (element, duration, network idle), loops, and cross-tab flows.

### Authoring & Capture

- **Visual Element Picker** — Click-to-select any element with auto-generated CSS selectors, multiple fallback strategies (ID, data attributes, ARIA labels, classes, ancestors, XPath), robustness analysis, and match counts.
- **Action Recorder** — Record click, text input, scroll, and navigation sequences. Auto-generates editable JavaScript with visual feedback and toast notifications.
- **Structured Data Extraction** — Define field-level extraction rules with per-field selectors, attribute extraction, multiple output formats (JSON, CSV, Markdown tables, HTML, XML, plain text), and four output actions (show on page, show in new tab, copy to clipboard, download file). Trigger manually, by shortcut, or on page load.

### Scheduling & Monitoring

- **Script Scheduling** — Timer-based (`every N minutes`) and cron expression (`0 9 * * *`) execution via `chrome.alarms`. Runs reliably even when popup is closed.
- **Network Request Interception** — Block, redirect, or modify headers on network requests using the `declarativeNetRequest` API (MV3-compliant).
- **Element Watcher** — Monitor DOM mutations and trigger actions when elements appear, disappear, or change at configurable intervals.
- **Custom Notification Rules** — "Notify me when element X appears/disappears" with configurable check intervals, desktop notifications, sound alerts, and badge icon updates.

### Developer Experience

- **Script Debugging Console** — Captures `console.log`, `console.warn`, `console.error` with timestamps, per-script filtering, clear, and export.
- **Shared Libraries** — Define reusable utility modules and import via `@use('library-name')` syntax, resolved at injection time.
- **Script Variables / Secrets Vault** — Store API keys, tokens, and URLs separately with `{{variableName}}` template syntax, secret masking in UI/logs, and per-profile isolation.
- **Script Version History** — Track up to 50 versions per script with diff comparison and rollback.
- **TypeScript Support** — Write scripts in TypeScript with on-save transpilation and inline type errors.
- **CodeMirror 6 Editor** — Lightweight (~100 KB) in-popup code editor with syntax highlighting and autocomplete.

### Resilience

- **Element Fallback Selectors** — Try-list of alternative selectors per shortcut/script with auto-staleness detection.
- **Selector Fallback Service** — Nine-plus strategy variations ranked by stability with match count visibility.
- **Retry Policies** — Configurable exponential backoff per script or flow node with max retries, delays, and fallback actions (skip, abort, notify).
- **Smart Wait Strategies** — Auto-detects SPA route changes, network idle, animation completion, React/Vue render cycles, and DOM stability.

### Data & Integration

- **Clipboard History** — Last N clipboard operations (default 20) with search, pinning, auto-expiry, and source tracking.
- **File Output** — Save extraction results directly to disk via `chrome.downloads`.
- **Form Auto-Fill** — Store field mappings per domain with selector fallbacks, multiple field types, and shortcut triggers.

### Management

- **Profiles** — Switch between isolated automation contexts (work, personal, project-specific). Each profile isolates scripts, shortcuts, CSS rules, extraction rules, network rules, and variables.
- **Import/Export** — Full JSON backup and restore with three merge strategies (`replace_all`, `merge_keep_existing`, `merge_overwrite`) and partial export support.
- **Global Kill Switch** — Single toggle from popup header to disable all automations.
- **Pre-Built Templates** — One-click install templates (Cookie Banner Dismisser, Video Navigator, Element Hider, Dark Mode Injector, Auto-Clicker, form auto-fill, and more), editable after install.
- **Activity Log** — Timestamped, filterable log with color-coded statuses, virtual scrolling for 5,000+ entries, domain/type/status/entity filters, expandable stack traces, and log export.
- **Health Dashboard** — Failure rates, error logs, stale selector detection, storage usage by entity type, and most/least used automations.
- **Error Surfacing** — Badge icon for unread errors, desktop notifications when popup is closed, inline errors in the script editor, and full context in logs.

### UI

- **Popup** (400×580 px) with 13 tab views: Scripts, Shortcuts, Flows, CSS Rules, Extraction, Network Rules, Profiles, Settings, Templates, Health, Log, Import/Export, and Domains.
- **Options Page** — Full-page React interface for advanced configuration and the health dashboard.
- **Dark theme** via Tailwind CSS 4.

### Architecture

- Chrome Manifest V3 with three isolated contexts: Service Worker (14 handlers, 28 services), Content Script (shortcut listener, element picker, recorder, extractor, selector tools, toast), and Popup/Options UI.
- Discriminated union message types for type-safe cross-context communication.
- 11 core entity types, `chrome.storage.local` for entities, `chrome.storage.sync` for settings.
- 7 Zustand stores for popup state management (provider-less, popup lifecycle-friendly).

### Tech Stack

- TypeScript 5.7 (strict), React 18, Tailwind CSS 4, Zustand 5, CodeMirror 6, TanStack Virtual 3, Lucide React, Vite 6 + CRXJS, Vitest 2 + Testing Library.

### Testing

- Smoke tests (schema version, storage keys, defaults).
- Storage CRUD and schema migration tests.
- Message type guard and discriminated union validation tests.
- URL pattern matching and specificity ranking tests.
- Activity log handler tests.
