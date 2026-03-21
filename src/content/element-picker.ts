/** Element picker overlay — highlights elements on hover, shows selector widget on click */

import {
  openSelectorWidget,
  closeWidget as closeSelectorWidget,
  isWidgetOpen,
} from "./selector-widget";
import { querySelectorAllDeep } from "./deep-query";

let isActive = false;
let highlightEl: HTMLDivElement | null = null;
let tooltipEl: HTMLDivElement | null = null;
let hintEl: HTMLDivElement | null = null;
let currentTarget: Element | null = null;

// ─── Alternatives panel state ───────────────────────────────────────────────

let alternativesPanelEl: HTMLDivElement | null = null;
let selectedIndex = 0;
let panelAlternatives: SelectorAlternative[] = [];
let panelTarget: Element | null = null;
let isPanelOpen = false;

// ─── Shared style constants ──────────────────────────────────────────────────

const PICKER_Z_INDEX = "2147483647";
const ACCENT_COLOR = "#3b82f6";
const ACCENT_BG = "rgba(59, 130, 246, 0.1)";


// ─── Selector generation ─────────────────────────────────────────────────────

/** Attributes worth using as stable selectors (order = preference) */
const STABLE_ATTRS = [
  "data-testid",
  "data-test-id",
  "data-cy",
  "data-id",
  "data-action",
  "aria-label",
  "name",
  "role",
  "type",
  "title",
  "alt",
  "placeholder",
  "for",
  "href",
] as const;

/** Check whether a candidate selector uniquely matches `target` (searches shadow roots) */
function isUnique(selector: string, target: Element): boolean {
  const matches = querySelectorAllDeep(selector);
  return matches.length === 1 && matches[0] === target;
}

/** Try to build a short, unique selector for a single element without ancestry */
function atomicSelector(el: Element): string | null {
  const tag = el.tagName.toLowerCase();

  // 1. ID
  if (el.id) {
    const sel = `#${CSS.escape(el.id)}`;
    if (isUnique(sel, el)) return sel;
  }

  // 2. Stable attributes (aria-label, data-testid, etc.)
  for (const attr of STABLE_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) {
      const sel = `${tag}[${attr}=${CSS.escape(value)}]`;
      if (isUnique(sel, el)) return sel;
    }
  }

  // 3. Unique single class
  for (const cls of el.classList) {
    if (!cls) continue;
    const sel = `${tag}.${CSS.escape(cls)}`;
    if (isUnique(sel, el)) return sel;
  }

  // 4. Unique class combination (pick first two meaningful classes)
  if (el.classList.length >= 2) {
    const escaped = Array.from(el.classList)
      .filter(Boolean)
      .slice(0, 3)
      .map((c) => `.${CSS.escape(c)}`)
      .join("");
    const sel = `${tag}${escaped}`;
    if (isUnique(sel, el)) return sel;
  }

  return null;
}

/**
 * Generate an optimal CSS selector for an element.
 *
 * Strategy (from most to least stable):
 *   1. Unique atomic selector (id, aria-label, data-*, class)
 *   2. Short ancestor-anchored selector (find a nearby unique ancestor + child path)
 *   3. Fallback to nth-child chain (kept short — max 4 levels)
 */
export function generateSelector(element: Element): string {
  // ── 1. Atomic selector on the element itself ──────────────────────────
  const atomic = atomicSelector(element);
  if (atomic) return atomic;

  // ── 2. Anchor to a nearby unique ancestor ─────────────────────────────
  //    Walk up (max 5 levels) looking for an ancestor with a unique
  //    atomic selector, then build a short descendant path from it.
  {
    const childPath: string[] = [];
    let child: Element = element;
    let ancestor = element.parentElement;
    let depth = 0;

    while (ancestor && ancestor !== document.documentElement && depth < 5) {
      // Build a segment for `child` relative to `ancestor`
      const seg = childSegment(child, ancestor);
      childPath.unshift(seg);

      const anchorSel = atomicSelector(ancestor);
      if (anchorSel) {
        const fullSel = `${anchorSel} > ${childPath.join(" > ")}`;
        if (isUnique(fullSel, element)) return fullSel;
      }

      child = ancestor;
      ancestor = ancestor.parentElement;
      depth++;
    }
  }

  // ── 3. Fallback — short nth-child path (max 4 levels) ────────────────
  const parts: string[] = [];
  let current: Element | null = element;
  let levels = 0;

  while (current !== document.documentElement && levels < 4) {
    const el: Element = current;
    const parent = el.parentElement;
    if (parent === null) {
      parts.unshift(el.tagName.toLowerCase());
      break;
    }

    parts.unshift(childSegment(el, parent));
    current = parent;
    levels++;
  }

  return parts.join(" > ");
}

