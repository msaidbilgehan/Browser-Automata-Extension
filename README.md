# Browser Automata

**Power-tool-first Chrome extension for browser automation.**

Wire keyboard shortcuts to page elements, execute JavaScript on any domain, extract structured data, chain multi-step flows, inject custom CSS, intercept network requests — all from a compact popup UI. Pre-built templates lower the entry barrier for non-technical users, but the engine never constrains power users.

> **Status:** v0.2.5 · Chrome Extension (Manifest V3) · Private License

---

## Table of Contents

- [Project Overview](#project-overview)
- [Project Aim](#project-aim)
- [Features](#features)
- [Installation](#installation)
- [End-User Usage Suggestions](#end-user-usage-suggestions)
- [Advanced-User Usage Suggestions](#advanced-user-usage-suggestions)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

---

## Project Overview

Browser Automata is a Chrome extension built on Manifest V3 that turns your browser into a programmable automation platform. Unlike simple macro recorders or bookmark-based scripts, Browser Automata provides a full-featured automation engine with:

- **Script execution** scoped to domains or URL patterns with multiple trigger modes
- **Unlimited keyboard shortcuts** that bypass Chrome's built-in 4-command limit, including Vim-style chord sequences
- **Visual flow builder** for chaining multi-step automations across tabs
- **Structured data extraction** with multi-format output (JSON, CSV, Markdown, XML, HTML)
- **CSS injection**, **network request interception**, and **form auto-fill** per domain
- **Profiles** for switching between automation contexts (work, personal, project-specific)

Everything runs locally in the browser — no external servers, no accounts, no data leaves your machine.

---

## Project Aim

Browser Automata follows an **engine-first, convenience-second** philosophy:

1. **Primary audience** — Developers, QA engineers, scripters, and sysadmins who need precise control over browser behavior.
2. **Secondary audience** — Power users who install and configure pre-built templates without writing code.
3. **Design principle** — Every feature exposes its full capability surface. Templates are sugar, not guardrails.

The goal is to be the single extension that replaces a collection of single-purpose tools: custom user scripts, shortcut managers, CSS injectors, data scrapers, and automation recorders.

---

## Features

### Core Engine

| Feature | Description |
| --------- | ------------- |
| **Script Execution** | Run JavaScript on any page with triggers: page load, manual, shortcut, event, or schedule. Execute in isolated or main world. |
| **Keyboard Shortcuts** | Bind any key combination to actions — click, focus, navigate, run a script, run a flow, or trigger an extraction rule. Supports chord combos (e.g., `g` then `i` for GitHub Issues). Live conflict warnings for browser and extension collisions. |
| **CSS Injection** | Inject custom stylesheets scoped to domains or URL patterns. Inject at `document_start` or `document_idle`. |
| **URL Pattern Scoping** | Scope any automation to exact URLs, glob patterns, regex, or globally. Specificity rules determine priority. |
| **Quick Run Bar** | Floating action bar on web pages for single-click execution of scripts, flows, extraction rules, or form fills. Draggable, URL-scoped, and toggleable with `Alt+Q`. |
| **Shortcut Conflict Detection** | Detects collisions between shortcuts and warns before saving. |
| **Shortcut Debounce** | 100ms debounce per shortcut prevents accidental rapid-fire triggers. |

### Automation & Intelligence

| Feature | Description |
| --------- | ------------- |
| **Flow Builder** | Chain actions into multi-step flows with conditions, loops, waits, cross-tab navigation, and `{{varName}}` interpolation for passing extracted data between nodes. Includes "Run Extraction Rule" node to reuse saved extraction rules. |
| **Action Recorder** | Record click, type, and scroll sequences on a page, then replay or convert to scripts. |
| **Element Picker** | Visually select page elements to auto-generate CSS selectors. |
| **Data Extraction** | Define extraction rules with field selectors, fallback selector chains (first non-empty match wins), post-extraction transforms (trim, lowercase, uppercase, strip HTML, normalize URL/whitespace, replace, regex replace), and output as JSON, CSV, Markdown, XML, HTML, or plain text. Live test button validates extraction against the current page. |
| **Script Scheduling** | Schedule scripts to run at intervals or cron expressions via `chrome.alarms`. |
| **Network Rules** | Block, redirect, or modify request headers using Chrome's `declarativeNetRequest` API. |
| **Element Watcher** | Monitor DOM mutations and trigger actions when elements appear, change, or disappear. |
| **Cross-Tab Flows** | Automate workflows that span multiple browser tabs — open, close, and navigate between tabs. |

### Developer Experience

| Feature | Description |
| --------- | ------------- |
| **Inline Code Editor** | CodeMirror 6 editor with syntax highlighting, autocomplete, and linting — right in the popup. |
| **TypeScript Support** | Write scripts in TypeScript; they are transpiled on save. |
| **Shared Libraries** | Create reusable code modules and import them with `@use()` syntax. |
| **Script Variables** | Use `{{variable}}` templating with a secrets vault for sensitive values. |
| **Version History** | Track script changes with diff comparison (up to 50 versions per script). |
| **Debug Console** | Captures `console.log` output from script execution for inspection. |

### Resilience

| Feature | Description |
| --------- | ------------- |
| **Selector Fallback** | Multi-source selector chains per extraction field — add multiple CSS selectors tried in priority order; first non-empty result wins. Reorderable in the UI. |
| **Smart Wait** | Detects SPA route changes, network idle, and framework renders (React, Vue) before executing. |
| **Retry Policies** | Configurable exponential backoff retry on script failures. |
| **Health Dashboard** | Monitors script failure rates, selector staleness, and storage usage. |
| **Concurrent Flow Guard** | Prevents duplicate execution of the same flow — returns error if already running. |
| **Extraction Payload Validation** | Validates field data before sending to content scripts, filtering invalid fields. |

### Management

| Feature | Description |
| --------- | ------------- |
| **Profiles** | Group automations into switchable contexts (e.g., work vs. personal). |
| **Duplicate** | One-click duplicate for any entity (flows, scripts, shortcuts, CSS rules, network rules, extraction rules) — opens a copy in the editor. |
| **Import / Export** | Full JSON backup and restore with merge strategies. |
| **Global Kill Switch** | Instantly disable all automations from the popup header. |
| **Activity Log** | Timestamped, filterable log with virtual scrolling for 5,000+ entries. |
| **Error Surfacing** | Badge icon and desktop notifications on script errors. |
| **Pre-Built Templates** | One-click install: Cookie Dismisser, Video Navigator, Dark Mode, Element Hider, Auto-Clicker, and more. Template status tracking with update detection, uninstall, and reset to defaults. |

---

## Installation

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ (ships with Node.js)
- **Google Chrome** (or any Chromium-based browser)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/user/browser-automata.git
cd browser-automata

# Install dependencies
npm install

# Build the extension
npm run build
```

### Load into Chrome

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `dist/` folder from the project root.
5. The Browser Automata icon appears in your toolbar — click it to open the popup.

### Development Mode (HMR)

```bash
npm run dev
```

This starts a Vite dev server with hot module replacement. Load the extension from the `dist/` folder as above — changes in source files will reflect immediately without manual reload.

### Open the Popup

Press `Alt+Shift+B` (the default Chrome command) to open the Browser Automata popup from any tab.

---

## End-User Usage Suggestions

These examples require no coding knowledge. Use the popup UI and pre-built templates to get started.

### Install a Template

1. Open the Browser Automata popup.
2. Navigate to the **Templates** tab.
3. Browse available templates (e.g., *Cookie Banner Dismisser*, *Dark Mode Injector*).
4. Click **Install** — the template's scripts, shortcuts, or CSS rules are added automatically.

### Create a Keyboard Shortcut

1. Go to the **Shortcuts** tab.
2. Click **Add Shortcut**.
3. Press the key combination you want (e.g., `Ctrl+Shift+H`).
4. Choose an action: click an element, navigate to a URL, or toggle visibility.
5. Optionally scope it to specific domains.
6. Save — the shortcut is active immediately.

### Inject Custom CSS

1. Go to the **CSS Rules** tab.
2. Add a rule like `body { font-size: 18px !important; }`.
3. Scope it to a domain (e.g., `*://news.ycombinator.com/*`).
4. The CSS is injected on every matching page load.

### Hide Annoying Elements

1. Install the **Element Hider** template.
2. Use the **Element Picker** to visually select an element you want to hide.
3. The generated selector is automatically saved — the element disappears on future visits.

### Use Quick Run Actions

1. Open the Browser Automata popup.
2. Navigate to the **Quick Run** tab.
3. Click **Add Action** and choose a target: a script, flow, extraction rule, or form fill profile.
4. Optionally scope it to specific URLs (e.g., `*://github.com/*`).
5. The action appears as a button on matching pages in the floating Quick Run bar.
6. Click it once to execute — or toggle the bar with `Alt+Q`.

### Switch Between Profiles

1. Create profiles in the **Profiles** tab (e.g., "Work", "Personal").
2. Assign scripts and shortcuts to each profile.
3. Switch profiles from the dropdown — only the active profile's automations run.

---

## Advanced-User Usage Suggestions

These examples leverage scripting, flows, and the extension's programmable API surface.

### Write a Custom Script

```javascript
// Auto-expand all collapsed sections on a documentation site
(function () {
  document.querySelectorAll("details:not([open])").forEach((el) => {
    el.setAttribute("open", "");
  });
})();
```

Set the trigger to `page_load`, scope to your documentation domain, and run in the `MAIN` world to access the page's JavaScript context.

### Chain Actions with Flows

Build a flow that:

1. **Navigate** to a login page.
2. **Wait** for the email field to appear (smart wait).
3. **Type** credentials from script variables.
4. **Click** the submit button.
5. **Wait** for redirect.
6. **Extract** data from the dashboard.
7. **Download** as CSV.

Flows support conditions (`if element exists`), loops, and cross-tab steps.

### Pass Extracted Data Between Flow Nodes

Use `{{varName}}` to interpolate extracted values into subsequent nodes:

1. **Extract Value** — selector: `h1.title`, output variable: `pageTitle`
2. **Navigate** — URL: `https://google.com/search?q={{pageTitle}}`

Variable interpolation works in Navigate URLs, Open Tab URLs, and Type Text fields. Each extract node also supports a **Test Extract** button to validate results live before running the full flow.

### Reuse Extraction Rules in Flows

Instead of configuring extraction inline, add a **Run Extraction Rule** node that references a saved extraction rule by name. All the rule's fields, transforms, fallback selectors, output format, and output actions are applied automatically.

### Use Shared Libraries

Create a shared library called `dom-helpers`:

```javascript
// @library dom-helpers
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}
```

Then reference it in any script with `@use(dom-helpers)`.

### Variable Templating with Secrets

Define variables in the **Variables** tab:

| Variable | Value | Secret |
| ---------- | ------- | -------- |
| `API_KEY` | `sk-abc123...` | Yes |
| `BASE_URL` | `https://api.example.com` | No |

Use them in scripts:

```javascript
fetch("{{BASE_URL}}/data", {
  headers: { Authorization: "Bearer {{API_KEY}}" },
})
  .then((r) => r.json())
  .then(console.log);
```

Secret values are masked in the UI and logs.

### Structured Data Extraction

Define an extraction rule for a product listing page:

| Field | Selector(s) | Attribute | Multiple | Transforms |
| ------- | ------------- | ----------- | ---------- | ------------ |
| `title` | `.product-card h2` | `textContent` | Yes | Trim, Uppercase |
| `price` | `.product-card .price`, `.card .cost` | `textContent` | Yes | Strip HTML, Trim |
| `image` | `.product-card img` | `src` | Yes | Normalize URL |
| `link` | `.product-card a` | `href` | Yes | Normalize URL |

Each field supports **multiple selector sources** — if the primary selector finds nothing, fallbacks are tried in order (first non-empty match wins). **Transforms** are applied after extraction: trim, lowercase, uppercase, strip HTML, normalize URL, collapse whitespace, find-and-replace, and regex replace.

Output as JSON, CSV, Markdown, HTML, XML, or plain text. Trigger manually, via shortcut, or on page load. Use the **Test Extract** button to validate results against the current page before saving.

### Network Request Interception

Use the **Network Rules** tab to:

- **Block** tracking scripts: `*://analytics.example.com/*`
- **Redirect** API calls to a local mock server: `*://api.prod.com/*` → `http://localhost:3000/*`
- **Modify headers**: Add `X-Debug: true` to all requests on a staging domain.

### Chord Shortcuts (Vim-Style)

Create multi-key sequences:

- `g` → `h` — Navigate to homepage
- `g` → `i` — Navigate to issues page
- `g` → `p` — Navigate to pull requests

Chord timeout is configurable (default: 500ms).

### Script Scheduling

Schedule a script to run every 5 minutes:

1. Set trigger to `schedule`.
2. Configure the interval or cron expression.
3. The script runs in the background via `chrome.alarms`, even when the popup is closed.

### TypeScript Scripts

Write scripts in TypeScript — they are compiled to JavaScript on save:

```typescript
interface Product {
  name: string;
  price: number;
}

const products: Product[] = Array.from(
  document.querySelectorAll<HTMLElement>(".product")
).map((el) => ({
  name: el.querySelector("h2")?.textContent ?? "",
  price: parseFloat(el.querySelector(".price")?.textContent ?? "0"),
}));

console.table(products);
```

---

## Architecture Overview

Browser Automata follows Chrome's extension architecture with three isolated contexts:

```text
┌─────────────────────────────────────────────────────┐
│                   Chrome Browser                     │
│                                                      │
│  ┌──────────────┐   chrome.runtime    ┌───────────┐ │
│  │  Popup UI    │ ◄────────────────► │  Service   │ │
│  │  (React +    │   .sendMessage()   │  Worker    │ │
│  │  Tailwind)   │                    │            │ │
│  └──────────────┘                    │  Handlers  │ │
│                                      │  Services  │ │
│  ┌──────────────┐   chrome.runtime   │  Storage   │ │
│  │  Options Page│ ◄────────────────► │            │ │
│  │  (Full-page) │   .sendMessage()   └─────┬─────┘ │
│  └──────────────┘                          │       │
│                                    chrome.  │       │
│                                    scripting│       │
│  ┌──────────────┐   chrome.runtime         │       │
│  │  Content     │ ◄───────────────────────┘       │
│  │  Script      │                                  │
│  │  (Per-tab)   │   Shortcut listener              │
│  │              │   Element picker                  │
│  │              │   Action recorder                 │
│  │              │   Data extractor                  │
│  └──────────────┘                                  │
└─────────────────────────────────────────────────────┘
```

**Service Worker** — Always-running background context. Handles message routing (with global error handler), script execution, storage CRUD, scheduling, and all business logic. Concurrent flow execution is guarded to prevent race conditions.

**Content Script** — Injected into every tab. Listens for keyboard shortcuts (with 100ms debounce), provides element picking, action recording, data extraction, selector testing, and the Quick Run floating action bar. Wrapped in error boundary for crash resilience.

**Popup UI** — React application (400×580px). Provides the 14-tab interface for managing all automation entities. Uses shared `ViewRouter` for lazy-loaded views (deduplicated between popup and options). State cached via session storage for fast popup reopening.

**Options Page** — Full-page editor with sidebar layout, sharing the same `ViewRouter` and views as the popup.

### Data Model

All entities share a common `EntityMeta` base (timestamps, IDs) and are stored in `chrome.storage.local`:

- **Script** — JavaScript code with triggers, scoping, world, and execution timing
- **Shortcut** — Key combo → action binding with per-domain scope
- **Flow** — Directed graph of action/condition/wait/loop nodes
- **CSSRule** — Stylesheet injection scoped to URL patterns
- **ExtractionRule** — Field definitions with selectors and output format
- **NetworkRule** — Request blocking, redirection, and header modification
- **Profile** — Named group of automation entities
- **ScriptVariable** — Templating variables with optional secret flag
- **SharedLibrary** — Reusable code modules
- **FormFillProfile** — Auto-fill field mappings
- **NotificationRule** — Element monitoring with alert triggers
- **QuickRunAction** — Single-click action buttons scoped to URL patterns, targeting scripts, flows, extraction rules, or form fills

---

## Tech Stack

| Layer | Technology | Why |
| ------- | ----------- | ----- |
| **Language** | TypeScript 5.7 (strict) | Full type safety across all extension contexts |
| **UI Framework** | React 18 | Fast mount/unmount lifecycle fits popup constraints |
| **Styling** | Tailwind CSS 4 | Utility-first, dark-theme-optimized, minimal CSS output |
| **State** | Zustand 5 | Provider-less store — ideal for popup lifecycle |
| **Code Editor** | CodeMirror 6 | ~100KB tree-shaken; modular plugins for autocomplete, lint, and language modes |
| **Virtual Scroll** | TanStack Virtual 3 | Handles 5,000+ log entries without DOM bloat |
| **Icons** | Lucide React | Lightweight, tree-shakeable icon set |
| **Build** | Vite 6 + CRXJS | MV3-native builds with HMR in development |
| **Testing** | Vitest 2 + Testing Library | Vite-native test runner with jsdom and Chrome API mocks |
| **Lint** | ESLint + typescript-eslint + Prettier | Consistent code style enforcement |

---

## Project Structure

```text
browser-automata/
├── src/
│   ├── background/              # Service Worker context
│   │   ├── service-worker.ts    # Entry point; synchronous listener registration
│   │   ├── message-router.ts    # Dispatch table for all message types
│   │   ├── handlers/            # One handler per entity domain (15 handlers)
│   │   └── services/            # Business logic & execution engines (29 services)
│   ├── content/                 # Content Script (injected per-tab)
│   │   ├── index.ts             # Entry: storage sync, message listener
│   │   ├── shortcut-listener.ts # Keyboard event binding
│   │   ├── recorder.ts          # Action recording engine
│   │   ├── element-picker.ts    # Visual element selector
│   │   ├── extractor.ts         # On-page data extraction
│   │   ├── selector-tester.ts   # CSS selector validation
│   │   ├── selector-widget.ts   # Selector alternatives overlay
│   │   ├── action-highlight.ts  # Visual feedback for recorded actions
│   │   ├── deep-query.ts        # Shadow DOM piercing queries
│   │   ├── quick-run-bar.ts     # Floating quick-action bar overlay
│   │   ├── toast.ts             # In-page toast notifications
│   │   └── content.css          # Content script styles
│   ├── popup/                   # Popup UI (React + Tailwind)
│   │   ├── App.tsx              # Root layout with lazy-loaded views
│   │   ├── main.tsx             # React entry point
│   │   ├── popup.css            # Popup-specific styles
│   │   ├── stores/              # Zustand state management (7 stores)
│   │   ├── hooks/               # React hooks (init, theme, messaging)
│   │   ├── components/
│   │   │   ├── Header.tsx       # Popup header with global controls
│   │   │   ├── TabBar.tsx       # Bottom navigation with keyboard nav + ARIA
│   │   │   ├── QuickRunBar.tsx   # Quick-action buttons in popup
│   │   │   ├── ViewRouter.tsx   # Shared lazy-loaded view routing (popup + options)
│   │   │   ├── views/           # 14 tab panels (Quick Run, Scripts, Shortcuts, Flows, ...)
│   │   │   ├── editor/          # CodeMirror wrapper, selector inputs
│   │   │   │   └── flow-nodes/  # Split FlowNodeEditor sub-components (7 files)
│   │   │   └── ui/              # Shared primitives (Button, Input, Toggle, ...)
│   │   └── utils/               # Export/import helpers
│   ├── results/                 # Extraction result viewer page (session-storage driven)
│   ├── options/                 # Full-page Options UI (App.tsx, main.tsx, options.css)
│   ├── lib/codemirror/          # CodeMirror editor configuration
│   ├── shared/                  # Cross-context shared code
│   │   ├── types/               # Entity, message, and settings types
│   │   ├── messaging/           # Typed message sending
│   │   ├── storage/             # Chrome storage CRUD + schema migrations
│   │   ├── url-pattern/         # URL pattern matching & specificity
│   │   ├── constants.ts         # Storage keys, defaults, schema version
│   │   ├── utils.ts             # Cross-context utility functions
│   │   ├── template-hash.ts     # SHA-256 content hashing for templates
│   │   ├── deep-query-snippet.ts # Shadow DOM query snippet
│   │   └── theme.css            # Shared theme variables
│   ├── data/templates/          # Bundled pre-built templates
│   └── assets/
│       ├── icons/               # Extension icons (16–128px)
│       └── icon/                # Themed brand icons (Dark/White, PNG/SVG)
├── tests/                       # Vitest test suite
│   ├── setup.ts                 # Chrome API mocks
│   ├── helpers.ts               # Shared test utilities
│   ├── smoke.test.ts            # Smoke tests
│   ├── background/              # Handler tests
│   ├── messaging/               # Message type tests
│   ├── storage/                 # Storage & migration tests
│   └── url-pattern/             # Pattern matching tests
├── Docs/                        # Product specifications & implementation plan
├── manifest.json                # Chrome MV3 manifest
├── vite.config.ts               # CRXJS + React + Tailwind build config
├── vitest.config.ts             # Test configuration
├── tsconfig.json                # TypeScript strict configuration
├── eslint.config.ts             # Linting rules
└── package.json                 # Scripts and dependencies
```

---

## Development

### Commands

| Command | Description |
| --------- | ------------- |
| `npm run dev` | Start dev server with HMR (port 5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run type-check` | TypeScript strict mode validation |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier auto-format |
| `npm run format:check` | Prettier dry-run check |

### Chrome Permissions

The extension requests the following permissions:

| Permission | Purpose |
| ----------- | --------- |
| `storage` | Persist all automation entities and settings |
| `activeTab` | Access the current tab for script execution |
| `scripting` | Inject scripts and CSS into web pages |
| `tabs` | Cross-tab flow execution and tab management |
| `alarms` | Script scheduling |
| `clipboardWrite` / `clipboardRead` | Clipboard integration |
| `notifications` | Desktop notifications for errors and monitors |
| `declarativeNetRequest` | Network request interception |
| `declarativeNetRequestFeedback` | Debug feedback for network rules |
| `downloads` (optional) | File output for extracted data |
| `<all_urls>` (host) | Content script injection on all pages |

---

## Testing

```bash
# Run tests once
npm run test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage
```

Tests use **Vitest** with a jsdom environment and Chrome API mocks (defined in `tests/setup.ts`). Coverage is tracked via v8.

### Test Structure

- `tests/storage/` — Chrome storage CRUD and schema migration tests
- `tests/messaging/` — Message type guard and dispatch tests
- `tests/url-pattern/` — URL pattern matching and specificity ranking
- `tests/background/` — Handler-level integration tests

---

## Contributing

### Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies: `npm install`
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Start the dev server: `npm run dev`
5. Load the extension from `dist/` in Chrome.

### Code Quality Gates

Before submitting a pull request, ensure all checks pass:

```bash
npm run type-check   # No TypeScript errors
npm run lint         # No linting violations
npm run format:check # Consistent formatting
npm run test         # All tests pass
```

### Conventions

- **TypeScript strict mode** — No `any`, no implicit types.
- **Entity-per-handler pattern** — Each entity domain has its own handler in `background/handlers/` and service in `background/services/`.
- **Discriminated union messaging** — All messages between contexts use typed discriminated unions (see `shared/types/messages.ts`).
- **URL pattern scoping** — All user-facing automations support URL pattern scoping. Never hardcode domain checks.
- **No external network calls** — The extension runs entirely locally. No analytics, no telemetry, no external APIs.

### Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR.
- Include tests for new functionality.
- Update relevant types in `shared/types/` when changing entity schemas.
- Test in Chrome with the extension loaded before submitting.

---

## Support

If you find Browser Automata useful, consider supporting its development:

[![Open Collective](https://img.shields.io/badge/Open%20Collective-Donate-blue?logo=opencollective)](https://opencollective.com/browser-automata-extension)

---

## License

This project is private and [licensed](LICENSE) for distribution.

Copyright (c) 2026, Muhammed Said Bilgehan. All rights reserved.
