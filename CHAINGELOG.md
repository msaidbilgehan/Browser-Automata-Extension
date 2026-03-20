# Changelog

All notable changes to Browser Automata are documented in this file.

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
- **Structured Data Extraction** — Define field-level extraction rules with per-field selectors, attribute extraction, and multiple output formats (JSON, CSV, Markdown tables, HTML, XML, plain text). Trigger manually, by shortcut, or on page load.

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

