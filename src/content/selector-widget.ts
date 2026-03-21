/**
 * Live Selector Test Widget — an on-page floating panel that lets the user
 * edit, explore, and live-test CSS selectors before applying them.
 *
 * Shown after the element picker click instead of the bare alternatives panel.
 * Features:
 *   - Editable selector input with live match count
 *   - Depth slider to control ancestor chain length
 *   - Suggested alternatives list with strategy badges
 *   - Real-time highlight of matched elements on the page
 *   - Apply / Cancel buttons
 */

import { highlightSelector, clearHighlights } from "./selector-tester";

// ─── Types (duplicated from entities — content scripts are isolated) ─────────

type SelectorStrategy =
  | "id"
  | "data-attr"
  | "aria"
  | "attribute"
  | "class"
  | "ancestor"
  | "nth-child"
  | "xpath-text"
  | "xpath-attr";

interface SelectorAlternative {
  selector: string;
  strategy: SelectorStrategy;
  isXPath: boolean;
  matchCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WIDGET_Z_INDEX = "2147483647";

const STRATEGY_LABELS: Record<SelectorStrategy, string> = {
  "id": "ID",
  "data-attr": "Data",
  "aria": "Aria",
  "attribute": "Attr",
  "class": "Class",
  "ancestor": "Path",
  "nth-child": "Nth",
  "xpath-text": "XPath",
  "xpath-attr": "XPath",
};

const STRATEGY_BADGE_COLORS: Record<SelectorStrategy, { bg: string; text: string }> = {
  "id": { bg: "rgba(16,185,129,0.2)", text: "#34d399" },
  "data-attr": { bg: "rgba(59,130,246,0.2)", text: "#60a5fa" },
  "aria": { bg: "rgba(139,92,246,0.2)", text: "#a78bfa" },
  "attribute": { bg: "rgba(245,158,11,0.2)", text: "#fbbf24" },
  "class": { bg: "rgba(14,165,233,0.2)", text: "#38bdf8" },
  "ancestor": { bg: "rgba(100,116,139,0.2)", text: "#94a3b8" },
  "nth-child": { bg: "rgba(100,116,139,0.2)", text: "#94a3b8" },
  "xpath-text": { bg: "rgba(244,63,94,0.2)", text: "#fb7185" },
  "xpath-attr": { bg: "rgba(244,63,94,0.2)", text: "#fb7185" },
};

const ACCENT = "#3b82f6";
const PANEL_BG = "rgba(17, 17, 21, 0.97)";
const PANEL_BORDER = "rgba(63, 63, 70, 0.6)";
const INPUT_BG = "rgba(39, 39, 42, 0.9)";
const INPUT_BORDER = "rgba(63, 63, 70, 0.8)";
const TEXT_PRIMARY = "#e2e8f0";
const TEXT_SECONDARY = "#94a3b8";
const TEXT_MUTED = "#71717a";

// ─── Widget state ────────────────────────────────────────────────────────────

let widgetEl: HTMLDivElement | null = null;
let inputEl: HTMLInputElement | null = null;
let matchBadgeEl: HTMLSpanElement | null = null;
let depthLabelEl: HTMLSpanElement | null = null;
let altListEl: HTMLDivElement | null = null;
let isOpen = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/** Current state exposed for the picker integration */
let currentSelector = "";
let currentDepth = 3;
let currentAlternatives: SelectorAlternative[] = [];
let targetElement: Element | null = null;

/** Callbacks provided by the caller (element-picker) */
let onApplyCallback: ((selector: string, alternatives: SelectorAlternative[]) => void) | null = null;
let onCancelCallback: (() => void) | null = null;

/** External generator — injected at open time to avoid circular deps */
let generateAlternativesFn:
  | ((el: Element, maxDepth: number) => SelectorAlternative[])
  | null = null;

// ─── Shared style helpers ────────────────────────────────────────────────────

function setCommonTextStyle(el: HTMLElement, size: string, color: string): void {
  el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  el.style.fontSize = size;
  el.style.color = color;
}

function setCommonButtonStyle(btn: HTMLButtonElement): void {
  btn.style.border = "none";
  btn.style.borderRadius = "6px";
  btn.style.padding = "6px 16px";
  btn.style.fontSize = "12px";
  btn.style.fontWeight = "600";
  btn.style.fontFamily = "system-ui, -apple-system, sans-serif";
  btn.style.cursor = "pointer";
  btn.style.transition = "background 0.15s, opacity 0.15s";
  btn.style.outline = "none";
}

// ─── Live highlight ──────────────────────────────────────────────────────────

function liveTest(selector: string): void {
  if (debounceTimer !== undefined) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!selector.trim()) {
      clearHighlights();
      updateMatchBadge(0);
      return;
    }
    const count = highlightSelector(selector);
    updateMatchBadge(count);
  }, 120);
}

