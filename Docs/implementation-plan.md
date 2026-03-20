# Browser Automata — Implementation Plan

## Context

Browser Automata is a power-tool-first Chrome MV3 extension for browser automation. The project has a comprehensive 1234-line product specification but **zero source code** — only docs, license, and gitignore exist. This plan covers full project scaffolding and phased feature implementation.

**Tech stack** (from spec): TypeScript 5.x strict, React 18, Tailwind CSS 4, Vite 6 + CRXJS v2, CodeMirror 6, Zustand, Vitest, Lucide React, @tanstack/react-virtual.

---

## Phase 0 — Project Scaffolding (Complexity: M)

**Goal**: Buildable, lintable, testable extension that loads in Chrome and shows an empty popup.

### Files to create

```
package.json
tsconfig.json                    # Base strict config
tsconfig.app.json                # src/ code (JSX, path aliases, chrome types)
tsconfig.node.json               # Vite/Vitest config files
manifest.json                    # MV3: permissions, entry points
vite.config.ts                   # CRXJS + React + Tailwind plugins, @/ alias
vitest.config.ts                 # jsdom, chrome mocks setup
eslint.config.ts                 # typescript-eslint strict + react-hooks + prettier
.prettierrc
.prettierignore

src/
  vite-env.d.ts                  # Vite client types
  shared/
    constants.ts                 # Storage keys, defaults, limits, schema version
    utils.ts                     # generateId() wrapper, timestamp helpers
    types/
      index.ts                   # Re-exports
      entities.ts                # EntityId, ISOTimestamp, UrlPattern, EntityMeta (stubs)
      messages.ts                # Message union (stub)
      settings.ts                # Settings type (stub)
  background/
    service-worker.ts            # onInstalled + onMessage listeners (sync, top-level)
  content/
    index.ts                     # Sends CONTENT_READY, DOMContentLoaded guard
    content.css                  # Empty (must not leak into host pages)
  popup/
    index.html                   # 400x580 viewport, dark class
    main.tsx                     # React root mount
    App.tsx                      # Header + main area + bottom tab bar shell
    popup.css                    # Tailwind import + @theme (Slate/Emerald/Rose tokens)
  options/
    index.html                   # Full-page viewport
    main.tsx                     # React root mount
    App.tsx                      # Sidebar layout shell
    options.css                  # Tailwind import + shared theme
  components/.gitkeep
  stores/.gitkeep
  assets/icons/                  # Placeholder PNGs: 16, 32, 48, 128

tests/
  setup.ts                       # Chrome API mocks (storage, runtime, tabs, scripting, alarms, notifications)
```

### Key configurations

**package.json dependencies:**

- Production: react, react-dom, zustand, @tanstack/react-virtual, lucide-react
- Dev: @crxjs/vite-plugin, @types/chrome, @vitejs/plugin-react, typescript ~5.7, vite ^6, @tailwindcss/vite ^4, vitest, @testing-library/react, eslint + typescript-eslint, prettier

**tsconfig strict flags:** strict, noUncheckedIndexedAccess, noUnusedLocals, noUnusedParameters, exactOptionalPropertyTypes, noImplicitReturns, noFallthroughCasesInSwitch, forceConsistentCasingInFileNames, isolatedModules, verbatimModuleSyntax, moduleResolution: bundler

**Tailwind CSS 4:** No tailwind.config.js — uses `@tailwindcss/vite` plugin + CSS `@theme` directives for custom tokens (bg-primary: slate-950, active: emerald-400, error: rose-400, text-xxs: 10px)

**CRXJS:** Reads manifest.json, auto-discovers entry points (popup HTML, options HTML, content scripts, service worker), handles HMR in dev

**CodeMirror NOT included yet** — added later when editor is built, lazy-loaded via React.lazy()

### Validation

```bash
pnpm install
pnpm run dev          # CRXJS builds, load unpacked in chrome://extensions
pnpm run type-check   # tsc -b --noEmit passes
pnpm run lint         # ESLint clean
pnpm run test         # Vitest runs with chrome mocks
```

---

## Phase 1 — Core Foundation (Complexity: L)

**Goal**: Typed storage layer, message passing, global kill switch, basic popup with empty views.
**Features**: F16 (popup shell), F23 (kill switch), F26 (schema versioning)

### Files to create

