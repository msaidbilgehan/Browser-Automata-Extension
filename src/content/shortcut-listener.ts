import type { Shortcut, KeyCombo, ChordCombo } from "@/shared/types/entities";
import { querySelectorDeep } from "./deep-query";
import { showKeyToast, showErrorToast } from "./toast";
import { flashHighlight } from "./action-highlight";

/** Active shortcuts for the current page, pushed from service worker */
let activeShortcuts: Shortcut[] = [];

/** Whether the keydown listener has been registered */
let listenerRegistered = false;

/** Debounce: minimum 100ms between fires per shortcut ID */
const DEBOUNCE_MS = 100;
const lastFireTime = new Map<string, number>();

/** Chord state machine */
let chordState: "idle" | "chord_in_progress" = "idle";
let chordBuffer: KeyCombo[] = [];
let chordTimeout: ReturnType<typeof setTimeout> | null = null;
let chordCandidates: Shortcut[] = [];

/** Update the active shortcuts (called when UPDATE_SHORTCUTS message arrives) */
export function setActiveShortcuts(shortcuts: Shortcut[]): void {
  activeShortcuts = shortcuts;
  resetChordState();
  // Drop debounce timestamps for shortcuts that are no longer active so the
  // map stays bounded to the current shortcut set.
  const activeIds = new Set<string>(shortcuts.map((s) => s.id));
  for (const id of lastFireTime.keys()) {
    if (!activeIds.has(id)) lastFireTime.delete(id);
  }
  console.debug(
    `[Browser Automata] Received ${String(shortcuts.length)} shortcut(s) for this page`,
  );
}

/** Get active shortcut count (for debugging) */
export function getActiveShortcutCount(): number {
  return activeShortcuts.length;
}

/** Serialize a keyboard event to a comparable KeyCombo */
function eventToKeyCombo(e: KeyboardEvent): KeyCombo {
  return {
    key: e.key,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
  };
}

/**
 * Check if a KeyCombo matches another KeyCombo.
 *
 * For a single printable character the produced `e.key` already encodes the
 * Shift state (e.g. "8" vs "*", "a" vs "A"), so the character itself is the
 * source of truth: compare it exactly (case-sensitive) and ignore Shift.
 * Matching case-insensitively and skipping Shift — as before — made a "/"
 * shortcut also fire on "?" (Shift+/) and "a" on Shift+"A", hijacking the
 * page's own keys.
 *
 * Named keys (Enter, ArrowUp, F5, …) carry no character casing, so they are
 * compared with the full modifier set, Shift included.
 */
function comboMatches(combo: KeyCombo, event: KeyCombo): boolean {
  if (combo.key.length === 1) {
    return (
      combo.key === event.key &&
      combo.ctrlKey === event.ctrlKey &&
      combo.altKey === event.altKey &&
      combo.metaKey === event.metaKey
    );
  }

  return (
    combo.key.toLowerCase() === event.key.toLowerCase() &&
    combo.ctrlKey === event.ctrlKey &&
    combo.shiftKey === event.shiftKey &&
    combo.altKey === event.altKey &&
    combo.metaKey === event.metaKey
  );
}

/** Type guard: check if a keyCombo is a ChordCombo */
function isChordCombo(keyCombo: KeyCombo | ChordCombo): keyCombo is ChordCombo {
  return "sequence" in keyCombo;
}

/** Reset chord state machine to idle */
function resetChordState(): void {
  chordState = "idle";
  chordBuffer = [];
  chordCandidates = [];
  if (chordTimeout !== null) {
    clearTimeout(chordTimeout);
    chordTimeout = null;
  }
}

/** Find a matching shortcut for a single-key combo */
function findSingleMatchingShortcut(event: KeyCombo): Shortcut | undefined {
  return activeShortcuts.find((shortcut) => {
    if (isChordCombo(shortcut.keyCombo)) return false;
    return comboMatches(shortcut.keyCombo, event);
  });
}

/** Find all shortcuts whose chord sequence starts with the given KeyCombo */
function findChordCandidates(event: KeyCombo): Shortcut[] {
  return activeShortcuts.filter((shortcut) => {
    if (!isChordCombo(shortcut.keyCombo)) return false;
    const firstCombo = shortcut.keyCombo.sequence[0];
    if (firstCombo === undefined) return false;
    return comboMatches(firstCombo, event);
  });
}

/** Filter existing chord candidates that match the next key in their sequence */
function advanceChordCandidates(
  candidates: Shortcut[],
  event: KeyCombo,
  stepIndex: number,
): Shortcut[] {
  return candidates.filter((shortcut) => {
    if (!isChordCombo(shortcut.keyCombo)) return false;
    const comboAtStep = shortcut.keyCombo.sequence[stepIndex];
    if (comboAtStep === undefined) return false;
    return comboMatches(comboAtStep, event);
  });
}