/** Build a tag-based child segment (with nth-child only when needed to disambiguate) */
function childSegment(el: Element, parent: Element): string {
  const tag = el.tagName.toLowerCase();

  // Try tag + unique attribute first
  for (const attr of STABLE_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) {
      const sel = `${tag}[${attr}=${CSS.escape(value)}]`;
      // Check uniqueness within the parent only
      try {
        if (parent.querySelectorAll(`:scope > ${sel}`).length === 1) return sel;
      } catch {
        // :scope not supported in some contexts
      }
    }
  }

  // Try tag + class
  for (const cls of el.classList) {
    if (!cls) continue;
    const sel = `${tag}.${CSS.escape(cls)}`;
    try {
      if (parent.querySelectorAll(`:scope > ${sel}`).length === 1) return sel;
    } catch {
      // fallthrough
    }
  }

  // Tag alone if unique among siblings
  const sameTagSiblings = Array.from(parent.children).filter((s) => s.tagName === el.tagName);
  if (sameTagSiblings.length === 1) return tag;

  // nth-child as last resort
  const index = Array.from(parent.children).indexOf(el) + 1;
  return `${tag}:nth-child(${String(index)})`;
}

// ─── Alternative selector types (mirrored from shared/types/entities) ────────
// Content scripts run in an isolated world and cannot import shared types at
// runtime, so we duplicate the shape here.

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

// ─── Strategy sub-generators ─────────────────────────────────────────────────

const DATA_ATTRS = ["data-testid", "data-test-id", "data-cy", "data-id", "data-action"] as const;
const ARIA_ATTRS = ["aria-label", "role"] as const;
const GENERAL_ATTRS = ["name", "type", "title", "alt", "placeholder", "for", "href"] as const;

/** Count how many elements match a CSS selector (searches shadow roots) */
function cssMatchCount(sel: string): number {
  return querySelectorAllDeep(sel).length;
}

/** Count how many nodes match an XPath expression (searches shadow roots) */
function xpathMatchCount(expr: string): number {
  let total = 0;
  try {
    const result = document.evaluate(expr, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    total += result.snapshotLength;
  } catch {
    // skip
  }
  // Also evaluate inside each reachable open shadow root
  xpathWalkShadowRoots(document, expr, (count) => { total += count; });
  return total;
}

/** Walk shadow roots and evaluate XPath in each */
function xpathWalkShadowRoots(
  root: Document | ShadowRoot,
  expr: string,
  cb: (count: number) => void,
): void {
  const allElements = root.querySelectorAll("*");
  for (const el of allElements) {
    if (el.shadowRoot !== null) {
      try {
        const result = document.evaluate(
          expr,
          el.shadowRoot,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null,
        );
        cb(result.snapshotLength);
      } catch {
        // skip
      }
      xpathWalkShadowRoots(el.shadowRoot, expr, cb);
    }
  }
}

function addCssCandidate(
  candidates: SelectorAlternative[],
  sel: string,
  strategy: SelectorStrategy,
): void {
  const count = cssMatchCount(sel);
  if (count > 0) {
    candidates.push({ selector: sel, strategy, isXPath: false, matchCount: count });
  }
}

function addXPathCandidate(
  candidates: SelectorAlternative[],
  expr: string,
  strategy: SelectorStrategy,
): void {
  const count = xpathMatchCount(expr);
  if (count > 0) {
    candidates.push({ selector: expr, strategy, isXPath: true, matchCount: count });
  }
}

function tryIdAlternatives(el: Element, out: SelectorAlternative[]): void {
  if (!el.id) return;
  addCssCandidate(out, `#${CSS.escape(el.id)}`, "id");
}

function tryDataAttrAlternatives(el: Element, out: SelectorAlternative[]): void {
  const tag = el.tagName.toLowerCase();
  for (const attr of DATA_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) {
      addCssCandidate(out, `${tag}[${attr}=${CSS.escape(value)}]`, "data-attr");
    }
  }
}