```
src/shared/
  storage/
    chrome-storage.ts            # Typed CRUD: get<T>, set<T>, update<T>, remove over chrome.storage
    schema-migration.ts          # Version check on onInstalled, sequential migration runner
    keys.ts                      # Typed storage key → entity type mapping
  messaging/
    message-types.ts             # Type guards for message discrimination
    send-message.ts              # Typed wrapper around chrome.runtime.sendMessage

src/shared/types/
  entities.ts                    # UrlPattern, Script, Shortcut, KeyCombo, ChordCombo, CSSRule interfaces
  messages.ts                    # Discriminated union: GET_STATE, SCRIPT_*, SHORTCUT_*, CONTENT_READY, PING
  settings.ts                    # Full Settings type per spec section 4.1
  activity-log.ts                # ActivityLogEntry interface

src/background/
  message-router.ts              # Record<MessageType, Handler> dispatch table
  handlers/
    state-handler.ts             # GET_STATE → returns settings + entity counts
    settings-handler.ts          # Settings CRUD

src/content/
  message-handler.ts             # Responds to PING

src/popup/
  stores/app-store.ts            # Zustand: activeTab, settings, globalEnabled
  hooks/
    use-settings.ts              # Load settings from storage on mount
    use-chrome-message.ts        # sendMessage wrapper with loading/error state
  components/
    Header.tsx                   # Logo + global toggle (F23) + settings gear
    TabBar.tsx                   # Bottom nav: Scripts, Keys, Flows, Log, More
    views/
      ScriptsView.tsx            # Empty placeholder
      ShortcutsView.tsx          # Empty placeholder
      LogView.tsx                # Empty placeholder
      SettingsView.tsx           # Full settings form
  components/ui/
    Toggle.tsx, Button.tsx, Card.tsx, Input.tsx   # Reusable primitives
```

### Critical paths

- **storage/chrome-storage.ts** — every future feature depends on this. Must be generic, typed, and handle chrome.storage.onChanged for cross-context reactivity.
- **message-router.ts** — single onMessage listener with dispatch table. New features plug in by adding handler entries.
- **Schema migration** — runs on onInstalled, checks schemaVersion in sync storage, applies sequential migrations.

---

## Phase 2 — Core Engine (Complexity: XL)

**Goal**: The extension does its primary job — execute scripts, wire shortcuts, inject CSS, log activity.
**Features**: F1, F2, F3, F5, F6, F18, F25

### Files to create

```
src/shared/url-pattern/
  matcher.ts                     # matchUrl(pattern, url): boolean
  specificity.ts                 # compareSpecificity for priority ordering
  parser.ts                      # Parse/validate UrlPattern values

src/background/services/
  script-manager.ts              # Load matching scripts for URL, inject via chrome.scripting.executeScript
  shortcut-manager.ts            # Compute active shortcuts for URL, send UPDATE_SHORTCUTS to content
  css-injector.ts                # Inject matching CSS via chrome.scripting.insertCSS
  conflict-detector.ts           # F5: Check shortcut collisions (same scope + browser defaults)
  activity-logger.ts             # Circular buffer in storage, seq counter, cap enforcement
  error-surfacer.ts              # F25: Badge text/color on error, chrome.notifications

src/background/handlers/
  script-handler.ts              # SCRIPT_SAVE, DELETE, TOGGLE, RUN_NOW
  shortcut-handler.ts            # SHORTCUT_SAVE, DELETE, TOGGLE
  css-handler.ts                 # CSS_RULE_SAVE, DELETE

src/content/
  shortcut-listener.ts           # keydown handler: normalize event → match → execute/dispatch

src/popup/
  stores/scripts-store.ts, shortcuts-store.ts, log-store.ts
  hooks/use-scripts.ts, use-shortcuts.ts, use-activity-log.ts
  components/views/
    ScriptsView.tsx              # List with toggles + run button
    ScriptEditor.tsx             # Full-view: name, scope, trigger, world + CodeMirror
    ShortcutsView.tsx            # Grouped by domain, conflict warnings
    ShortcutEditor.tsx           # Key capture + action type + target + scope
    CSSRulesView.tsx             # List + CSS CodeMirror editor
    LogView.tsx                  # Virtual-scrolled, filtered, color-coded
  components/editor/
    CodeEditor.tsx               # React.lazy wrapper for CodeMirror 6 (JS + dark theme)
    KeyCaptureInput.tsx          # Captures keydown, formats combo string
    UrlPatternInput.tsx          # Type selector + validation
    SelectorInput.tsx            # CSS selector text input

src/lib/codemirror/
  setup.ts                       # CM6 extensions: JS lang, dark theme, line numbers, brackets
  css-setup.ts                   # CSS language support
```

**New dependencies added**: @codemirror/state, @codemirror/view, @codemirror/lang-javascript, @codemirror/lang-css, @codemirror/theme-one-dark (+ minimal extensions)

### Key implementation details

