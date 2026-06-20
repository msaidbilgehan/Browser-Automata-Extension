/** Action recorder — captures user interactions and generates scripts */

import { generateSelector } from "./element-picker";

/** Recorded action types */
interface ClickAction {
  type: "click";
  selector: string;
  text: string;
  timestamp: number;
}

interface TypeAction {
  type: "type";
  selector: string;
  value: string;
  timestamp: number;
}

interface ScrollAction {
  type: "scroll";
  direction: "up" | "down";
  amount: number;
  timestamp: number;
}

interface NavigateAction {
  type: "navigate";
  url: string;
  timestamp: number;
}

type RecordedAction = ClickAction | TypeAction | ScrollAction | NavigateAction;

let isRecording = false;
let recordedActions: RecordedAction[] = [];

/** Typing debounce state */
let typeBuffer = "";
let typeTarget: Element | null = null;
let typeTimeout: ReturnType<typeof setTimeout> | null = null;
const TYPE_DEBOUNCE_MS = 500;

/** Scroll debounce state */
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingScrollY = 0;
let hasPendingScroll = false;
const SCROLL_DEBOUNCE_MS = 250;

/** Last URL a navigate action was recorded for — dedupes overlapping nav signals. */
let lastNavigatedUrl = "";

/**
 * Per-tab "recording is active" flag, persisted in `window.sessionStorage`.
 *
 * Recording state otherwise lives only in this content-script instance, which a
 * full page navigation tears down — the freshly injected instance would start
 * with `isRecording = false` and silently drop everything after the first
 * navigation. `sessionStorage` survives full (same-origin) navigations and
 * reloads within the tab and is reachable from the content script, so the new
 * instance can re-arm on init via {@link resumeRecordingIfActive}. (SPA route
 * changes never tear the instance down and are handled by the navigation
 * listeners instead.)
 */
const RECORDING_SESSION_KEY = "__ba_recording";

function persistRecordingFlag(active: boolean): void {
  try {
    if (active) {
      window.sessionStorage.setItem(RECORDING_SESSION_KEY, "1");
    } else {
      window.sessionStorage.removeItem(RECORDING_SESSION_KEY);
    }
  } catch {
    // sessionStorage can be unavailable (sandboxed iframe, storage disabled);
    // re-arm across full navigations is best-effort, so ignore.
  }
}

/** Send a recorded action to the service worker */
function sendAction(action: RecordedAction): void {
  const messagePayload: {
    type: "RECORDED_ACTION";
    action: {
      type: "click" | "type" | "scroll" | "navigate";
      selector?: string;
      value?: string;
      url?: string;
    };
  } = {
    type: "RECORDED_ACTION",
    action: {
      type: action.type,
    },
  };

  switch (action.type) {
    case "click":
      messagePayload.action.selector = action.selector;
      messagePayload.action.value = action.text;
      break;
    case "type":
      messagePayload.action.selector = action.selector;
      messagePayload.action.value = action.value;
      break;
    case "scroll":
      messagePayload.action.value = `${action.direction}:${String(action.amount)}`;
      break;
    case "navigate":
      messagePayload.action.url = action.url;
      break;
  }

  try {
    void chrome.runtime.id; // Throws if extension context is invalidated
  } catch {
    return;
  }
  chrome.runtime.sendMessage(messagePayload).catch(() => {
    // Service worker may not be ready
  });
}

/** Flush accumulated typing buffer as a single type action */
function flushTypeBuffer(): void {
  if (typeBuffer.length === 0 || typeTarget === null) return;

  const action: TypeAction = {
    type: "type",
    selector: generateSelector(typeTarget),
    value: typeBuffer,
    timestamp: Date.now(),
  };

  recordedActions.push(action);
  sendAction(action);

  typeBuffer = "";
  typeTarget = null;
  if (typeTimeout !== null) {
    clearTimeout(typeTimeout);
    typeTimeout = null;
  }
}

/** Handle click events */
function onRecordClick(e: MouseEvent): void {
  if (!isRecording) return;

  // Flush any pending typing / scroll so they are ordered before this click
  flushTypeBuffer();
  flushScroll();

  const target = e.target;
  if (!(target instanceof Element)) return;

  const selector = generateSelector(target);
  const text = target instanceof HTMLElement ? (target.textContent ?? "").trim().slice(0, 100) : "";

  const action: ClickAction = {
    type: "click",
    selector,
    text,
    timestamp: Date.now(),
  };

  recordedActions.push(action);
  sendAction(action);
}

