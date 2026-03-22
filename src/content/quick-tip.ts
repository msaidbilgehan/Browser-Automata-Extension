/**
 * Quick Tip overlay for content scripts.
 *
 * Shows a brief, auto-dismissing tooltip listing the active keyboard shortcuts
 * for the current page. Appears on page load and fades out after a configurable
 * timeout. Follows the same DOM injection pattern as toast.ts and quick-run-bar.ts
 * (data-attribute scoped styles, fixed positioning, no shadow DOM).
 */

import type { Shortcut, KeyCombo, ChordCombo } from "@/shared/types/entities";
import type { Settings } from "@/shared/types/settings";
import { DEFAULT_SETTINGS } from "@/shared/types/settings";

// ─── Constants ──────────────────────────────────────────────────────────────

const TIP_ATTR = "data-ba-quicktip";
const TIP_Z_INDEX = "2147483646";

// ─── Theme (matches toast / quick-run-bar palette) ──────────────────────────

const BG = "rgba(17, 17, 21, 0.92)";
const BORDER = "rgba(63, 63, 70, 0.6)";
const TEXT_PRIMARY = "#e2e8f0";
const TEXT_SECONDARY = "#94a3b8";
const KEY_BG = "rgba(63, 63, 70, 0.5)";
const KEY_BORDER = "rgba(82, 82, 91, 0.6)";

// ─── Module state ───────────────────────────────────────────────────────────

let styleEl: HTMLStyleElement | null = null;
let tipEl: HTMLDivElement | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let tipEnabled = DEFAULT_SETTINGS.quickTip.enabled;
let tipTimeoutMs = DEFAULT_SETTINGS.quickTip.timeoutMs;

// ─── Key combo formatting (content-script-safe, no React deps) ──────────────

function isKeyCombo(combo: KeyCombo | ChordCombo): combo is KeyCombo {
  return "key" in combo && !("sequence" in combo);
}

function formatCombo(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.ctrlKey) parts.push("Ctrl");
  if (combo.altKey) parts.push("Alt");
  if (combo.shiftKey) parts.push("Shift");
  if (combo.metaKey) parts.push("Cmd");
  let key = combo.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join(" + ");
}

function formatShortcutKeys(shortcut: Shortcut): string {
  if (isKeyCombo(shortcut.keyCombo)) {
    return formatCombo(shortcut.keyCombo);
  }
  // Chord: join sequence with " → "
  return shortcut.keyCombo.sequence.map(formatCombo).join(" \u2192 ");
}

// ─── Style injection ────────────────────────────────────────────────────────

function ensureStyle(): void {
  if (styleEl) return;
  styleEl = document.createElement("style");
  styleEl.textContent = `
    [${TIP_ATTR}] {
      position: fixed !important;
      top: 12px !important;
      right: 12px !important;
      z-index: ${TIP_Z_INDEX} !important;
      pointer-events: auto !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 6px !important;
      padding: 10px 14px !important;
      border-radius: 10px !important;
      border: 1px solid ${BORDER} !important;
      background: ${BG} !important;
      color: ${TEXT_PRIMARY} !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 11px !important;
      line-height: 1.4 !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.45) !important;
      max-width: 320px !important;
      opacity: 0 !important;
      transform: translateY(-8px) !important;
      transition: opacity 0.25s ease-out, transform 0.25s ease-out !important;
      user-select: none !important;
    }
    [${TIP_ATTR}][data-ba-visible] {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
    [${TIP_ATTR}] [data-ba-tip-title] {
      font-size: 10px !important;
      font-weight: 600 !important;
      color: ${TEXT_SECONDARY} !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    [${TIP_ATTR}] [data-ba-tip-row] {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    [${TIP_ATTR}] [data-ba-tip-keys] {
      display: inline-flex !important;
      gap: 3px !important;
      flex-shrink: 0 !important;
    }
    [${TIP_ATTR}] [data-ba-tip-key] {
      display: inline-block !important;
      padding: 1px 5px !important;
      border-radius: 4px !important;
      border: 1px solid ${KEY_BORDER} !important;
      background: ${KEY_BG} !important;
      color: ${TEXT_PRIMARY} !important;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      line-height: 1.5 !important;
      white-space: nowrap !important;
    }
    [${TIP_ATTR}] [data-ba-tip-name] {
      color: ${TEXT_SECONDARY} !important;
      font-size: 11px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    [${TIP_ATTR}] [data-ba-tip-close] {
      position: absolute !important;
      top: 6px !important;
      right: 8px !important;
      background: none !important;
      border: none !important;
      color: ${TEXT_SECONDARY} !important;
      cursor: pointer !important;
      font-size: 13px !important;
      line-height: 1 !important;
      padding: 2px !important;
      opacity: 0.6 !important;
      transition: opacity 0.15s !important;
    }
    [${TIP_ATTR}] [data-ba-tip-close]:hover {
      opacity: 1 !important;
    }
  `;
  document.documentElement.appendChild(styleEl);
}