function updateMatchBadge(count: number): void {
  if (matchBadgeEl === null) return;
  matchBadgeEl.textContent = String(count);
  if (count === 0) {
    matchBadgeEl.style.backgroundColor = "rgba(244,63,94,0.15)";
    matchBadgeEl.style.color = "#fb7185";
  } else if (count === 1) {
    matchBadgeEl.style.backgroundColor = "rgba(16,185,129,0.15)";
    matchBadgeEl.style.color = "#34d399";
  } else {
    matchBadgeEl.style.backgroundColor = "rgba(245,158,11,0.15)";
    matchBadgeEl.style.color = "#fbbf24";
  }
}

// ─── Depth control ───────────────────────────────────────────────────────────

function regenerateAlternatives(): void {
  if (targetElement === null || generateAlternativesFn === null) return;
  currentAlternatives = generateAlternativesFn(targetElement, currentDepth);
  renderAlternativesList();
  // Re-test the current selector
  liveTest(currentSelector);
}

function onDepthChange(newDepth: number): void {
  currentDepth = Math.max(1, Math.min(6, newDepth));
  if (depthLabelEl !== null) {
    depthLabelEl.textContent = String(currentDepth);
  }
  regenerateAlternatives();
}

// ─── Input handling ──────────────────────────────────────────────────────────

function onSelectorInput(value: string): void {
  currentSelector = value;
  liveTest(value);
  // Deselect any active alternative row
  deselectAllRows();
}

// ─── Alternatives list ───────────────────────────────────────────────────────

function deselectAllRows(): void {
  if (altListEl === null) return;
  const rows = altListEl.querySelectorAll<HTMLButtonElement>("[data-ba-widget-alt]");
  for (const row of rows) {
    row.style.background = "transparent";
    const check = row.querySelector<HTMLSpanElement>("[data-ba-widget-check]");
    if (check !== null) check.textContent = "";
  }
}

function selectRow(index: number): void {
  const alt = currentAlternatives[index];
  if (alt === undefined) return;

  currentSelector = alt.selector;
  if (inputEl !== null) inputEl.value = alt.selector;
  liveTest(alt.selector);

  // Update visual selection
  deselectAllRows();
  if (altListEl === null) return;
  const row = altListEl.querySelector<HTMLButtonElement>(`[data-ba-widget-alt="${String(index)}"]`);
  if (row !== null) {
    row.style.background = "rgba(59,130,246,0.12)";
    const check = row.querySelector<HTMLSpanElement>("[data-ba-widget-check]");
    if (check !== null) check.textContent = "\u2713";
  }
}