/** Find a chord candidate that is fully completed at the given step */
function findCompletedChord(candidates: Shortcut[], stepIndex: number): Shortcut | undefined {
  return candidates.find((shortcut) => {
    if (!isChordCombo(shortcut.keyCombo)) return false;
    return shortcut.keyCombo.sequence.length === stepIndex + 1;
  });
}

/** Get the minimum timeout from a list of chord candidates */
function getMinChordTimeout(candidates: Shortcut[]): number {
  let minTimeout = Infinity;
  for (const candidate of candidates) {
    if (isChordCombo(candidate.keyCombo)) {
      const t = candidate.keyCombo.timeoutMs;
      if (t < minTimeout) {
        minTimeout = t;
      }
    }
  }
  return minTimeout === Infinity ? 1000 : minTimeout;
}

/** Format a single KeyCombo as a human-readable label (e.g. "Ctrl+Shift+K") */
function formatSingleCombo(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.ctrlKey) parts.push("Ctrl");
  if (combo.altKey) parts.push("Alt");
  if (combo.shiftKey) parts.push("Shift");
  if (combo.metaKey) parts.push("Cmd");
  parts.push(combo.key.length === 1 ? combo.key.toUpperCase() : combo.key);
  return parts.join("+");
}

/** Format a KeyCombo or ChordCombo as a human-readable label */
function formatKeyCombo(combo: KeyCombo | ChordCombo): string {
  if ("sequence" in combo) {
    return combo.sequence.map(formatSingleCombo).join(" \u2192 ");
  }
  return formatSingleCombo(combo);
}

/**
 * Execute a shortcut action locally in the content script
 * (click, focus) or dispatch to service worker (script, navigate, flow).
 * Shows a toast and highlights the target element where applicable.
 */
function executeShortcutAction(shortcut: Shortcut): void {
  // Debounce: skip if fired too recently
  const now = Date.now();
  // Prune entries that have aged out of the debounce window so the map can't
  // accumulate stale shortcut IDs over a long-lived page session.
  for (const [id, ts] of lastFireTime) {
    if (now - ts >= DEBOUNCE_MS) lastFireTime.delete(id);
  }
  const lastFire = lastFireTime.get(shortcut.id);
  if (lastFire !== undefined && now - lastFire < DEBOUNCE_MS) return;
  lastFireTime.set(shortcut.id, now);

  const toastCleanup = showKeyToast(formatKeyCombo(shortcut.keyCombo), shortcut.name);
  // Only register keyup listener when in key_release mode (cleanup is non-null)
  if (toastCleanup !== null) {
    document.addEventListener("keyup", toastCleanup, { once: true, capture: true });
  }
  switch (shortcut.action.type) {
    case "click": {
      const el = querySelectorDeep(shortcut.action.selector);
      if (el !== null) {
        clickElement(el);
        if (el instanceof HTMLElement) flashHighlight(el);
        notifyServiceWorker(shortcut.id);
      } else {
        reportActionFailure(
          shortcut,
          `no element matched "${shortcut.action.selector}"`,
        );
      }
      break;
    }
    case "focus": {
      const el = querySelectorDeep(shortcut.action.selector);
      if (el instanceof HTMLElement) {
        el.focus();
        flashHighlight(el);
        notifyServiceWorker(shortcut.id);
      } else {
        reportActionFailure(
          shortcut,
          `no focusable element matched "${shortcut.action.selector}"`,
        );
      }
      break;
    }
    case "script":
    case "inline_script":
    case "navigate":
    case "flow":
    case "extraction":
      // Dispatch to service worker
      notifyServiceWorker(shortcut.id);
      break;
  }
}

/**
 * Activate an element. Uses the native `click()` (present on HTML and SVG
 * elements) and falls back to a synthetic, bubbling MouseEvent for anything
 * else so an SVG-less custom element is still clickable. The old code required
 * `instanceof HTMLElement`, which silently skipped SVG icon buttons.
 */
function clickElement(el: Element): void {
  const clickable = el as HTMLElement;
  if (typeof clickable.click === "function") {
    clickable.click();
  } else {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }
}

/**
 * Surface a content-script action failure: an on-page error toast for the user
 * plus a service-worker notification so the activity log records the failure.
 * Previously a missing target only emitted a `console.warn`, so the user saw the
 * "triggered" toast but got no indication the click/focus never happened.
 */
function reportActionFailure(shortcut: Shortcut, reason: string): void {
  console.warn(`[Browser Automata] ${shortcut.name}: ${reason}`);
  showErrorToast(`${shortcut.name}: ${reason}`);
  notifyServiceWorker(shortcut.id, reason);
}

