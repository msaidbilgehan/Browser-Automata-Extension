/**
 * Live selector tester — highlights all elements matching a CSS selector
 * on the page. Used by the popup's SelectorInput to provide real-time
 * visual feedback as the user types or edits a selector.
 *
 * Searches across open shadow roots so selectors work on sites that use
 * Web Components (YouTube, GitHub, etc.).
 */

import { querySelectorAllDeep } from "./deep-query";

const HIGHLIGHT_ATTR = "data-ba-test-highlight";
const HIGHLIGHT_Z_INDEX = "2147483646";

/** Accent colour for test highlights (distinct from picker blue) */
const TEST_COLOR = "#f59e0b";
const TEST_BG = "rgba(245, 158, 11, 0.12)";
const TEST_OUTLINE = `2px solid ${TEST_COLOR}`;

/** An overlay together with the element it tracks, so it can follow on scroll/resize. */
interface TrackedOverlay {
  el: HTMLDivElement;
  source: Element;
}

/** Overlays currently on screen, paired with their source elements */
let overlays: TrackedOverlay[] = [];

/** Whether the scroll/resize reposition listeners are currently attached */
let viewportListenersAttached = false;

/** Guards against scheduling more than one reposition per animation frame */
let repositionScheduled = false;

/** Style element injected once for the highlight overlays */
let styleEl: HTMLStyleElement | null = null;

function ensureStyle(): void {
  if (styleEl) return;
  styleEl = document.createElement("style");
  styleEl.textContent = `
    [${HIGHLIGHT_ATTR}] {
      position: fixed !important;
      pointer-events: none !important;
      z-index: ${HIGHLIGHT_Z_INDEX} !important;
      box-sizing: border-box !important;
      outline: ${TEST_OUTLINE} !important;
      background: ${TEST_BG} !important;
      border-radius: 2px !important;
      transition: opacity 0.15s ease-out !important;
    }
  `;
  document.documentElement.appendChild(styleEl);
}

function createOverlay(source: Element): HTMLDivElement {
  const div = document.createElement("div");
  div.setAttribute(HIGHLIGHT_ATTR, "");
  positionOverlay(div, source);
  return div;
}

/** Position an overlay over its source element using the current viewport rect. */
function positionOverlay(el: HTMLDivElement, source: Element): void {
  const rect = source.getBoundingClientRect();
  el.style.top = `${String(rect.top)}px`;
  el.style.left = `${String(rect.left)}px`;
  el.style.width = `${String(rect.width)}px`;
  el.style.height = `${String(rect.height)}px`;
}

/**
 * Recompute every overlay from its (fixed-position) source element. Overlays
 * whose source has left the DOM are hidden rather than left frozen on screen.
 */
function repositionOverlays(): void {
  repositionScheduled = false;
  for (const { el, source } of overlays) {
    if (source.isConnected) {
      el.style.display = "";
      positionOverlay(el, source);
    } else {
      el.style.display = "none";
    }
  }
}

/** Coalesce bursts of scroll/resize events into a single rAF-aligned reposition. */
function onViewportChange(): void {
  if (repositionScheduled) return;
  repositionScheduled = true;
  requestAnimationFrame(repositionOverlays);
}

function attachViewportListeners(): void {
  if (viewportListenersAttached) return;
  viewportListenersAttached = true;
  // Capture phase so scrolling inside nested scroll containers is observed too.
  window.addEventListener("scroll", onViewportChange, true);
  window.addEventListener("resize", onViewportChange);
}

function detachViewportListeners(): void {
  if (!viewportListenersAttached) return;
  viewportListenersAttached = false;
  window.removeEventListener("scroll", onViewportChange, true);
  window.removeEventListener("resize", onViewportChange);
}

/**
 * Highlight all elements matching `selector`.
 * Returns the number of matched elements.
 */
export function highlightSelector(selector: string): number {
  clearHighlights();

  if (!selector.trim()) return 0;

  // Search across shadow DOM boundaries
  const matched = querySelectorAllDeep(selector);

  if (matched.length === 0) return 0;

  ensureStyle();

  for (const el of matched) {
    const rect = el.getBoundingClientRect();
    // Skip elements with no visible area
    if (rect.width === 0 && rect.height === 0) continue;
    const overlay = createOverlay(el);
    document.documentElement.appendChild(overlay);
    overlays.push({ el: overlay, source: el });
  }

  if (overlays.length > 0) attachViewportListeners();

  return matched.length;
}

/** Remove all highlight overlays from the page */
export function clearHighlights(): void {
  detachViewportListeners();
  for (const { el } of overlays) {
    el.remove();
  }
  overlays = [];
}