function tryAriaAlternatives(el: Element, out: SelectorAlternative[]): void {
  const tag = el.tagName.toLowerCase();
  for (const attr of ARIA_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) {
      addCssCandidate(out, `${tag}[${attr}=${CSS.escape(value)}]`, "aria");
    }
  }
}

function tryAttributeAlternatives(el: Element, out: SelectorAlternative[]): void {
  const tag = el.tagName.toLowerCase();
  for (const attr of GENERAL_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) {
      addCssCandidate(out, `${tag}[${attr}=${CSS.escape(value)}]`, "attribute");
    }
  }
}

function tryClassAlternatives(el: Element, out: SelectorAlternative[]): void {
  const tag = el.tagName.toLowerCase();
  // Single class
  for (const cls of el.classList) {
    if (!cls) continue;
    addCssCandidate(out, `${tag}.${CSS.escape(cls)}`, "class");
  }
  // Multi-class combination
  if (el.classList.length >= 2) {
    const escaped = Array.from(el.classList)
      .filter(Boolean)
      .slice(0, 3)
      .map((c) => `.${CSS.escape(c)}`)
      .join("");
    addCssCandidate(out, `${tag}${escaped}`, "class");
  }
}

function tryAncestorAlternative(el: Element, out: SelectorAlternative[]): void {
  const childPath: string[] = [];
  let child: Element = el;
  let ancestor = el.parentElement;
  let depth = 0;

  while (ancestor && ancestor !== document.documentElement && depth < 5) {
    const seg = childSegment(child, ancestor);
    childPath.unshift(seg);

    const anchorSel = atomicSelector(ancestor);
    if (anchorSel) {
      const fullSel = `${anchorSel} > ${childPath.join(" > ")}`;
      addCssCandidate(out, fullSel, "ancestor");
      return;
    }

    child = ancestor;
    ancestor = ancestor.parentElement;
    depth++;
  }
}

function tryNthChildAlternative(el: Element, out: SelectorAlternative[]): void {
  const parts: string[] = [];
  let current: Element | null = el;
  let levels = 0;

  while (current !== document.documentElement && levels < 4) {
    const node: Element = current;
    const parent = node.parentElement;
    if (parent === null) {
      parts.unshift(node.tagName.toLowerCase());
      break;
    }
    parts.unshift(childSegment(node, parent));
    current = parent;
    levels++;
  }

  addCssCandidate(out, parts.join(" > "), "nth-child");
}

function tryXPathTextAlternatives(el: Element, out: SelectorAlternative[]): void {
  const text = el.textContent?.trim() ?? "";
  if (text.length === 0 || text.length > 80) return;

  const tag = el.tagName.toLowerCase();

  // Exact text match (only if this element's direct text matches)
  const directText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent?.trim() ?? "")
    .join("")
    .trim();

  if (directText.length > 0 && directText.length <= 80) {
    // Escape single quotes in XPath
    const escaped = directText.includes("'")
      ? `concat('${directText.split("'").join("',\"'\",'")}')`
      : `'${directText}'`;
    addXPathCandidate(out, `//${tag}[text()=${escaped}]`, "xpath-text");

    // contains() variant for partial text
    if (directText.length > 10) {
      const short = directText.slice(0, 30);
      const shortEscaped = short.includes("'")
        ? `concat('${short.split("'").join("',\"'\",'")}')`
        : `'${short}'`;
      addXPathCandidate(out, `//${tag}[contains(text(),${shortEscaped})]`, "xpath-text");
    }
  }
}

function tryXPathAttrAlternatives(el: Element, out: SelectorAlternative[]): void {
  const tag = el.tagName.toLowerCase();
  const allAttrs = [...DATA_ATTRS, ...ARIA_ATTRS, ...GENERAL_ATTRS] as const;

  for (const attr of allAttrs) {
    const value = el.getAttribute(attr);
    if (value) {
      const escaped = value.includes("'")
        ? `concat('${value.split("'").join("',\"'\",'")}')`
        : `'${value}'`;
      addXPathCandidate(out, `//${tag}[@${attr}=${escaped}]`, "xpath-attr");
    }
  }

  // XPath by ID
  if (el.id) {
    const escaped = el.id.includes("'")
      ? `concat('${el.id.split("'").join("',\"'\",'")}')`
      : `'${el.id}'`;
    addXPathCandidate(out, `//${tag}[@id=${escaped}]`, "xpath-attr");
  }
}

