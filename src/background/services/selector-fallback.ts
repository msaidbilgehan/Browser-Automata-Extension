/**
 * Fallback selectors (F16g).
 * Tries selectors in order, returning the first that matches an element
 * on the page. Also supports staleness testing.
 *
 * Searches across open shadow roots so selectors for Web Components work.
 */

import { DEEP_QUERY_SNIPPET } from "@/shared/deep-query-snippet";

/** Result of a selector search attempt */
export interface FindElementResult {
  found: boolean;
  usedIndex: number;
  selector: string;
}

/**
 * Try selectors in order, returning the first one that matches
 * at least one element on the page (including shadow roots).
 */
export async function findElement(tabId: number, selectors: string[]): Promise<FindElementResult> {
  if (selectors.length === 0) {
    return { found: false, usedIndex: -1, selector: "" };
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sels: string[], snippet: string) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
      new Function(snippet)();
      for (let i = 0; i < sels.length; i++) {
        const sel = sels[i];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        if (sel !== undefined && (globalThis as any).__qsDeep(sel)) {
          return { found: true, usedIndex: i, selector: sel };
        }
      }
      return { found: false, usedIndex: -1, selector: "" };
    },
    args: [selectors, DEEP_QUERY_SNIPPET],
  });

  const firstResult = results[0];
  if (firstResult?.result) {
    const r = firstResult.result as FindElementResult;
    return { found: r.found, usedIndex: r.usedIndex, selector: r.selector };
  }

  return { found: false, usedIndex: -1, selector: "" };
}

/**
 * Test whether a selector still matches at least one element on the page.
 * Returns `true` if the selector is still valid, `false` if stale.
 */
export async function testSelectorStaleness(tabId: number, selector: string): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel: string, snippet: string) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
      new Function(snippet)();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      return (globalThis as any).__qsDeep(sel) !== null;
    },
    args: [selector, DEEP_QUERY_SNIPPET],
  });

  const firstResult = results[0];
  return firstResult?.result === true;
}