function createAlternativeRow(alt: SelectorAlternative, index: number): HTMLButtonElement {
  const row = document.createElement("button");
  row.type = "button";
  row.setAttribute("data-ba-widget-alt", String(index));
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "6px";
  row.style.width = "100%";
  row.style.padding = "5px 8px";
  row.style.border = "none";
  row.style.borderRadius = "4px";
  row.style.background = "transparent";
  row.style.cursor = "pointer";
  row.style.textAlign = "left";
  row.style.outline = "none";
  row.style.transition = "background 0.1s";

  // Check indicator
  const check = document.createElement("span");
  check.setAttribute("data-ba-widget-check", "");
  check.style.width = "12px";
  check.style.flexShrink = "0";
  check.style.fontSize = "10px";
  check.style.color = ACCENT;
  check.style.textAlign = "center";
  check.textContent = "";
  row.appendChild(check);

  // Strategy badge
  const colors = STRATEGY_BADGE_COLORS[alt.strategy];
  const badge = document.createElement("span");
  badge.style.flexShrink = "0";
  badge.style.padding = "2px 5px";
  badge.style.borderRadius = "3px";
  badge.style.fontSize = "9px";
  badge.style.fontWeight = "700";
  badge.style.fontFamily = "system-ui, -apple-system, sans-serif";
  badge.style.textTransform = "uppercase";
  badge.style.letterSpacing = "0.4px";
  badge.style.backgroundColor = colors.bg;
  badge.style.color = colors.text;
  badge.textContent = STRATEGY_LABELS[alt.strategy];
  row.appendChild(badge);

  // Selector text
  const selectorSpan = document.createElement("span");
  selectorSpan.style.flex = "1";
  selectorSpan.style.minWidth = "0";
  selectorSpan.style.overflow = "hidden";
  selectorSpan.style.textOverflow = "ellipsis";
  selectorSpan.style.whiteSpace = "nowrap";
  setCommonTextStyle(selectorSpan, "10px", TEXT_PRIMARY);
  selectorSpan.textContent = alt.selector;
  selectorSpan.title = alt.selector;
  row.appendChild(selectorSpan);

  // Match count
  const count = document.createElement("span");
  count.style.flexShrink = "0";
  count.style.fontSize = "9px";
  count.style.fontWeight = "500";
  count.style.fontFamily = "system-ui, -apple-system, sans-serif";
  count.style.color = alt.matchCount === 1 ? "#34d399" : "#fbbf24";
  count.textContent = alt.matchCount === 1 ? "1" : String(alt.matchCount);
  row.appendChild(count);

  // Hover
  row.addEventListener("mouseenter", () => {
    if (row.style.background !== "rgba(59,130,246,0.12)") {
      row.style.background = "rgba(255,255,255,0.04)";
    }
  });
  row.addEventListener("mouseleave", () => {
    if (row.style.background === "rgba(255,255,255,0.04)") {
      row.style.background = "transparent";
    }
  });

  // Click
  row.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectRow(index);
  });

  return row;
}

function renderAlternativesList(): void {
  if (altListEl === null) return;
  altListEl.innerHTML = "";

  if (currentAlternatives.length === 0) {
    const empty = document.createElement("div");
    empty.style.padding = "12px 8px";
    empty.style.textAlign = "center";
    empty.style.fontSize = "11px";
    empty.style.color = TEXT_MUTED;
    empty.textContent = "No alternatives at this depth";
    altListEl.appendChild(empty);
    return;
  }

  for (let i = 0; i < currentAlternatives.length; i++) {
    const alt = currentAlternatives[i];
    if (alt === undefined) continue;
    altListEl.appendChild(createAlternativeRow(alt, i));
  }
}

// ─── Widget DOM construction ─────────────────────────────────────────────────