// ─── Rendering ──────────────────────────────────────────────────────────────

function renderKeyBadges(keysStr: string): string {
  return keysStr
    .split(" + ")
    .map((k) => `<span data-ba-tip-key>${escapeHtml(k)}</span>`)
    .join("");
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function show(shortcuts: Shortcut[]): void {
  if (!tipEnabled) return;
  if (shortcuts.length === 0) return;
  if (!tipEl) return;

  // Clear previous content and dismiss timer
  dismiss();
  tipEl.innerHTML = "";

  // Title
  const title = document.createElement("div");
  title.setAttribute("data-ba-tip-title", "");
  title.textContent = "Active Shortcuts";
  tipEl.appendChild(title);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("data-ba-tip-close", "");
  closeBtn.textContent = "\u00d7";
  closeBtn.addEventListener("click", dismiss);
  tipEl.appendChild(closeBtn);

  // Shortcut rows (limit to 8 to avoid overflow)
  const displayed = shortcuts.slice(0, 8);
  for (const shortcut of displayed) {
    const row = document.createElement("div");
    row.setAttribute("data-ba-tip-row", "");

    const keys = document.createElement("span");
    keys.setAttribute("data-ba-tip-keys", "");
    keys.innerHTML = renderKeyBadges(formatShortcutKeys(shortcut));
    row.appendChild(keys);

    const name = document.createElement("span");
    name.setAttribute("data-ba-tip-name", "");
    name.textContent = shortcut.name || shortcut.action.type;
    row.appendChild(name);

    tipEl.appendChild(row);
  }

  if (shortcuts.length > 8) {
    const more = document.createElement("div");
    more.setAttribute("data-ba-tip-name", "");
    more.textContent = `+${String(shortcuts.length - 8)} more`;
    tipEl.appendChild(more);
  }

  // Trigger entrance animation on next frame
  requestAnimationFrame(() => {
    tipEl?.setAttribute("data-ba-visible", "");
  });

  // Schedule auto-dismiss
  if (tipTimeoutMs > 0) {
    dismissTimer = setTimeout(dismiss, tipTimeoutMs);
  }
}

function dismiss(): void {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  if (tipEl) {
    tipEl.removeAttribute("data-ba-visible");
  }
}

// ─── Settings sync ──────────────────────────────────────────────────────────

function applyQuickTipSettings(quickTip: Settings["quickTip"]): void {
  tipEnabled = quickTip.enabled;
  tipTimeoutMs = quickTip.timeoutMs;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize the quick tip overlay. Called once from content/index.ts.
 */
export function initQuickTip(): void {
  ensureStyle();

  tipEl = document.createElement("div");
  tipEl.setAttribute(TIP_ATTR, "");
  document.documentElement.appendChild(tipEl);

  // Load settings
  try {
    chrome.storage.sync.get("settings", (result: Record<string, unknown>) => {
      const stored = result["settings"] as Partial<Settings> | undefined;
      const quickTip = { ...DEFAULT_SETTINGS.quickTip, ...stored?.quickTip };
      applyQuickTipSettings(quickTip);
    });

    chrome.storage.onChanged.addListener(
      (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName !== "sync") return;
        const settingsChange = changes["settings"];
        if (settingsChange?.newValue !== undefined) {
          const stored = settingsChange.newValue as Partial<Settings>;
          const quickTip = { ...DEFAULT_SETTINGS.quickTip, ...stored.quickTip };
          applyQuickTipSettings(quickTip);
        }
      },
    );
  } catch {
    // Extension context may be invalidated
  }
}

/**
 * Show the quick tip overlay with matching shortcuts.
 * Called when UPDATE_QUICK_TIP_SHORTCUTS message is received.
 */
export function showQuickTipShortcuts(shortcuts: Shortcut[]): void {
  show(shortcuts);
}
