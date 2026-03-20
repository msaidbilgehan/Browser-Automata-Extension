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
  function __qsaDeep(sel,root){
    root=root||document;
    var out=[];
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
    try{var m=root.querySelector(sel);if(m)return m;}catch(e){}
    var all=root.querySelectorAll('*');
    for(var i=0;i<all.length;i++){
      if(all[i].shadowRoot){
        var found=__qsDeep(sel,all[i].shadowRoot);
        if(found)return found;
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
export function inlineDeepQueryAll(
  selector: string,
  root?: Document | ShadowRoot,
): Element[] {
  const searchRoot: Document | ShadowRoot = root ?? document;
  const out: Element[] = [];
  try {
    const matches = searchRoot.querySelectorAll(selector);
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      if (m !== undefined) out.push(m);
    }
  } catch {
    // invalid selector
  }
  const allElements = searchRoot.querySelectorAll("*");
  for (let j = 0; j < allElements.length; j++) {
    const el = allElements[j];
    if (el !== undefined && el.shadowRoot !== null) {
      const shadowRoot = el.shadowRoot;
      try {
        const shadowMatches = shadowRoot.querySelectorAll(selector);
        for (let k = 0; k < shadowMatches.length; k++) {
          const sm = shadowMatches[k];
          if (sm !== undefined) out.push(sm);
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
  try {
    const match = searchRoot.querySelector(selector);
    if (match !== null) return match;
  } catch {
    // skip
  }
  const allElements = searchRoot.querySelectorAll("*");
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el !== undefined && el.shadowRoot !== null) {
      const found = inlineDeepQuery(selector, el.shadowRoot);
      if (found !== null) return found;
    }
  }
  return null;
}