function buildWidget(): HTMLDivElement {
  const widget = document.createElement("div");
  widget.setAttribute("data-ba-selector-widget", "");
  widget.style.position = "fixed";
  widget.style.zIndex = WIDGET_Z_INDEX;
  widget.style.backgroundColor = PANEL_BG;
  widget.style.border = `1px solid ${PANEL_BORDER}`;
  widget.style.borderRadius = "10px";
  widget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset";
  widget.style.width = "380px";
  widget.style.maxHeight = "480px";
  widget.style.display = "flex";
  widget.style.flexDirection = "column";
  widget.style.overflow = "hidden";
  widget.style.pointerEvents = "auto";
  widget.style.fontFamily = "system-ui, -apple-system, sans-serif";
  widget.style.userSelect = "none";

  // ── Header ──────────────────────────────────────────────────────────────
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "10px 14px 8px";
  header.style.borderBottom = `1px solid ${PANEL_BORDER}`;

  const titleRow = document.createElement("div");
  titleRow.style.display = "flex";
  titleRow.style.alignItems = "center";
  titleRow.style.gap = "6px";

  const icon = document.createElement("span");
  icon.style.fontSize = "13px";
  icon.textContent = "\uD83C\uDFAF";
  titleRow.appendChild(icon);

  const title = document.createElement("span");
  title.style.fontSize = "12px";
  title.style.fontWeight = "700";
  title.style.color = TEXT_PRIMARY;
  title.style.letterSpacing = "0.2px";
  title.textContent = "Selector Tester";
  titleRow.appendChild(title);

  header.appendChild(titleRow);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.style.background = "none";
  closeBtn.style.border = "none";
  closeBtn.style.color = TEXT_MUTED;
  closeBtn.style.cursor = "pointer";
  closeBtn.style.padding = "2px 4px";
  closeBtn.style.fontSize = "14px";
  closeBtn.style.lineHeight = "1";
  closeBtn.style.borderRadius = "4px";
  closeBtn.style.transition = "color 0.1s";
  closeBtn.textContent = "\u2715";
  closeBtn.title = "Cancel (Esc)";
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.color = "#fb7185";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.color = TEXT_MUTED;
  });
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleCancel();
  });
  header.appendChild(closeBtn);

  widget.appendChild(header);

  // ── Body ────────────────────────────────────────────────────────────────
  const body = document.createElement("div");
  body.style.padding = "10px 14px";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "10px";
  body.style.overflow = "hidden";

  // ── Selector input row ──────────────────────────────────────────────────
  const inputRow = document.createElement("div");
  inputRow.style.display = "flex";
  inputRow.style.alignItems = "center";
  inputRow.style.gap = "6px";

  const inputLabel = document.createElement("label");
  inputLabel.style.fontSize = "10px";
  inputLabel.style.fontWeight = "600";
  inputLabel.style.color = TEXT_SECONDARY;
  inputLabel.style.textTransform = "uppercase";
  inputLabel.style.letterSpacing = "0.6px";
  inputLabel.style.flexShrink = "0";
  inputLabel.textContent = "Selector";
  inputRow.appendChild(inputLabel);

  inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.spellcheck = false;
  inputEl.autocomplete = "off";
  inputEl.style.flex = "1";
  inputEl.style.minWidth = "0";
  inputEl.style.padding = "6px 8px";
  inputEl.style.backgroundColor = INPUT_BG;
  inputEl.style.border = `1px solid ${INPUT_BORDER}`;
  inputEl.style.borderRadius = "5px";
  inputEl.style.outline = "none";
  inputEl.style.transition = "border-color 0.15s";
  setCommonTextStyle(inputEl, "11px", TEXT_PRIMARY);
  inputEl.addEventListener("focus", () => {
    if (inputEl !== null) inputEl.style.borderColor = ACCENT;
  });
  inputEl.addEventListener("blur", () => {
    if (inputEl !== null) inputEl.style.borderColor = INPUT_BORDER;
  });
  inputEl.addEventListener("input", () => {
    if (inputEl !== null) onSelectorInput(inputEl.value);
  });
  // Prevent picker key events from interfering
  inputEl.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  });
  inputRow.appendChild(inputEl);

  // Match badge
  matchBadgeEl = document.createElement("span");
  matchBadgeEl.style.flexShrink = "0";
  matchBadgeEl.style.minWidth = "22px";
  matchBadgeEl.style.textAlign = "center";
  matchBadgeEl.style.padding = "3px 6px";
  matchBadgeEl.style.borderRadius = "10px";
  matchBadgeEl.style.fontSize = "10px";
  matchBadgeEl.style.fontWeight = "700";
  matchBadgeEl.style.fontFamily = "system-ui, -apple-system, sans-serif";
  matchBadgeEl.textContent = "0";
  matchBadgeEl.title = "Number of matching elements";
  updateMatchBadge(0);
  inputRow.appendChild(matchBadgeEl);

  body.appendChild(inputRow);

  // ── Depth slider row ────────────────────────────────────────────────────
  const depthRow = document.createElement("div");
  depthRow.style.display = "flex";
  depthRow.style.alignItems = "center";
  depthRow.style.gap = "8px";

  const depthLabel = document.createElement("span");
  depthLabel.style.fontSize = "10px";
  depthLabel.style.fontWeight = "600";
  depthLabel.style.color = TEXT_SECONDARY;
  depthLabel.style.textTransform = "uppercase";
  depthLabel.style.letterSpacing = "0.6px";
  depthLabel.style.flexShrink = "0";
  depthLabel.textContent = "Depth";
  depthRow.appendChild(depthLabel);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "1";
  slider.max = "6";
  slider.step = "1";
  slider.value = String(currentDepth);
  slider.style.flex = "1";
  slider.style.height = "4px";
  slider.style.cursor = "pointer";
  slider.style.accentColor = ACCENT;
  slider.style.outline = "none";
  slider.addEventListener("input", () => {
    onDepthChange(Number(slider.value));
  });
  // Prevent picker keydown from firing
  slider.addEventListener("keydown", (e) => {
    e.stopPropagation();
  });
  depthRow.appendChild(slider);

  depthLabelEl = document.createElement("span");
  depthLabelEl.style.flexShrink = "0";
  depthLabelEl.style.minWidth = "16px";
  depthLabelEl.style.textAlign = "center";
  depthLabelEl.style.fontSize = "11px";
  depthLabelEl.style.fontWeight = "700";
  depthLabelEl.style.color = ACCENT;
  depthLabelEl.textContent = String(currentDepth);
  depthRow.appendChild(depthLabelEl);

  body.appendChild(depthRow);

  // ── Alternatives section ────────────────────────────────────────────────
  const altHeader = document.createElement("div");
  altHeader.style.fontSize = "10px";
  altHeader.style.fontWeight = "600";
  altHeader.style.textTransform = "uppercase";
  altHeader.style.letterSpacing = "0.6px";
  altHeader.style.color = TEXT_MUTED;
  altHeader.textContent = "Suggested Alternatives";
  body.appendChild(altHeader);

  altListEl = document.createElement("div");
  altListEl.style.maxHeight = "200px";
  altListEl.style.overflowY = "auto";
  altListEl.style.overflowX = "hidden";
  altListEl.style.borderRadius = "6px";
  altListEl.style.border = `1px solid ${PANEL_BORDER}`;
  altListEl.style.backgroundColor = "rgba(0,0,0,0.2)";
  altListEl.style.padding = "3px";
  // Custom scrollbar for the list (webkit)
  altListEl.style.scrollbarWidth = "thin";
  altListEl.style.scrollbarColor = `${TEXT_MUTED} transparent`;
  body.appendChild(altListEl);

  widget.appendChild(body);

  // ── Footer (actions) ────────────────────────────────────────────────────
  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.alignItems = "center";
  footer.style.justifyContent = "flex-end";
  footer.style.gap = "8px";
  footer.style.padding = "8px 14px 12px";
  footer.style.borderTop = `1px solid ${PANEL_BORDER}`;

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  setCommonButtonStyle(cancelBtn);
  cancelBtn.style.backgroundColor = "rgba(63,63,70,0.5)";
  cancelBtn.style.color = TEXT_SECONDARY;
  cancelBtn.addEventListener("mouseenter", () => {
    cancelBtn.style.backgroundColor = "rgba(63,63,70,0.8)";
  });
  cancelBtn.addEventListener("mouseleave", () => {
    cancelBtn.style.backgroundColor = "rgba(63,63,70,0.5)";
  });
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleCancel();
  });
  footer.appendChild(cancelBtn);

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.textContent = "Apply";
  setCommonButtonStyle(applyBtn);
  applyBtn.style.backgroundColor = ACCENT;
  applyBtn.style.color = "#fff";
  applyBtn.addEventListener("mouseenter", () => {
    applyBtn.style.backgroundColor = "#2563eb";
  });
  applyBtn.addEventListener("mouseleave", () => {
    applyBtn.style.backgroundColor = ACCENT;
  });
  applyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleApply();
  });
  footer.appendChild(applyBtn);

  widget.appendChild(footer);

  // ── Make widget draggable via header ────────────────────────────────────
  makeDraggable(widget, header);

  // ── Stop events from leaking to the page (bubble phase only, so child
  //    handlers in the capture/target phases still fire normally) ──────────
  widget.addEventListener("click", (e) => { e.stopPropagation(); });
  widget.addEventListener("mousedown", (e) => { e.stopPropagation(); });

  return widget;
}

