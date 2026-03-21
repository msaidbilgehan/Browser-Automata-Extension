/**
 * Toast notification system for content scripts.
 *
 * Displays lightweight, non-intrusive toasts on the host page to provide
 * visual feedback when shortcuts fire or actions execute. Follows the same
 * DOM injection pattern as selector-tester.ts (data-attribute scoped styles,
 * fixed positioning, module-level state).
 */

const TOAST_ATTR = "data-ba-toast";
const TOAST_Z_INDEX = "2147483647";

// ─── Theme (matches selector-widget palette) ────────────────────────────────

const BG = "rgba(17, 17, 21, 0.95)";
const BORDER = "rgba(63, 63, 70, 0.6)";
const TEXT_PRIMARY = "#e2e8f0";
const TEXT_SECONDARY = "#94a3b8";
const KBD_BG = "rgba(63, 63, 70, 0.7)";
const KBD_BORDER = "rgba(82, 82, 91, 0.8)";
const CLOSE_HOVER = "rgba(63, 63, 70, 0.5)";

// ─── Module state ───────────────────────────────────────────────────────────

let styleEl: HTMLStyleElement | null = null;
let activeToasts: HTMLDivElement[] = [];
let sessionHidden = false;
let toastEnabled = true;
let toastDismissMode: "delay" | "key_release" = "key_release";
let toastDurationMs = 3000;

// ─── Style injection ────────────────────────────────────────────────────────

function ensureStyle(): void {
  if (styleEl) return;
  styleEl = document.createElement("style");
  styleEl.textContent = `
    [${TOAST_ATTR}] {
      position: fixed !important;
      bottom: 16px !important;
      right: 16px !important;
      z-index: ${TOAST_Z_INDEX} !important;
      pointer-events: auto !important;
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      padding: 8px 12px !important;
      max-width: 360px !important;
      border-radius: 8px !important;
      border: 1px solid ${BORDER} !important;
      background: ${BG} !important;
      color: ${TEXT_PRIMARY} !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 12px !important;
      line-height: 1.4 !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
      animation: ba-toast-in 0.2s ease-out !important;
      transition: opacity 0.15s ease-out, transform 0.15s ease-out !important;
    }
    [${TOAST_ATTR}][data-ba-toast-hiding] {
      opacity: 0 !important;
      transform: translateY(8px) !important;
    }
    [${TOAST_ATTR}] .ba-toast-kbd {
      display: inline-flex !important;
      align-items: center !important;
      gap: 2px !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      border: 1px solid ${KBD_BORDER} !important;
      background: ${KBD_BG} !important;
      color: ${TEXT_PRIMARY} !important;
      font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      white-space: nowrap !important;
    }
    [${TOAST_ATTR}] .ba-toast-action {
      color: ${TEXT_SECONDARY} !important;
      font-size: 12px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    [${TOAST_ATTR}] .ba-toast-close {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 18px !important;
      height: 18px !important;
      border: none !important;
      border-radius: 4px !important;
      background: transparent !important;
      color: ${TEXT_SECONDARY} !important;
      font-size: 14px !important;
      line-height: 1 !important;
      cursor: pointer !important;
      padding: 0 !important;
      margin-left: auto !important;
      flex-shrink: 0 !important;
    }
    [${TOAST_ATTR}] .ba-toast-close:hover {
      background: ${CLOSE_HOVER} !important;
      color: ${TEXT_PRIMARY} !important;
    }
    @keyframes ba-toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.documentElement.appendChild(styleEl);
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function removeToast(el: HTMLDivElement): void {
  const idx = activeToasts.indexOf(el);
  if (idx !== -1) activeToasts.splice(idx, 1);
  // Animate out
  el.setAttribute("data-ba-toast-hiding", "");
  setTimeout(() => {
    el.remove();
    repositionToasts();
  }, 150);
}

function removeAllToasts(): void {
  for (const el of [...activeToasts]) {
    el.remove();
  }
  activeToasts = [];
}

function repositionToasts(): void {
  let offset = 16;
  for (let i = activeToasts.length - 1; i >= 0; i--) {
    const el = activeToasts[i];
    if (el === undefined) continue;
    el.style.bottom = `${String(offset)}px`;
    offset += el.offsetHeight + 8;
  }
}

function createToastElement(content: HTMLElement): HTMLDivElement {
  ensureStyle();

  const toast = document.createElement("div");
  toast.setAttribute(TOAST_ATTR, "");
  toast.appendChild(content);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "ba-toast-close";
  closeBtn.textContent = "\u00d7";
  closeBtn.title = "Hide toasts for this session";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideToastsForSession();
  });
  toast.appendChild(closeBtn);

  document.documentElement.appendChild(toast);
  activeToasts.push(toast);
  repositionToasts();

  return toast;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Initialize toast system — call once from content script entry */
export function initToast(): void {
  // Reset session state (content script re-init on navigation)
  sessionHidden = false;
}

/** Update toast settings (called when settings change via storage listener) */
export function updateToastSettings(
  enabled: boolean,
  dismissMode: "delay" | "key_release",
  durationMs: number,
): void {
  toastEnabled = enabled;
  toastDismissMode = dismissMode;
  toastDurationMs = durationMs;
}

/**
 * Show a key-combo toast: displays the key combo badge + action name.
 *
 * Dismiss behaviour depends on `toastDismissMode`:
 * - `"delay"`: auto-removes after `toastDurationMs`; returns `null` (no keyup handling needed).
 * - `"key_release"`: stays until the caller invokes the returned cleanup function.
 */
export function showKeyToast(keyLabel: string, actionName: string): (() => void) | null {
  if (sessionHidden || !toastEnabled) return null;

  const wrapper = document.createElement("span");
  wrapper.style.cssText = "display:flex !important;align-items:center !important;gap:8px !important;overflow:hidden !important;";

  const kbd = document.createElement("span");
  kbd.className = "ba-toast-kbd";
  kbd.textContent = keyLabel;
  wrapper.appendChild(kbd);

  const label = document.createElement("span");
  label.className = "ba-toast-action";
  label.textContent = actionName;
  wrapper.appendChild(label);

  const toast = createToastElement(wrapper);
  let removed = false;

  if (toastDismissMode === "delay") {
    // Timer-based: auto-dismiss after configured duration; keyup is not involved.
    const duration = Math.max(toastDurationMs, 100);
    setTimeout(() => {
      if (!removed) {
        removed = true;
        removeToast(toast);
      }
    }, duration);

    return null;
  }

  // key_release mode: no timer — caller dismisses via the returned cleanup.
  return () => {
    if (!removed) {
      removed = true;
      removeToast(toast);
    }
  };
}

/** Show a general info toast with a text message */
export function showInfoToast(message: string): void {
  if (sessionHidden || !toastEnabled) return;

  const span = document.createElement("span");
  span.className = "ba-toast-action";
  span.textContent = message;

  const toast = createToastElement(span);

  setTimeout(() => {
    removeToast(toast);
  }, toastDurationMs);
}

/** Hide all toasts for the remainder of this page session */
export function hideToastsForSession(): void {
  sessionHidden = true;
  removeAllToasts();
}
