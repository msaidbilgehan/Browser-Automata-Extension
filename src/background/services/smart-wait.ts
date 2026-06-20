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
 * Shared state for the network-idle interceptors, stored on a `window`-scoped
 * sentinel so overlapping `waitForNetworkIdle` calls on the same tab cooperate
 * instead of capturing each other's patched functions as "originals".
 */
interface NetIdleState {
  pending: number;
  lastActivity: number;
  waiters: number;
  origOpen: XMLHttpRequest["open"];
  origSend: XMLHttpRequest["send"];
  origFetch: typeof window.fetch;
  patchedOpen: XMLHttpRequest["open"];
  patchedSend: XMLHttpRequest["send"];
  patchedFetch: typeof window.fetch;
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
        const SENTINEL = "__baNetIdle";
        const w = window as unknown as Record<string, NetIdleState | undefined>;

        // Install the fetch/XHR interceptors exactly once per page. Overlapping
        // waitForNetworkIdle calls on the same tab share one request counter via
        // this window sentinel; without it a second call would capture the
        // first call's *patched* functions as its "originals", and after both
        // cleanups the page's fetch/XHR would be left permanently wrapped.
        let state = w[SENTINEL];
        if (!state) {
          /* eslint-disable @typescript-eslint/unbound-method -- storing prototype methods for monkey-patch & restore */
          const origOpen = XMLHttpRequest.prototype.open;
          const origSend = XMLHttpRequest.prototype.send;
          /* eslint-enable @typescript-eslint/unbound-method */
          const origFetch = window.fetch;

          const created: NetIdleState = {
            pending: 0,
            lastActivity: Date.now(),
            waiters: 0,
            origOpen,
            origSend,
            origFetch,
            patchedOpen: origOpen,
            patchedSend: origSend,
            patchedFetch: origFetch,
          };

          const patchedOpen = function (
            this: XMLHttpRequest,
            ...args: [string, string | URL, ...unknown[]]
          ) {
            this.addEventListener("loadend", () => {
              created.pending = Math.max(0, created.pending - 1);
              created.lastActivity = Date.now();
            });
            origOpen.apply(this, args as Parameters<typeof origOpen>);
          } as typeof origOpen;

          const patchedSend = function (
            this: XMLHttpRequest,
            ...args: Parameters<typeof origSend>
          ) {
            created.pending++;
            created.lastActivity = Date.now();
            origSend.apply(this, args);
          } as typeof origSend;

          const patchedFetch = function (...args: Parameters<typeof origFetch>) {
            created.pending++;
            created.lastActivity = Date.now();
            return origFetch.apply(window, args).finally(() => {
              created.pending = Math.max(0, created.pending - 1);
              created.lastActivity = Date.now();
            });
          } as typeof origFetch;

          created.patchedOpen = patchedOpen;
          created.patchedSend = patchedSend;
          created.patchedFetch = patchedFetch;

          XMLHttpRequest.prototype.open = patchedOpen;
          XMLHttpRequest.prototype.send = patchedSend;
          window.fetch = patchedFetch;

          w[SENTINEL] = created;
          state = created;
        }

        const active = state;
        active.waiters++;
        let settled = false;

        const timer = window.setInterval(() => {
          const elapsed = Date.now() - active.lastActivity;
          if (active.pending === 0 && elapsed >= IDLE_THRESHOLD) {
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
          active.waiters = Math.max(0, active.waiters - 1);
          // Only the last waiter restores the originals, and only if our patched
          // functions are still the current references — never clobber a wrapper
          // some other code installed on top of ours.
          if (active.waiters === 0) {
            if (window.fetch === active.patchedFetch) {
              window.fetch = active.origFetch;
            }
            if (XMLHttpRequest.prototype.open === active.patchedOpen) {
              XMLHttpRequest.prototype.open = active.origOpen;
            }
            if (XMLHttpRequest.prototype.send === active.patchedSend) {
              XMLHttpRequest.prototype.send = active.origSend;
            }
            // Clear the sentinel so the next call re-installs from real originals
            // (assigning undefined rather than `delete` per no-dynamic-delete).
            w[SENTINEL] = undefined;
          }
          resolve(result);
        }
      });
    },
    args: [timeoutMs],
  });

  const firstResult = results[0];
  return firstResult?.result === true;
}