// ─── Draggable ───────────────────────────────────────────────────────────────

/** Registered document-level handlers — stored for cleanup on close */
let dragMoveHandler: ((e: MouseEvent) => void) | null = null;
let dragUpHandler: (() => void) | null = null;

function makeDraggable(widget: HTMLDivElement, handle: HTMLDivElement): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  handle.style.cursor = "grab";

  handle.addEventListener("mousedown", (e) => {
    // Only left button, and only if the target is the handle itself (not child buttons)
    if (e.button !== 0) return;
    const target = e.target as Node;
    if (target !== handle && target.parentNode !== handle) {
      // Click on a deeply nested child (e.g. close button) — don't start drag
      const closestBtn = (target as Element).closest("button");
      if (closestBtn !== null) return;
    }
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origLeft = widget.offsetLeft;
    origTop = widget.offsetTop;
    handle.style.cursor = "grabbing";
    e.preventDefault();
  });

  dragMoveHandler = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    widget.style.left = `${String(origLeft + dx)}px`;
    widget.style.top = `${String(origTop + dy)}px`;
  };

  dragUpHandler = () => {
    if (!isDragging) return;
    isDragging = false;
    handle.style.cursor = "grab";
  };

  document.addEventListener("mousemove", dragMoveHandler);
  document.addEventListener("mouseup", dragUpHandler);
}

