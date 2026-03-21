/**
 * Shadow DOM–aware querySelector / querySelectorAll.
 *
 * This module provides two things:
 *
 * 1. **DEEP_QUERY_SNIPPET** — a string of JavaScript that, when eval'd or
 *    prepended to injected code, defines `__qsDeep(sel)` and `__qsaDeep(sel)`
 *    on the page. Background services embed this into scripts injected via
 *    `chrome.scripting.executeScript`.
 *
 * 2. **Helper types** — used only at compile time; no runtime cost.
 *
 * The snippet is intentionally self-contained (no imports, no module scope)
 * so it can be safely concatenated with arbitrary page-level JavaScript.
 */

/**
 * Raw JS snippet that defines `__qsDeep` and `__qsaDeep` in the page scope.
 *
 * Usage in background services:
 * ```ts
 * const code = `${DEEP_QUERY_SNIPPET}; __qsDeep("my-element")?.click()`;
 * ```
 *
 * Or inject once per session and rely on it being available on `window`.
 */
export const DEEP_QUERY_SNIPPET = `
if(typeof __qsaDeep==='undefined'){
  function __isXP(s){var t=s.trimStart();return t.charAt(0)==='/'||t.indexOf('(//')=== 0;}
  function __xpAll(expr,root){
    var doc=root.ownerDocument||root;
    var ctx=(root instanceof Document)?root:(root.host||root);
    var out=[];
    try{var r=doc.evaluate(expr,ctx,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
    for(var i=0;i<r.snapshotLength;i++){var n=r.snapshotItem(i);if(n&&n.nodeType===1)out.push(n);}}catch(e){}
    return out;
  }
  function __xpFirst(expr,root){
    var doc=root.ownerDocument||root;
    var ctx=(root instanceof Document)?root:(root.host||root);
    try{var r=doc.evaluate(expr,ctx,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);
    var n=r.singleNodeValue;if(n&&n.nodeType===1)return n;}catch(e){}
    return null;
  }
  function __qsaDeep(sel,root){
    root=root||document;
    var out=[];
    if(__isXP(sel)){
      var xm=__xpAll(sel,root);for(var xi=0;xi<xm.length;xi++)out.push(xm[xi]);
      var xa=root.querySelectorAll('*');
      for(var xj=0;xj<xa.length;xj++){if(xa[xj].shadowRoot){
        var xsr=xa[xj].shadowRoot;
        var xsm=__xpAll(sel,xsr);for(var xk=0;xk<xsm.length;xk++)out.push(xsm[xk]);
        var xin=__qsaDeep(sel,xsr);for(var xl=0;xl<xin.length;xl++)out.push(xin[xl]);
      }}
      return out;
    }
    try{var m=root.querySelectorAll(sel);for(var i=0;i<m.length;i++)out.push(m[i]);}catch(e){}
    var all=root.querySelectorAll('*');
    for(var j=0;j<all.length;j++){
      if(all[j].shadowRoot){
        var sr=all[j].shadowRoot;
        try{var sm=sr.querySelectorAll(sel);for(var k=0;k<sm.length;k++)out.push(sm[k]);}catch(e){}
        var inner=__qsaDeep(sel,sr);
        for(var l=0;l<inner.length;l++)out.push(inner[l]);
      }
    }
    return out;
  }
  function __qsDeep(sel,root){
    root=root||document;
    if(__isXP(sel)){
      var xm=__xpFirst(sel,root);if(xm)return xm;
      var xa=root.querySelectorAll('*');
      for(var xi=0;xi<xa.length;xi++){if(xa[xi].shadowRoot){
        var found=__qsDeep(sel,xa[xi].shadowRoot);if(found)return found;
      }}
      return null;
    }
    try{var m=root.querySelector(sel);if(m)return m;}catch(e){}
    var all=root.querySelectorAll('*');
    for(var i=0;i<all.length;i++){
      if(all[i].shadowRoot){
        var found2=__qsDeep(sel,all[i].shadowRoot);
        if(found2)return found2;
      }
    }
    return null;
  }
}`.trim();

/**
 * Wraps the deep query functions for use in `chrome.scripting.executeScript`
 * `func`-style injections. Call this at the top of an injected function body:
 *
 * ```ts
 * func: (selector: string) => {
 *   // These are defined inline by the snippet above
 *   const qsDeep = ...; // Use the functions from the snippet
 * }
 * ```
 *
 * Since `func`-style injections can't access external variables, we provide
 * the implementation as a self-contained pair of functions that can be
 * copy-pasted into each injected function.
 */

/**
 * For `func`-style injected functions: inline deep querySelector implementation.
 * Call this inside an injected function to get the deep-query behavior.
 *
 * These are standalone functions to be called from within injected scripts:
 */
/** Detect XPath expressions (start with `/`, `//`, or `(//` for grouped XPath) */
function isXPathSelector(selector: string): boolean {
  const s = selector.trimStart();
  return s.startsWith("/") || s.startsWith("(//");
}

/** Evaluate an XPath expression, returning all matching elements. */
function xpathEvalAll(expr: string, root: Document | ShadowRoot): Element[] {
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

/** Evaluate an XPath expression, returning the first matching element. */
function xpathEvalFirst(expr: string, root: Document | ShadowRoot): Element | null {
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

export function inlineDeepQueryAll(
  selector: string,
  root?: Document | ShadowRoot,
): Element[] {
  const searchRoot: Document | ShadowRoot = root ?? document;
  const out: Element[] = [];

  if (isXPathSelector(selector)) {
    for (const el of xpathEvalAll(selector, searchRoot)) out.push(el);
    const allElements = searchRoot.querySelectorAll("*");
    for (const el of allElements) {
      if (el.shadowRoot !== null) {
        for (const sel of xpathEvalAll(selector, el.shadowRoot)) out.push(sel);
        const inner = inlineDeepQueryAll(selector, el.shadowRoot);
        for (const el2 of inner) out.push(el2);
      }
    }
    return out;
  }

  try {
    const matches = searchRoot.querySelectorAll(selector);
    for (const m of matches) {
      out.push(m);
    }
  } catch {
    // invalid selector
  }
  const allElements = searchRoot.querySelectorAll("*");
  for (const el of allElements) {
    if (el.shadowRoot !== null) {
      const shadowRoot = el.shadowRoot;
      try {
        const shadowMatches = shadowRoot.querySelectorAll(selector);
        for (const sm of shadowMatches) {
          out.push(sm);
        }
      } catch {
        // skip
      }
      const inner = inlineDeepQueryAll(selector, shadowRoot);
      for (const el2 of inner) {
        out.push(el2);
      }
    }
  }
  return out;
}

export function inlineDeepQuery(
  selector: string,
  root?: Document | ShadowRoot,
): Element | null {
  const searchRoot: Document | ShadowRoot = root ?? document;

  if (isXPathSelector(selector)) {
    const match = xpathEvalFirst(selector, searchRoot);
    if (match !== null) return match;
    const allElements = searchRoot.querySelectorAll("*");
    for (const el of allElements) {
      if (el.shadowRoot !== null) {
        const found = inlineDeepQuery(selector, el.shadowRoot);
        if (found !== null) return found;
      }
    }
    return null;
  }

  try {
    const match = searchRoot.querySelector(selector);
    if (match !== null) return match;
  } catch {
    // skip
  }
  const allElements = searchRoot.querySelectorAll("*");
  for (const el of allElements) {
    if (el.shadowRoot !== null) {
      const found = inlineDeepQuery(selector, el.shadowRoot);
      if (found !== null) return found;
    }
  }
  return null;
}