/** True for elements whose typed text we record (text inputs, textareas, contentEditable). */
function isTextEntryTarget(target: EventTarget | null): target is HTMLElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Snapshot the field's current committed value into the type buffer (debounced flush). */
function captureFieldValue(target: HTMLElement): void {
  // A different field — flush the previous one first so each becomes its own action.
  if (typeTarget !== null && typeTarget !== target) {
    flushTypeBuffer();
  }
  typeTarget = target;
  typeBuffer =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target.value
      : (target.textContent ?? "");

  if (typeTimeout !== null) {
    clearTimeout(typeTimeout);
  }
  typeTimeout = setTimeout(() => {
    flushTypeBuffer();
  }, TYPE_DEBOUNCE_MS);
}

/**
 * Record typed text from the `input` event — the element's *committed* value —
 * rather than synthesizing it from individual keydowns. Reading `.value`
 * captures the real result of IME composition (CJK), paste, and autofill;
 * reconstructing from `e.key` recorded the Latin keys driving the IME (e.g.
 * romaji "k","a" instead of the committed "か").
 */
function onRecordInput(e: Event): void {
  if (!isRecording) return;
  if (!isTextEntryTarget(e.target)) return;
  // Skip intermediate IME composition events — the committed value arrives via
  // the trailing (non-composing) input and the compositionend handler.
  if (e instanceof InputEvent && e.isComposing) return;
  captureFieldValue(e.target);
}

/** Capture the committed text once an IME composition finishes. */
function onRecordCompositionEnd(e: CompositionEvent): void {
  if (!isRecording) return;
  if (!isTextEntryTarget(e.target)) return;
  captureFieldValue(e.target);
}

/**
 * Flush the settled scroll position as a single coalesced scroll action.
 *
 * Recording one action per settled scroll (rather than mutating the last
 * recorded action in place) keeps the local `recordedActions` array and the
 * live `RECORDED_ACTION` stream consistent — both receive the same final
 * scroll position exactly once.
 */
function flushScroll(): void {
  if (scrollTimeout !== null) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }
  if (!hasPendingScroll) return;
  hasPendingScroll = false;

  // Direction relative to the previous scroll position (top of page = 0).
  let prevAmount = 0;
  for (let i = recordedActions.length - 1; i >= 0; i--) {
    const prev = recordedActions[i];
    if (prev?.type === "scroll") {
      prevAmount = prev.amount;
      break;
    }
  }

  const action: ScrollAction = {
    type: "scroll",
    direction: pendingScrollY >= prevAmount ? "down" : "up",
    amount: pendingScrollY,
    timestamp: Date.now(),
  };

  recordedActions.push(action);
  sendAction(action);
}

/** Handle scroll events — debounce and record once scrolling settles */
function onRecordScroll(): void {
  if (!isRecording) return;

  pendingScrollY = window.scrollY;
  hasPendingScroll = true;

  if (scrollTimeout !== null) {
    clearTimeout(scrollTimeout);
  }
  scrollTimeout = setTimeout(flushScroll, SCROLL_DEBOUNCE_MS);
}

/** Record a navigation to `url`, deduping repeated signals for the same URL. */
function recordNavigation(url: string): void {
  if (!isRecording) return;
  if (url === lastNavigatedUrl) return;
  lastNavigatedUrl = url;

  flushTypeBuffer();
  flushScroll();

  const action: NavigateAction = {
    type: "navigate",
    url,
    timestamp: Date.now(),
  };

  recordedActions.push(action);
  sendAction(action);
}

/** History back/forward (and hash changes) — fire after the URL has updated. */
function onPopState(): void {
  recordNavigation(location.href);
}

function onHashChange(): void {
  recordNavigation(location.href);
}

/**
 * Minimal handle on the Navigation API (Chrome 102+). Typed loosely because
 * lib.dom coverage for `Navigation`/`NavigateEvent` varies across TS versions.
 */