/** Strategy preference order for sorting */
const STRATEGY_ORDER: Record<SelectorStrategy, number> = {
  "id": 0,
  "data-attr": 1,
  "aria": 2,
  "attribute": 3,
  "class": 4,
  "ancestor": 5,
  "nth-child": 6,
  "xpath-text": 7,
  "xpath-attr": 8,
};

/**
 * Generate multiple selector alternatives for an element, each labeled with
 * its strategy and match count. Alternatives are deduplicated and sorted by
 * uniqueness (count=1 first) then strategy preference.
 */
export function generateSelectorAlternatives(element: Element): SelectorAlternative[] {
  const candidates: SelectorAlternative[] = [];

  // Collect from all strategies
  tryIdAlternatives(element, candidates);
  tryDataAttrAlternatives(element, candidates);
  tryAriaAlternatives(element, candidates);
  tryAttributeAlternatives(element, candidates);
  tryClassAlternatives(element, candidates);
  tryAncestorAlternative(element, candidates);
  tryNthChildAlternative(element, candidates);
  tryXPathTextAlternatives(element, candidates);
  tryXPathAttrAlternatives(element, candidates);

  // Deduplicate by selector string
  const seen = new Set<string>();
  const unique: SelectorAlternative[] = [];
  for (const c of candidates) {
    if (!seen.has(c.selector)) {
      seen.add(c.selector);
      unique.push(c);
    }
  }

  // Sort: unique matches first (count=1), then by strategy preference
  unique.sort((a, b) => {
    // Prefer exact matches (count = 1)
    const aUnique = a.matchCount === 1 ? 0 : 1;
    const bUnique = b.matchCount === 1 ? 0 : 1;
    if (aUnique !== bUnique) return aUnique - bUnique;
    // Then by strategy preference
    return STRATEGY_ORDER[a.strategy] - STRATEGY_ORDER[b.strategy];
  });

  return unique;
}

/**
 * Generate selector alternatives with a configurable max ancestor depth.
 *
 * Depth controls how far up the DOM tree the ancestor and nth-child strategies
 * are allowed to walk:
 *   1 = element-level only (ID, attrs, class — no ancestry)
 *   2 = parent + element
 *   3–6 = progressively deeper ancestor chains
 */
export function generateSelectorAlternativesWithDepth(
  element: Element,
  maxDepth: number,
): SelectorAlternative[] {
  const candidates: SelectorAlternative[] = [];

  // Atomic strategies (always available, regardless of depth)
  tryIdAlternatives(element, candidates);
  tryDataAttrAlternatives(element, candidates);
  tryAriaAlternatives(element, candidates);
  tryAttributeAlternatives(element, candidates);
  tryClassAlternatives(element, candidates);

  // Ancestor / nth-child strategies use configurable depth
  if (maxDepth >= 2) {
    tryAncestorAlternativeWithDepth(element, candidates, maxDepth);
    tryNthChildAlternativeWithDepth(element, candidates, maxDepth);
  }

  // XPath strategies
  tryXPathTextAlternatives(element, candidates);
  tryXPathAttrAlternatives(element, candidates);

  // Deduplicate
  const seen = new Set<string>();
  const unique: SelectorAlternative[] = [];
  for (const c of candidates) {
    if (!seen.has(c.selector)) {
      seen.add(c.selector);
      unique.push(c);
    }
  }

  // Sort: unique matches first (count=1), then by strategy preference
  unique.sort((a, b) => {
    const aUnique = a.matchCount === 1 ? 0 : 1;
    const bUnique = b.matchCount === 1 ? 0 : 1;
    if (aUnique !== bUnique) return aUnique - bUnique;
    return STRATEGY_ORDER[a.strategy] - STRATEGY_ORDER[b.strategy];
  });

  return unique;
}

