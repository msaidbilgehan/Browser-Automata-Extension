/**
 * Quick Run floating bar for content scripts.
 *
 * Renders a draggable, toggleable bar of quick-action buttons on the host page.
 * Follows the same DOM injection pattern as toast.ts (data-attribute scoped styles,
 * fixed positioning, module-level state, no shadow DOM).
 */

import type { QuickRunAction, KeyCombo } from "@/shared/types/entities";
import type { Settings } from "@/shared/types/settings";
import { DEFAULT_SETTINGS } from "@/shared/types/settings";

// ─── Constants ──────────────────────────────────────────────────────────────

const BAR_ATTR = "data-ba-quickrun";
const BAR_BTN_ATTR = "data-ba-quickrun-btn";
const BAR_Z_INDEX = "2147483647";

// ─── Theme (matches toast / selector-widget palette) ────────────────────────

const BG = "rgba(17, 17, 21, 0.92)";
const BORDER = "rgba(63, 63, 70, 0.6)";
const TEXT_PRIMARY = "#e2e8f0";
const TEXT_SECONDARY = "#94a3b8";
const BTN_HOVER_BG = "rgba(63, 63, 70, 0.5)";
const ACTIVE_COLOR = "#10b981";

// ─── Inline SVG icons for target types ──────────────────────────────────────

const ICON_SVGS: Record<string, string> = {
  script: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  flow: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
  extraction: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  form_fill: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
};

const DRAG_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;

// ─── Module state ───────────────────────────────────────────────────────────

let styleEl: HTMLStyleElement | null = null;
let barEl: HTMLDivElement | null = null;
let currentActions: QuickRunAction[] = [];
let barVisible = true;
let barEnabled = true;
let toggleShortcut: KeyCombo | null = DEFAULT_SETTINGS.quickRun.toggleShortcut;
let barPosition: string = DEFAULT_SETTINGS.quickRun.barPosition;
let offsetX = 0;
let offsetY = 0;

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartOffsetX = 0;
let dragStartOffsetY = 0;

// ─── Style injection ────────────────────────────────────────────────────────

function ensureStyle(): void {
  if (styleEl) return;
  styleEl = document.createElement("style");
  styleEl.textContent = `
    [${BAR_ATTR}] {
      position: fixed !important;
      z-index: ${BAR_Z_INDEX} !important;
      pointer-events: auto !important;
      display: flex !important;
      align-items: center !important;
      gap: 2px !important;
      padding: 4px 6px !important;
      border-radius: 10px !important;
      border: 1px solid ${BORDER} !important;
      background: ${BG} !important;
      color: ${TEXT_PRIMARY} !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 11px !important;
      line-height: 1 !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
      transition: opacity 0.2s ease-out !important;
      user-select: none !important;
    }
    [${BAR_ATTR}][data-ba-hidden] {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    [${BAR_BTN_ATTR}] {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 28px !important;
      height: 28px !important;
      border: none !important;
      border-radius: 6px !important;
      background: transparent !important;
      color: ${TEXT_SECONDARY} !important;
      cursor: pointer !important;
      padding: 0 !important;
      margin: 0 !important;
      transition: background 0.15s, color 0.15s !important;
    }
    [${BAR_BTN_ATTR}]:hover {
      background: ${BTN_HOVER_BG} !important;
      color: ${TEXT_PRIMARY} !important;
    }
    [${BAR_BTN_ATTR}]:active {
      color: ${ACTIVE_COLOR} !important;
    }
    [${BAR_ATTR}] [data-ba-drag-handle] {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 16px !important;
      height: 28px !important;
      cursor: grab !important;
      color: ${TEXT_SECONDARY} !important;
      opacity: 0.5 !important;
      flex-shrink: 0 !important;
    }
    [${BAR_ATTR}] [data-ba-drag-handle]:active {
      cursor: grabbing !important;
    }
    [${BAR_ATTR}] [data-ba-separator] {
      width: 1px !important;
      height: 18px !important;
      background: ${BORDER} !important;
      margin: 0 2px !important;
      flex-shrink: 0 !important;
    }
  `;
  document.documentElement.appendChild(styleEl);
}

// ─── Position calculation ───────────────────────────────────────────────────

function applyPosition(): void {
  if (!barEl) return;
  const pos = barPosition;

  // Reset all positioning
  barEl.style.removeProperty("top");
  barEl.style.removeProperty("bottom");
  barEl.style.removeProperty("left");
  barEl.style.removeProperty("right");

  if (pos.includes("top")) {
    barEl.style.setProperty("top", `${16 + offsetY}px`, "important");
  } else {
    barEl.style.setProperty("bottom", `${16 - offsetY}px`, "important");
  }
  if (pos.includes("left")) {
    barEl.style.setProperty("left", `${16 + offsetX}px`, "important");
  } else {
    barEl.style.setProperty("right", `${16 - offsetX}px`, "important");
  }
}

// ─── Bar rendering ──────────────────────────────────────────────────────────

