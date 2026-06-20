import { normalizeUrl } from "@/shared/utils";

/**
 * Create a new tab, wait for it to finish loading, inject a script, and
 * return the tab ID together with the execution result.
 */
export async function openTabAndExecute(
  url: string,
  scriptCode: string,
): Promise<{ tabId: number; result: unknown }> {
  const tab = await chrome.tabs.create({ url: normalizeUrl(url), active: false });
  const tabId = tab.id;
  if (tabId === undefined) {
    throw new Error("Failed to create tab: no tab ID returned");
  }

  await waitForTabLoad(tabId);
  const result = await executeOnTab(tabId, scriptCode);
  return { tabId, result };
}

/**
 * Inject and execute a script on a specific tab.
 * Returns the first frame's result value.
 */
export async function executeOnTab(tabId: number, code: string): Promise<unknown> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (injectedCode: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn: () => unknown = new Function(injectedCode) as () => unknown;
        return fn();
      } catch (err) {
        return {
          __error: true,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
    args: [code],
  });

  const first = results[0];
  return first?.result;
}

/**
 * Close a tab by ID.
 */
export async function closeTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId);
}

/**
 * Returns a promise that resolves when the given tab reaches "complete" status.
 *
 * Resolves immediately if the tab is already complete (otherwise a navigation
 * that finished before the listener attached would hang for the full timeout),
 * and rejects promptly — instead of after a 30s hang — if the tab is closed or
 * is otherwise unavailable mid-load.
 */
function waitForTabLoad(tabId: number, timeoutMs = 30_000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      action();
    };

    const timeout = setTimeout(() => {
      finish(() => {
        reject(new Error(`Tab ${String(tabId)} load timed out after ${String(timeoutMs / 1000)}s`));
      });
    }, timeoutMs);

    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo): void => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish(resolve);
      }
    };

    const onRemoved = (removedTabId: number): void => {
      if (removedTabId === tabId) {
        finish(() => {
          reject(new Error(`Tab ${String(tabId)} was closed before it finished loading`));
        });
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);

    // The tab may already be "complete" (e.g. the navigation finished before the
    // listener attached). Resolve immediately, and reject promptly if the tab is
    // gone rather than letting the unhandled rejection hang until the timeout.
    chrome.tabs.get(tabId).then(
      (tab) => {
        if (tab.status === "complete") finish(resolve);
      },
      (err: unknown) => {
        finish(() => {
          reject(err instanceof Error ? err : new Error(`Tab ${String(tabId)} is not available`));
        });
      },
    );
  });
}
