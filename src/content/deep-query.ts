/**
 * Shadow DOM–aware query utilities.
 *
 * `document.querySelectorAll` only searches the light DOM tree. Many modern
 * sites (YouTube, GitHub, Salesforce, etc.) use Web Components with open
 * shadow roots. These utilities recursively traverse shadow boundaries so
 * that CSS selectors and XPath expressions work regardless of nesting depth.
 */

/** Detect XPath expressions (start with `/`, `//`, or `(` for grouped XPath) */
function isXPath(selector: string): boolean {
  const s = selector.trimStart();
  return s.startsWith("/") || s.startsWith("(//");
}

/** Evaluate an XPath expression against a context node, returning all matching elements. */
function xpathQueryAll(expr: string, root: Document | ShadowRoot): Element[] {
  const doc = root instanceof Document ? root : root.ownerDocument;
  const contextNode = root instanceof Document ? root : root.host;
  const out: Element[] = [];
  try {
    const result = doc.evaluate(expr, contextNode, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0; i < result.snapshotLength; i++) {
      const node = result.snapshotItem(i);
      if (node instanceof Element) out.push(node);
    }
  } catch {
    // Invalid XPath
  }
  return out;
}

/** Evaluate an XPath expression against a context node, returning the first matching element. */
function xpathQueryFirst(expr: string, root: Document | ShadowRoot): Element | null {
  const doc = root instanceof Document ? root : root.ownerDocument;
  const contextNode = root instanceof Document ? root : root.host;
  try {
    const result = doc.evaluate(expr, contextNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const node = result.singleNodeValue;
    if (node instanceof Element) return node;
  } catch {
    // Invalid XPath
  }
  return null;
}

/**
 * Find all elements matching `selector` across the document and every
 * reachable open shadow root.  Returns an empty array for invalid selectors.
 * Supports both CSS selectors and XPath expressions.
 */
export function querySelectorAllDeep(selector: string): Element[] {
  const results: Element[] = [];
  try {
    collectMatches(document, selector, results);
  } catch {
    // Invalid selector — return empty
  }
  return results;
}

/**
 * Find the first element matching `selector` across shadow boundaries,
 * or `null` if nothing matches.
 * Supports both CSS selectors and XPath expressions.
 */
export function querySelectorDeep(selector: string): Element | null {
  try {
    return findFirst(document, selector);
  } catch {
    return null;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Recursively collect matches from a root (Document or ShadowRoot) and
 * all shadow roots reachable from its descendants.
 */
function collectMatches(
  root: Document | ShadowRoot,
  selector: string,
  out: Element[],
): void {
  if (isXPath(selector)) {
    // XPath: evaluate against this root
    for (const el of xpathQueryAll(selector, root)) {
      out.push(el);
    }
    // Recurse into shadow roots
    walkShadowRoots(root, (shadowRoot) => {
      for (const el of xpathQueryAll(selector, shadowRoot)) {
        out.push(el);
      }
    });
    return;
  }

  // CSS: query the current root's tree
  try {
    const matches = root.querySelectorAll(selector);
    for (const el of matches) {
      out.push(el);
    }
  } catch {
    // Invalid selector at this level — skip
  }

  // Recurse into every open shadow root reachable from this root
  walkShadowRoots(root, (shadowRoot) => {
    try {
      const matches = shadowRoot.querySelectorAll(selector);
      for (const el of matches) {
        out.push(el);
      }
    } catch {
      // skip
    }
  });
}

/** Find the first match across shadow boundaries (depth-first). */
function findFirst(
  root: Document | ShadowRoot,
  selector: string,
): Element | null {
  if (isXPath(selector)) {
    const match = xpathQueryFirst(selector, root);
    if (match !== null) return match;
    // Check shadow roots using efficient element iteration
    return findFirstInShadowRoots(root, (sr) => xpathQueryFirst(selector, sr));
  }

  try {
    const match = root.querySelector(selector);
    if (match !== null) return match;
  } catch {
    // skip
  }

  // Check shadow roots depth-first
  return findFirstInShadowRoots(root, (sr) => findFirst(sr, selector));
}

/**
 * Iterate elements with shadow roots in `root` and call `fn` on each.
 * Returns the first non-null result, enabling early exit without
 * materializing the full `querySelectorAll("*")` NodeList.
 */
function findFirstInShadowRoots(
  root: Document | ShadowRoot,
  fn: (sr: ShadowRoot) => Element | null,
): Element | null {
  const rootNode = root instanceof Document ? root.documentElement : root;
  if (!rootNode) return null;
  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node !== null) {
    const el = node as Element;
    if (el.shadowRoot !== null) {
      const found = fn(el.shadowRoot);
      if (found !== null) return found;
    }
    node = walker.nextNode();
  }
  return null;
}

/**
 * Walk every open shadow root reachable from `root`, calling `fn` for each.
 * Avoids infinite loops by visiting each shadow root exactly once.
 */
function walkShadowRoots(
  root: Document | ShadowRoot,
  fn: (sr: ShadowRoot) => void,
): void {
  const allElements = root.querySelectorAll("*");
  for (const el of allElements) {
    if (el.shadowRoot !== null) {
      fn(el.shadowRoot);
      walkShadowRoots(el.shadowRoot, fn);
    }
  }
}