/** Returns false when the extension has been reloaded/uninstalled and this content script is orphaned */
function isContextValid(): boolean {
  try {
    // Access chrome.runtime.id — throws if the extension context has been invalidated
    void chrome.runtime.id;
    return true;
  } catch {
    return false;
  }
}

/**
 * Notify the service worker that a shortcut was fired (for logging & complex
 * execution). When `error` is provided, a locally-handled click/focus action
 * failed and the service worker logs it as a failure rather than a plain trigger.
 */
function notifyServiceWorker(shortcutId: string, error?: string): void {
  if (!isContextValid()) return;
  const message: { type: "SHORTCUT_FIRED"; shortcutId: string; error?: string } = {
    type: "SHORTCUT_FIRED",
    shortcutId,
  };
  if (error !== undefined) message.error = error;
  chrome.runtime.sendMessage(message).catch((err: unknown) => {
    console.debug(
      "[Browser Automata] SHORTCUT_FIRED send failed (service worker may not be ready):",
      err,
    );
  });
}

/** Handle a keydown event — processes both single combos and chord sequences */
function handleKeyDown(e: KeyboardEvent): void {
  // Ignore auto-repeat keydown events (held key) to prevent action spam
  if (e.repeat) return;

  // Don't intercept when user is typing in an input
  const target = e.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    console.debug(
      `[Browser Automata] keydown ignored — target is editable:`,
      target.tagName,
      target,
    );
    return;
  }

  if (activeShortcuts.length === 0) {
    return;
  }

  const eventCombo = eventToKeyCombo(e);
  console.debug(`[Browser Automata] keydown:`, eventCombo);

  if (chordState === "chord_in_progress") {
    // We are mid-chord — try to advance candidates
    const stepIndex = chordBuffer.length;
    const remaining = advanceChordCandidates(chordCandidates, eventCombo, stepIndex);

    if (remaining.length === 0) {
      // No candidates match — reset and fall through to check single combos
      resetChordState();
    } else {
      // We have matching candidates
      e.preventDefault();
      e.stopPropagation();
      chordBuffer.push(eventCombo);

      const completed = findCompletedChord(remaining, stepIndex);
      if (completed !== undefined) {
        // Chord sequence completed
        resetChordState();
        executeShortcutAction(completed);
        return;
      }

      // Still more keys needed — update candidates and restart timeout
      chordCandidates = remaining;
      if (chordTimeout !== null) {
        clearTimeout(chordTimeout);
      }
      const timeout = getMinChordTimeout(remaining);
      chordTimeout = setTimeout(() => {
        resetChordState();
      }, timeout);
      return;
    }
  }

  // State is idle — check for chord starts first, then single combos
  const candidates = findChordCandidates(eventCombo);
  if (candidates.length > 0) {
    // A single-step chord that matches outright is unambiguously the
    // extension's — suppress the key and run it.
    const completed = findCompletedChord(candidates, 0);
    if (completed !== undefined && candidates.length === 1) {
      e.preventDefault();
      e.stopPropagation();
      resetChordState();
      executeShortcutAction(completed);
      return;
    }

    // Multi-step chord: this first key is still speculative, so do NOT
    // preventDefault/stopPropagation — the host page must keep receiving the key
    // for its own shortcut (e.g. Gmail's "g i"). Suppression begins only once a
    // subsequent key confirms the chord is ours (the mid-chord branch above).
    chordState = "chord_in_progress";
    chordBuffer = [eventCombo];
    chordCandidates = candidates;

    const timeout = getMinChordTimeout(candidates);
    chordTimeout = setTimeout(() => {
      // Timeout expired — if we had a single-step completed chord, execute it
      const singleStep = findCompletedChord(chordCandidates, 0);
      if (singleStep !== undefined) {
        executeShortcutAction(singleStep);
      }
      resetChordState();
    }, timeout);
    return;
  }

  // No chord candidates — try single-key combos
  const matched = findSingleMatchingShortcut(eventCombo);
  if (matched !== undefined) {
    e.preventDefault();
    e.stopPropagation();
    executeShortcutAction(matched);
  }
}

/**
 * Initialize the shortcut keydown listener.
 * Call once from content script entry point.
 * Guarded against duplicate registration (e.g. if content script is re-injected).
 */
export function initShortcutListener(): void {
  if (listenerRegistered) return;
  listenerRegistered = true;
  // Use capture phase so we see keydown before the page's own handlers
  // can stop propagation (e.g. YouTube Shorts swallows keyboard events).
  document.addEventListener("keydown", handleKeyDown, true);
}
