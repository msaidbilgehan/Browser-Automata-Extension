/**
 * Action element highlight — briefly flash-highlights a DOM element
 * when a shortcut action targets it (click/focus).
 *
 * Uses the same overlay pattern as selector-tester.ts: fixed-position
 * overlay divs scoped by a data attribute, one-time style injection.
 * Green color (#10b981) to visually distinguish from the amber
 * selector-test highlights.
 */

const HIGHLIGHT_ATTR = "data-ba-action-highlight";
const HIGHLIGHT_Z_INDEX = "2147483646";

const COLOR = "#10b981";
const BG = "rgba(16, 185, 129, 0.15)";

let styleEl: HTMLStyleElement | null = null;
let highlightEnabled = true;

function ensureStyle(): void {
  if (styleEl) return;
  styleEl = document.createElement("style");
  styleEl.textContent = `
    [${HIGHLIGHT_ATTR}] {
      position: fixed !important;
      pointer-events: none !important;
      z-index: ${HIGHLIGHT_Z_INDEX} !important;
      box-sizing: border-box !important;
      outline: 2px solid ${COLOR} !important;
      background: ${BG} !important;
      border-radius: 3px !important;
      transition: opacity 0.2s ease-out !important;
    }
  `;
  document.documentElement.appendChild(styleEl);
}

/** Update highlight settings (called when settings change via storage listener) */
export function updateHighlightSettings(enabled: boolean): void {
  highlightEnabled = enabled;
}

/** Position an overlay over its source element using the current viewport rect. */
function positionOverlay(overlay: HTMLDivElement, element: Element): void {
  const rect = element.getBoundingClientRect();
  overlay.style.top = `${String(rect.top)}px`;
  overlay.style.left = `${String(rect.left)}px`;
  overlay.style.width = `${String(rect.width)}px`;
  overlay.style.height = `${String(rect.height)}px`;
}

/** Flash-highlight an element briefly (~600ms total, fades out in the last 200ms) */
export function flashHighlight(element: Element): void {
  if (!highlightEnabled) return;

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  ensureStyle();

  const overlay = document.createElement("div");
  overlay.setAttribute(HIGHLIGHT_ATTR, "");
  positionOverlay(overlay, element);
  overlay.style.opacity = "1";

  document.documentElement.appendChild(overlay);

  // The fixed-position overlay would drift off its target if the user scrolls
  // during the flash — keep it aligned until it is removed.
  const onViewportChange = (): void => {
    positionOverlay(overlay, element);
  };
  window.addEventListener("scroll", onViewportChange, true);
  window.addEventListener("resize", onViewportChange);

  // Start fading out after 400ms
  setTimeout(() => {
    overlay.style.opacity = "0";
  }, 400);

  // Remove from DOM after fade completes
  setTimeout(() => {
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
    overlay.remove();
  }, 600);
}
