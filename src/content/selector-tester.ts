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

/** Overlay elements currently on screen */
let overlays: HTMLDivElement[] = [];

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

function createOverlay(rect: DOMRect): HTMLDivElement {
  const div = document.createElement("div");
  div.setAttribute(HIGHLIGHT_ATTR, "");
  div.style.top = `${String(rect.top)}px`;
  div.style.left = `${String(rect.left)}px`;
  div.style.width = `${String(rect.width)}px`;
  div.style.height = `${String(rect.height)}px`;
  return div;
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
    const overlay = createOverlay(rect);
    document.documentElement.appendChild(overlay);
    overlays.push(overlay);
  }

  return matched.length;
}

/** Remove all highlight overlays from the page */
export function clearHighlights(): void {
  for (const el of overlays) {
    el.remove();
  }
  overlays = [];
}