/** Ancestor alternative with configurable max depth */
function tryAncestorAlternativeWithDepth(
  el: Element,
  out: SelectorAlternative[],
  maxDepth: number,
): void {
  const childPath: string[] = [];
  let child: Element = el;
  let ancestor = el.parentElement;
  let depth = 0;
  const limit = Math.max(1, maxDepth - 1); // -1 because depth 1 = element only

  while (ancestor && ancestor !== document.documentElement && depth < limit) {
    const seg = childSegment(child, ancestor);
    childPath.unshift(seg);

    const anchorSel = atomicSelector(ancestor);
    if (anchorSel) {
      const fullSel = `${anchorSel} > ${childPath.join(" > ")}`;
      addCssCandidate(out, fullSel, "ancestor");
      return;
    }

    child = ancestor;
    ancestor = ancestor.parentElement;
    depth++;
  }
}

/** Nth-child alternative with configurable max depth */
function tryNthChildAlternativeWithDepth(
  el: Element,
  out: SelectorAlternative[],
  maxDepth: number,
): void {
  const parts: string[] = [];
  let current: Element | null = el;
  let levels = 0;
  const limit = Math.max(1, maxDepth - 1);

  while (current !== document.documentElement && levels < limit) {
    const node: Element = current;
    const parent = node.parentElement;
    if (parent === null) {
      parts.unshift(node.tagName.toLowerCase());
      break;
    }
    parts.unshift(childSegment(node, parent));
    current = parent;
    levels++;
  }

  addCssCandidate(out, parts.join(" > "), "nth-child");
}

/** Build a short breadcrumb label for an element (e.g. "div.card > span.title") */
function elementBreadcrumb(element: Element): string {
  const parts: string[] = [];
  let el: Element | null = element;
  let depth = 0;

  while (el !== null && el !== document.documentElement && depth < 3) {
    let label = el.tagName.toLowerCase();
    if (el.id) {
      label += `#${el.id}`;
    } else if (el.classList.length > 0) {
      const firstClass = el.classList[0];
      if (firstClass) {
        label += `.${firstClass}`;
      }
    }
    parts.unshift(label);
    el = el.parentElement;
    depth++;
  }

  return parts.join(" > ");
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

/** Create the highlight overlay element */
function createHighlight(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.pointerEvents = "none";
  el.style.zIndex = PICKER_Z_INDEX;
  el.style.border = `2px solid ${ACCENT_COLOR}`;
  el.style.backgroundColor = ACCENT_BG;
  el.style.borderRadius = "2px";
  el.style.transition = "all 0.05s ease-out";
  el.style.display = "none";
  document.body.appendChild(el);
  return el;
}

/** Create the tooltip that shows selector + breadcrumb below the highlight */
function createTooltip(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.pointerEvents = "none";
  el.style.zIndex = PICKER_Z_INDEX;
  el.style.backgroundColor = "rgba(30, 30, 30, 0.95)";
  el.style.color = "#e2e8f0";
  el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  el.style.fontSize = "11px";
  el.style.lineHeight = "1.4";
  el.style.padding = "4px 8px";
  el.style.borderRadius = "4px";
  el.style.maxWidth = "360px";
  el.style.overflow = "hidden";
  el.style.whiteSpace = "nowrap";
  el.style.textOverflow = "ellipsis";
  el.style.display = "none";
  el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
  document.body.appendChild(el);
  return el;
}

/** Create the Escape-hint banner at the top of the viewport */
function createHint(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.zIndex = PICKER_Z_INDEX;
  el.style.backgroundColor = ACCENT_COLOR;
  el.style.color = "#fff";
  el.style.fontFamily = "system-ui, -apple-system, sans-serif";
  el.style.fontSize = "12px";
  el.style.fontWeight = "600";
  el.style.padding = "6px 16px";
  el.style.borderRadius = "0 0 6px 6px";
  el.style.boxShadow = "0 2px 8px rgba(59,130,246,0.4)";
  el.style.userSelect = "none";
  el.textContent = "Click an element to select it \u2014 Press Esc to cancel";
  document.body.appendChild(el);
  return el;
}

// ─── Alternatives panel ─────────────────────────────────────────────────────



/** Close the alternatives panel and return to hover-picking mode */
function closeAlternativesPanel(): void {
  if (alternativesPanelEl !== null) {
    alternativesPanelEl.remove();
    alternativesPanelEl = null;
  }
  isPanelOpen = false;
  panelAlternatives = [];
  panelTarget = null;
  selectedIndex = 0;

  window.removeEventListener("scroll", onScrollWhilePanel, true);

  // Re-enable hover tracking
  document.addEventListener("mouseover", onMouseOver, true);

  // Restore hint banner
  if (hintEl !== null) {
    hintEl.textContent = "Click an element to select it \u2014 Press Esc to cancel";
  }
}

/** Update visual selection in the panel to match selectedIndex */
function updatePanelSelection(): void {
  if (alternativesPanelEl === null) return;
  const rows = alternativesPanelEl.querySelectorAll<HTMLButtonElement>("[data-ba-alt-index]");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row === undefined) continue;
    const isSelected = i === selectedIndex;
    row.style.background = isSelected ? "rgba(59,130,246,0.15)" : "transparent";
    const check = row.querySelector<HTMLSpanElement>("[data-ba-check]");
    if (check !== null) {
      check.textContent = isSelected ? "\u2713" : "";
    }
  }
  // Scroll the active row into view
  rows[selectedIndex]?.scrollIntoView({ block: "nearest" });
}

