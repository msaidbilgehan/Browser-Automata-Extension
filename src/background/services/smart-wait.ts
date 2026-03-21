/**
 * Smart wait strategies (F16h/F16j).
 * Injects scripts into pages to wait for various readiness conditions.
 */

import { DEFAULTS } from "@/shared/constants";
import { DEEP_QUERY_SNIPPET } from "@/shared/deep-query-snippet";

/**
 * Wait for a page to be fully ready: DOM stable + network idle.
 * Injects a script that monitors for DOM mutations and pending network
 * requests, resolving when both are quiet for a threshold period.
 */
export async function waitForPageReady(
  tabId: number,
  timeoutMs: number = DEFAULTS.SCRIPT_TIMEOUT_MS,
): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (timeout: number) => {
      return new Promise<boolean>((resolve) => {
        const STABLE_DURATION = 500;
        let lastMutationTime = Date.now();
        let settled = false;

        const observer = new MutationObserver(() => {
          lastMutationTime = Date.now();
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });

        const timer = window.setInterval(() => {
          const elapsed = Date.now() - lastMutationTime;
          if (elapsed >= STABLE_DURATION && document.readyState === "complete") {
            cleanup(true);
          }
        }, 100);

        const deadline = window.setTimeout(() => {
          cleanup(false);
        }, timeout);

        function cleanup(result: boolean) {
          if (settled) return;
          settled = true;
          observer.disconnect();
          window.clearInterval(timer);
          window.clearTimeout(deadline);
          resolve(result);
        }
      });
    },
    args: [timeoutMs],
  });

  const firstResult = results[0];
  return firstResult?.result === true;
}

/**
 * Wait for a specific element to appear in the DOM.
 * Polls via MutationObserver + querySelector.
 */
export async function waitForElement(
  tabId: number,
  selector: string,
  timeoutMs: number = DEFAULTS.SCRIPT_TIMEOUT_MS,
): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel: string, timeout: number, snippet: string) => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
      new Function(snippet)();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      const qsDeep = (s: string) => (globalThis as any).__qsDeep(s);

      return new Promise<boolean>((resolve) => {
        // Check if element already exists
        if (qsDeep(sel)) {
          resolve(true);
          return;
        }

        let settled = false;

        const observer = new MutationObserver(() => {
          if (qsDeep(sel)) {
            cleanup(true);
          }
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });

        const deadline = window.setTimeout(() => {
          cleanup(false);
        }, timeout);

        function cleanup(result: boolean) {
          if (settled) return;
          settled = true;
          observer.disconnect();
          window.clearTimeout(deadline);
          resolve(result);
        }
      });
    },
    args: [selector, timeoutMs, DEEP_QUERY_SNIPPET],
  });

  const firstResult = results[0];
  return firstResult?.result === true;
}

/**
 * Wait for network activity to become idle.
 * Monitors XMLHttpRequest and fetch to track pending requests,
 * resolving when no requests are in flight for a threshold period.
 */
export async function waitForNetworkIdle(
  tabId: number,
  timeoutMs: number = DEFAULTS.SCRIPT_TIMEOUT_MS,
): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (timeout: number) => {
      return new Promise<boolean>((resolve) => {
        const IDLE_THRESHOLD = 500;
        let pendingRequests = 0;
        let lastActivityTime = Date.now();
        let settled = false;

        // Intercept XMLHttpRequest
        /* eslint-disable @typescript-eslint/unbound-method -- Storing for monkey-patch & restore */
        const origXhrOpen = XMLHttpRequest.prototype.open;
        const origXhrSend = XMLHttpRequest.prototype.send;
        /* eslint-enable @typescript-eslint/unbound-method */

         
        XMLHttpRequest.prototype.open = function (
          this: XMLHttpRequest,
          ...args: [string, string | URL, ...unknown[]]
        ) {
          this.addEventListener("loadend", () => {
            pendingRequests = Math.max(0, pendingRequests - 1);
            lastActivityTime = Date.now();
          });
          origXhrOpen.apply(this, args as Parameters<typeof origXhrOpen>);
        } as typeof origXhrOpen;

        XMLHttpRequest.prototype.send = function (
          this: XMLHttpRequest,
          ...args: Parameters<typeof origXhrSend>
        ) {
          pendingRequests++;
          lastActivityTime = Date.now();
          origXhrSend.apply(this, args);
        };

        // Intercept fetch
        const origFetch = window.fetch;
        window.fetch = function (...args: Parameters<typeof origFetch>) {
          pendingRequests++;
          lastActivityTime = Date.now();
          return origFetch.apply(this, args).finally(() => {
            pendingRequests = Math.max(0, pendingRequests - 1);
            lastActivityTime = Date.now();
          });
        };

        const timer = window.setInterval(() => {
          const elapsed = Date.now() - lastActivityTime;
          if (pendingRequests === 0 && elapsed >= IDLE_THRESHOLD) {
            cleanup(true);
          }
        }, 100);

        const deadline = window.setTimeout(() => {
          cleanup(false);
        }, timeout);

        function cleanup(result: boolean) {
          if (settled) return;
          settled = true;
          window.clearInterval(timer);
          window.clearTimeout(deadline);
          // Restore originals
          XMLHttpRequest.prototype.open = origXhrOpen;
          XMLHttpRequest.prototype.send = origXhrSend;
          window.fetch = origFetch;
          resolve(result);
        }
      });
    },
    args: [timeoutMs],
  });

  const firstResult = results[0];
  return firstResult?.result === true;
}