// ─── Actions ─────────────────────────────────────────────────────────────────

function handleApply(): void {
  const selector = currentSelector.trim();
  if (!selector) return;
  const cb = onApplyCallback;
  closeWidget();
  cb?.(selector, currentAlternatives);
}

function handleCancel(): void {
  const cb = onCancelCallback;
  closeWidget();
  cb?.();
}

// ─── Keyboard handler (widget-level) ─────────────────────────────────────────

function onWidgetKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    handleCancel();
  }
}

// ─── Positioning ─────────────────────────────────────────────────────────────

function positionWidget(widget: HTMLDivElement, anchorX: number, anchorY: number): void {
  const w = 380;
  const margin = 12;

  // Default: below-right of anchor point
  let left = anchorX + margin;
  let top = anchorY + margin;

  // Flip left if overflows right edge
  if (left + w > window.innerWidth - margin) {
    left = Math.max(margin, anchorX - w - margin);
  }

  // Flip up if overflows bottom edge
  if (top + 400 > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - 400 - margin);
  }

  widget.style.left = `${String(left)}px`;
  widget.style.top = `${String(top)}px`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SelectorWidgetOptions {
  /** The initially selected CSS selector */
  initialSelector: string;
  /** Pre-generated alternatives for the picked element */
  alternatives: SelectorAlternative[];
  /** The picked DOM element (used for depth regeneration) */
  element: Element;
  /** Screen coordinates for initial positioning */
  anchorX: number;
  anchorY: number;
  /** Selector generation function with configurable depth */
  generateAlternatives: (el: Element, maxDepth: number) => SelectorAlternative[];
  /** Called when the user clicks Apply */
  onApply: (selector: string, alternatives: SelectorAlternative[]) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

/** Open the selector test widget on the page */
export function openSelectorWidget(opts: SelectorWidgetOptions): void {
  // Close any existing widget
  if (isOpen) closeWidget();

  currentSelector = opts.initialSelector;
  currentAlternatives = opts.alternatives;
  currentDepth = 3;
  targetElement = opts.element;
  generateAlternativesFn = opts.generateAlternatives;
  onApplyCallback = opts.onApply;
  onCancelCallback = opts.onCancel;

  // Build DOM
  widgetEl = buildWidget();
  positionWidget(widgetEl, opts.anchorX, opts.anchorY);
  document.documentElement.appendChild(widgetEl);
  isOpen = true;

  // Populate
  if (inputEl !== null) {
    inputEl.value = currentSelector;
    inputEl.focus();
    inputEl.select();
  }
  renderAlternativesList();

  // Initial live test
  liveTest(currentSelector);

  // Widget-level keyboard
  document.addEventListener("keydown", onWidgetKeyDown, true);
}

/** Close the widget and clean up */
export function closeWidget(): void {
  if (!isOpen) return;
  isOpen = false;

  clearHighlights();

  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }

  document.removeEventListener("keydown", onWidgetKeyDown, true);

  // Clean up drag handlers
  if (dragMoveHandler !== null) {
    document.removeEventListener("mousemove", dragMoveHandler);
    dragMoveHandler = null;
  }
  if (dragUpHandler !== null) {
    document.removeEventListener("mouseup", dragUpHandler);
    dragUpHandler = null;
  }

  if (widgetEl !== null) {
    widgetEl.remove();
    widgetEl = null;
  }

  inputEl = null;
  matchBadgeEl = null;
  depthLabelEl = null;
  altListEl = null;
  targetElement = null;
  generateAlternativesFn = null;
  onApplyCallback = null;
  onCancelCallback = null;
  currentAlternatives = [];
  currentSelector = "";
}

/** Whether the widget is currently open */
export function isWidgetOpen(): boolean {
  return isOpen;
}