interface NavigationLike {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

function getNavigation(): NavigationLike | null {
  return (window as unknown as { navigation?: NavigationLike }).navigation ?? null;
}

/**
 * SPA route change via history.pushState/replaceState or an in-app link. The
 * content script runs in an isolated world, so monkey-patching the page's
 * `history` would not see the page's own calls — but the Navigation API's
 * `navigatesuccess` event fires on the shared window after the URL commits,
 * which `popstate` does not for pushState/replaceState navigations.
 */
function onSpaNavigate(): void {
  recordNavigation(location.href);
}

/** Start recording user actions */
export function startRecording(): void {
  if (isRecording) return;
  isRecording = true;
  persistRecordingFlag(true);
  recordedActions = [];
  typeBuffer = "";
  typeTarget = null;
  if (typeTimeout !== null) {
    clearTimeout(typeTimeout);
    typeTimeout = null;
  }
  pendingScrollY = 0;
  hasPendingScroll = false;
  if (scrollTimeout !== null) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }
  // Seed with the current URL so the Navigation API's initial navigatesuccess
  // (same URL) is deduped instead of recorded as a spurious navigation.
  lastNavigatedUrl = location.href;

  document.addEventListener("click", onRecordClick, true);
  // Capture typed text from input/compositionend (committed, IME-safe values)
  // rather than synthesizing it from keydown.
  document.addEventListener("input", onRecordInput, true);
  document.addEventListener("compositionend", onRecordCompositionEnd, true);
  window.addEventListener("scroll", onRecordScroll, { passive: true });
  window.addEventListener("popstate", onPopState);
  window.addEventListener("hashchange", onHashChange);
  getNavigation()?.addEventListener("navigatesuccess", onSpaNavigate);
}

/** Stop recording and return all recorded actions */
export function stopRecording(): RecordedAction[] {
  if (!isRecording) return [];

  // Flush any pending typing / scroll
  flushTypeBuffer();
  flushScroll();

  isRecording = false;
  persistRecordingFlag(false);

  document.removeEventListener("click", onRecordClick, true);
  document.removeEventListener("input", onRecordInput, true);
  document.removeEventListener("compositionend", onRecordCompositionEnd, true);
  window.removeEventListener("scroll", onRecordScroll);
  window.removeEventListener("popstate", onPopState);
  window.removeEventListener("hashchange", onHashChange);
  getNavigation()?.removeEventListener("navigatesuccess", onSpaNavigate);

  const actions = [...recordedActions];
  recordedActions = [];
  return actions;
}

/**
 * Re-arm recording after a fresh content-script injection if the tab was
 * recording before a full page navigation/reload.
 *
 * Called once on content-script init. A full navigation destroys the previous
 * instance (so its `isRecording` is gone), but the persisted
 * {@link RECORDING_SESSION_KEY} flag survives in `sessionStorage`. When set, we
 * restart the listeners so actions on the new page keep streaming to the service
 * worker instead of being silently dropped. The navigation that re-injected this
 * instance was already captured by the click/submit that triggered it, so no
 * synthetic navigate action is emitted here.
 */
export function resumeRecordingIfActive(): void {
  let wasRecording = false;
  try {
    wasRecording = window.sessionStorage.getItem(RECORDING_SESSION_KEY) === "1";
  } catch {
    return; // sessionStorage unavailable — nothing to resume
  }
  if (wasRecording) {
    startRecording();
  }
}

/** Convert recorded actions to a JavaScript code string */
export function generateScriptFromActions(actions: RecordedAction[]): string {
  const lines: string[] = [
    "// Auto-generated script from Browser Automata recorder",
    "(async () => {",
  ];

  for (const action of actions) {
    switch (action.type) {
      case "click":
        lines.push(`  // Click: ${action.text.slice(0, 50)}`);
        lines.push(`  document.querySelector(${JSON.stringify(action.selector)})?.click();`);
        lines.push(`  await new Promise(r => setTimeout(r, 300));`);
        break;
      case "type":
        lines.push(`  // Type text`);
        lines.push(`  {`);
        lines.push(`    const el = document.querySelector(${JSON.stringify(action.selector)});`);
        lines.push(
          `    if (el) { el.focus(); el.value = ${JSON.stringify(action.value)}; el.dispatchEvent(new Event("input", { bubbles: true })); }`,
        );
        lines.push(`  }`);
        lines.push(`  await new Promise(r => setTimeout(r, 200));`);
        break;
      case "scroll":
        lines.push(`  // Scroll ${action.direction}`);
        lines.push(`  window.scrollTo({ top: ${String(action.amount)}, behavior: "smooth" });`);
        lines.push(`  await new Promise(r => setTimeout(r, 500));`);
        break;
      case "navigate":
        lines.push(`  // Navigate`);
        lines.push(`  window.location.href = ${JSON.stringify(action.url)};`);
        break;
    }
    lines.push("");
  }

  lines.push("})();");
  return lines.join("\n");
}
