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
 */
function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab ${String(tabId)} load timed out after 30s`));
    }, 30_000);

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}