- **Script execution (F1)**: `chrome.scripting.executeScript({ target: { tabId }, world, func })` where func wraps user code in try/catch, executes via `new Function(code)()` (MV3-legal pattern)
- **URL matching (F3)**: exact → string match, glob → converted to regex, regex → RegExp.test(), global → always matches. Specificity: exact > glob(no host wildcard) > glob(host wildcard) > regex > global
- **Shortcuts (F2)**: Content script maintains Map<serializedCombo, Shortcut>. click/focus handled locally; script/flow dispatched to service worker
- **Activity log (F18)**: Circular buffer under `log` key, virtual-scrolled with @tanstack/react-virtual

### Testing priorities

- `url-pattern/matcher.ts` — extensive unit tests (core matching logic)
- `script-manager.ts` — mock chrome.scripting, test world selection
- `shortcut-listener.ts` — simulate keydown events
- `activity-logger.ts` — circular buffer behavior

---

## Phase 3 — Power Features (Complexity: XL)

**Features**: F4, F7, F8, F9, F10, F13, F14, F19, F21, F22

### 3a: Chords + Scheduling + Profiles + Import/Export (L)

- F4: Chord state machine in content script (idle → in-progress → complete/timeout)
- F14: chrome.alarms CRUD, onAlarm → find matching tabs → inject
- F22: Profile switching, entity filtering by profileId
- F21: Full import/export with merge strategies (replace/merge-keep/merge-overwrite)

### 3b: Element Picker + Action Recorder (L)

- F7: Content script overlay, hover highlight, click select, CSS selector generation
- F8: Record click/type/scroll sequences, generate editable JS code

### 3c: Flow Builder + Extraction + Templates (XL)

- F10/F9: Flow executor walks node graph, handles conditions/waits/loops. Checkpoints state to survive SW termination.
- F13: Extraction rules → inject scripts → format as JSON/CSV
- F19: 5 bundled templates as JSON, one-click install with fresh IDs
- Flow editor (options page only): Visual node graph with drag-and-drop

---

## Phase 4 — Advanced Features (Complexity: XL)

### 4a: Developer Experience (L) — F16b-F16f

Script console, shared libraries (@use resolver), variables vault ({{var}}), version history, TypeScript support (esbuild WASM)

### 4b: Resilience (M) — F16g-F16j

Fallback selectors, smart wait strategies, retry policies, page readiness detection

### 4c: Network + Data (L) — F15, F16k-F16n, F24

Network interceptor (declarativeNetRequest), webhooks, file output, multi-format extraction, clipboard history

### 4d: Advanced Automation (L) — F11, F12, F16r, F16s, F16u

Cross-tab flows, element watcher, screenshots, form auto-fill, background tab execution

### 4e: Ecosystem (M) — F16t, F16v, F16w, F20, F16o-q

Site adapters, notification rules, health dashboard, marketplace (post-v1 likely)

---

## Data Model Strategy

Types defined **incrementally** as each phase introduces them:

| Phase | Types |
| ------- | ------- |
| 0 | EntityId, ISOTimestamp, UrlPattern, EntityMeta (stubs) |
| 1 | Settings, Script, Shortcut, KeyCombo, ChordCombo, CSSRule, ActivityLogEntry, Message union |
| 2 | ConflictWarning (utility). Message union grows. |
| 3 | Profile, BrowserAutomataExport, Flow, FlowNode, ConditionCheck, ExtractionRule, Template |
| 4 | ScriptVariable, SharedLibrary, ScriptVersion, NetworkRule, ClipboardEntry, FormFillProfile, NotificationRule, SiteAdapter, HealthMetrics |

---

## Risks & Mitigations

| Risk | Mitigation |
| ------ | ----------- |
| CRXJS v2 beta instability | Fallback to manual Vite rollupOptions.input multi-entry (config-only change) |
| SW termination during flows | Checkpoint flow state to storage after each node; chrome.alarms keep-alive |
| Tailwind CSS 4 + CRXJS compat | Fall back to Tailwind v3 if issues arise |
| CodeMirror bundle size | Tree-shake aggressively; React.lazy() so it doesn't block popup render |
| Content script style leakage | No Tailwind in content scripts; use Shadow DOM for overlays |

---

## Implementation Order

**Start with Phase 0 (scaffolding)**, then Phase 1 (foundation), then Phase 2 (core engine). Phases 3-4 are independent of each other after Phase 2 and can be reordered based on priority.

### Verification (end-to-end)

1. `pnpm run dev` → load unpacked in Chrome → popup opens with dark theme
2. Create a script via popup → saved to chrome.storage.local
3. Navigate to matching domain → script auto-injects and executes
4. Bind a keyboard shortcut → press it → action fires
5. Check activity log → entries appear with timestamps and status
6. Toggle global kill switch → all automation stops