function renderBar(): void {
  if (!barEl) return;

  // Clear existing buttons
  barEl.innerHTML = "";

  // Drag handle
  const dragHandle = document.createElement("div");
  dragHandle.setAttribute("data-ba-drag-handle", "");
  dragHandle.innerHTML = DRAG_ICON_SVG;
  dragHandle.addEventListener("mousedown", onDragStart);
  barEl.appendChild(dragHandle);

  if (currentActions.length === 0) {
    barEl.setAttribute("data-ba-hidden", "");
    return;
  }

  if (!barVisible) {
    barEl.setAttribute("data-ba-hidden", "");
    return;
  }

  barEl.removeAttribute("data-ba-hidden");

  // Separator after drag handle
  const sep = document.createElement("div");
  sep.setAttribute("data-ba-separator", "");
  barEl.appendChild(sep);

  // Action buttons
  for (const action of currentActions) {
    const btn = document.createElement("button");
    btn.setAttribute(BAR_BTN_ATTR, "");
    btn.title = action.name;
    btn.innerHTML = ICON_SVGS[action.target.type] ?? ICON_SVGS["script"] ?? "";

    if (action.color) {
      btn.style.setProperty("color", action.color, "important");
    }

    btn.addEventListener("click", () => {
      void executeAction(action.id);
    });

    barEl.appendChild(btn);
  }
}

// ─── Action execution ───────────────────────────────────────────────────────

function executeAction(actionId: string): void {
  try {
    void chrome.runtime.sendMessage({ type: "QUICK_RUN_EXECUTE", actionId });
  } catch {
    // Extension context may be invalidated
  }
}

// ─── Drag handling ──────────────────────────────────────────────────────────

function onDragStart(e: MouseEvent): void {
  e.preventDefault();
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartOffsetX = offsetX;
  dragStartOffsetY = offsetY;
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);
}

function onDragMove(e: MouseEvent): void {
  if (!isDragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  // For right-anchored, moving mouse right means decreasing offset
  if (barPosition.includes("right")) {
    offsetX = dragStartOffsetX - dx;
  } else {
    offsetX = dragStartOffsetX + dx;
  }

  // For bottom-anchored, moving mouse down means decreasing offset
  if (barPosition.includes("bottom")) {
    offsetY = dragStartOffsetY - dy;
  } else {
    offsetY = dragStartOffsetY + dy;
  }

  applyPosition();
}

function onDragEnd(): void {
  isDragging = false;
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragEnd);

  // Persist position to sync storage
  try {
    void chrome.storage.sync.get("settings", (result: Record<string, unknown>) => {
      const stored = result["settings"] as Partial<Settings> | undefined;
      const quickRun = { ...DEFAULT_SETTINGS.quickRun, ...stored?.quickRun };
      quickRun.barOffsetX = offsetX;
      quickRun.barOffsetY = offsetY;
      void chrome.storage.sync.set({
        settings: { ...stored, quickRun },
      });
    });
  } catch {
    // Extension context may be invalidated
  }
}

// ─── Keyboard toggle ────────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent): void {
  if (!toggleShortcut) return;
  if (e.repeat) return;

  // Check if the key combo matches the toggle shortcut
  if (
    e.key.toLowerCase() === toggleShortcut.key.toLowerCase() &&
    e.ctrlKey === toggleShortcut.ctrlKey &&
    e.shiftKey === toggleShortcut.shiftKey &&
    e.altKey === toggleShortcut.altKey &&
    e.metaKey === toggleShortcut.metaKey
  ) {
    e.preventDefault();
    e.stopPropagation();
    barVisible = !barVisible;
    renderBar();
  }
}

// ─── Settings sync ──────────────────────────────────────────────────────────

function applyQuickRunSettings(quickRun: Settings["quickRun"]): void {
  barEnabled = quickRun.barEnabled;
  toggleShortcut = quickRun.toggleShortcut;
  barPosition = quickRun.barPosition;
  offsetX = quickRun.barOffsetX;
  offsetY = quickRun.barOffsetY;

  if (!barEnabled && barEl) {
    barEl.setAttribute("data-ba-hidden", "");
  } else if (barEnabled && barEl) {
    applyPosition();
    renderBar();
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize the quick run bar. Called once from content/index.ts.
 */
export function initQuickRunBar(): void {
  ensureStyle();

  barEl = document.createElement("div");
  barEl.setAttribute(BAR_ATTR, "");
  barEl.setAttribute("data-ba-hidden", ""); // hidden until actions arrive
  document.documentElement.appendChild(barEl);

  // Listen for toggle shortcut
  document.addEventListener("keydown", onKeyDown, true);

  // Load settings
  try {
    chrome.storage.sync.get("settings", (result: Record<string, unknown>) => {
      const stored = result["settings"] as Partial<Settings> | undefined;
      const quickRun = { ...DEFAULT_SETTINGS.quickRun, ...stored?.quickRun };
      applyQuickRunSettings(quickRun);
    });

    // Listen for settings changes
    chrome.storage.onChanged.addListener(
      (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName !== "sync") return;
        const settingsChange = changes["settings"];
        if (settingsChange?.newValue !== undefined) {
          const stored = settingsChange.newValue as Partial<Settings>;
          const quickRun = { ...DEFAULT_SETTINGS.quickRun, ...stored.quickRun };
          applyQuickRunSettings(quickRun);
        }
      },
    );
  } catch {
    // Extension context may be invalidated
  }

  applyPosition();
}

/**
 * Update the list of quick run actions shown in the bar.
 * Called when UPDATE_QUICK_RUN_ACTIONS message is received.
 */
export function setQuickRunActions(actions: QuickRunAction[]): void {
  currentActions = actions;
  renderBar();
}