/** Send the picked selector result and clean up */
function sendPickedResult(selector: string, alternatives: SelectorAlternative[]): void {
  try {
    void chrome.runtime.id; // Throws if extension context is invalidated
  } catch {
    return;
  }
  chrome.runtime.sendMessage({ type: "ELEMENT_PICKED", selector, alternatives }).catch(() => {
    // Service worker may not be ready
  });
  closeAlternativesPanel();
  stopPicking();
}

/** Handle user selecting an alternative from the panel */
function selectAlternative(index: number): void {
  const alt = panelAlternatives[index];
  if (alt === undefined) return;
  sendPickedResult(alt.selector, panelAlternatives);
}

/** Reposition highlight and panel when the page scrolls */
function onScrollWhilePanel(): void {
  if (panelTarget === null || alternativesPanelEl === null) return;

  // Reposition highlight over the target element
  if (highlightEl !== null) {
    const rect = panelTarget.getBoundingClientRect();
    highlightEl.style.top = `${String(rect.top)}px`;
    highlightEl.style.left = `${String(rect.left)}px`;
    highlightEl.style.width = `${String(rect.width)}px`;
    highlightEl.style.height = `${String(rect.height)}px`;
  }
}

// ─── Event handlers ──────────────────────────────────────────────────────────

/** Position the highlight and tooltip over the target element */
function positionOverlay(target: Element): void {
  if (highlightEl === null || tooltipEl === null) return;

  const rect = target.getBoundingClientRect();

  // Highlight
  highlightEl.style.top = `${String(rect.top)}px`;
  highlightEl.style.left = `${String(rect.left)}px`;
  highlightEl.style.width = `${String(rect.width)}px`;
  highlightEl.style.height = `${String(rect.height)}px`;
  highlightEl.style.display = "block";

  // Tooltip content
  const selector = generateSelector(target);
  const breadcrumb = elementBreadcrumb(target);
  tooltipEl.innerHTML = "";

  const selectorSpan = document.createElement("span");
  selectorSpan.style.color = "#93c5fd";
  selectorSpan.textContent = selector;

  const breadcrumbSpan = document.createElement("span");
  breadcrumbSpan.style.color = "#94a3b8";
  breadcrumbSpan.style.marginLeft = "8px";
  breadcrumbSpan.textContent = breadcrumb;

  tooltipEl.appendChild(selectorSpan);
  tooltipEl.appendChild(breadcrumbSpan);

  // Position tooltip below the highlight, or above if not enough space
  const tooltipGap = 6;
  const tooltipHeight = 24;
  const bottomSpace = window.innerHeight - rect.bottom;

  if (bottomSpace > tooltipHeight + tooltipGap) {
    tooltipEl.style.top = `${String(rect.bottom + tooltipGap)}px`;
  } else {
    tooltipEl.style.top = `${String(Math.max(0, rect.top - tooltipHeight - tooltipGap))}px`;
  }
  tooltipEl.style.left = `${String(Math.max(4, rect.left))}px`;
  tooltipEl.style.display = "block";
}

/** Handle mouseover — highlight hovered element */
function onMouseOver(e: MouseEvent): void {
  if (!isActive) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (target === highlightEl || target === tooltipEl || target === hintEl) return;

  currentTarget = target;
  positionOverlay(target);
}

/** Handle click — show the live selector test widget */
function onClick(e: MouseEvent): void {
  if (!isActive) return;

  // If the selector widget is open, let clicks inside it pass through
  if (isWidgetOpen()) {
    const target = e.target;
    if (target instanceof Node) {
      const widgetRoot = document.querySelector("[data-ba-selector-widget]");
      if (widgetRoot?.contains(target)) {
        // Click is inside the widget — let it through to widget handlers
        return;
      }
    }
    // Click outside the widget — close it and return to hover mode
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeSelectorWidget();
    // Re-enable hover tracking
    document.addEventListener("mouseover", onMouseOver, true);
    if (hintEl !== null) {
      hintEl.textContent = "Click an element to select it \u2014 Press Esc to cancel";
    }
    return;
  }

  // If the old panel is open, handle it for backwards compat
  if (isPanelOpen && alternativesPanelEl !== null) {
    const target = e.target;
    if (target instanceof Node && alternativesPanelEl.contains(target)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeAlternativesPanel();
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (currentTarget === null) return;

  // Generate alternatives for the clicked element
  const alternatives = generateSelectorAlternatives(currentTarget);
  const firstAlt = alternatives[0];
  const bestSelector = firstAlt !== undefined
    ? firstAlt.selector
    : generateSelector(currentTarget);

  // Freeze hover tracking while widget is open
  document.removeEventListener("mouseover", onMouseOver, true);

  // Update hint banner
  if (hintEl !== null) {
    hintEl.textContent = "Edit selector in widget \u2014 Press Esc to cancel";
  }
  // Hide tooltip
  if (tooltipEl !== null) {
    tooltipEl.style.display = "none";
  }

  // Open the live selector test widget
  openSelectorWidget({
    initialSelector: bestSelector,
    alternatives,
    element: currentTarget,
    anchorX: e.clientX,
    anchorY: e.clientY,
    generateAlternatives: generateSelectorAlternativesWithDepth,
    onApply: (selector, alts) => {
      sendPickedResult(selector, alts);
    },
    onCancel: () => {
      // Return to hover-picking mode
      document.addEventListener("mouseover", onMouseOver, true);
      if (hintEl !== null) {
        hintEl.textContent = "Click an element to select it \u2014 Press Esc to cancel";
      }
    },
  });
}

/** Handle keydown — widget/panel Escape + panel navigation */
function onKeyDown(e: KeyboardEvent): void {
  if (!isActive) return;

  // When the selector widget is open, it handles its own keyboard events.
  // We only need to catch Escape at the picker level when the widget is NOT open.
  if (isWidgetOpen()) return;

  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (isPanelOpen) {
      // First Escape: close panel, return to hover-picking mode
      closeAlternativesPanel();
    } else {
      // Second Escape (or Escape without panel): fully cancel picker
      stopPicking();
    }
    return;
  }

  // Panel keyboard navigation (legacy panel)
  if (!isPanelOpen) return;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    e.stopPropagation();
    const count = panelAlternatives.length;
    if (count === 0) return;
    if (e.key === "ArrowDown") {
      selectedIndex = (selectedIndex + 1) % count;
    } else {
      selectedIndex = (selectedIndex - 1 + count) % count;
    }
    updatePanelSelection();
  }

  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    selectAlternative(selectedIndex);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Start the element picker */
export function startPicking(): void {
  if (isActive) return;
  isActive = true;

  highlightEl = createHighlight();
  tooltipEl = createTooltip();
  hintEl = createHint();

  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
}

/** Stop the element picker and clean up */
export function stopPicking(): void {
  if (!isActive) return;
  isActive = false;

  // Close selector widget if open
  if (isWidgetOpen()) {
    closeSelectorWidget();
  }

  document.removeEventListener("mouseover", onMouseOver, true);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("scroll", onScrollWhilePanel, true);

  if (highlightEl !== null) {
    highlightEl.remove();
    highlightEl = null;
  }
  if (tooltipEl !== null) {
    tooltipEl.remove();
    tooltipEl = null;
  }
  if (hintEl !== null) {
    hintEl.remove();
    hintEl = null;
  }
  if (alternativesPanelEl !== null) {
    alternativesPanelEl.remove();
    alternativesPanelEl = null;
  }

  isPanelOpen = false;
  panelAlternatives = [];
  panelTarget = null;
  selectedIndex = 0;
  currentTarget = null;
}
