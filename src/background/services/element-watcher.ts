import { generateId } from "@/shared/utils";
import { inlineDeepQuery } from "@/shared/deep-query-snippet";

interface WatcherEntry {
  watchId: string;
  tabId: number;
  selector: string;
  callback: (found: boolean) => void;
}

/** Registry of active watchers keyed by watch ID */
const activeWatchers = new Map<string, WatcherEntry>();

/**
 * Start watching for an element matching `selector` on the given tab.
 * Injects a MutationObserver via content script. Returns a watch ID
 * that can be used to stop watching.
 */
export function startWatching(
  tabId: number,
  selector: string,
  callback: (found: boolean) => void,
): string {
  const watchId = generateId() as unknown as string;

  const entry: WatcherEntry = { watchId, tabId, selector, callback };
  activeWatchers.set(watchId, entry);

  // Inject the observer script into the tab
  void chrome.scripting
    .executeScript({
      target: { tabId },
      func: injectMutationObserver,
      args: [selector, watchId],
    })
    .then((results) => {
      const first = results[0];
      if (first?.result === true) {
        const watcher = activeWatchers.get(watchId);
        if (watcher) {
          watcher.callback(true);
        }
      }
    })
    .catch(() => {
      // Tab may have been closed or injection failed
      activeWatchers.delete(watchId);
    });

  // Listen for messages from the injected content script
  const messageListener = (message: { type: string; watchId: string; found: boolean }) => {
    if (message.type === "ELEMENT_WATCHER_UPDATE" && message.watchId === watchId) {
      const watcher = activeWatchers.get(watchId);
      if (watcher) {
        watcher.callback(message.found);
      }
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // Store cleanup reference on the entry so stopWatching can remove it
  watcherListeners.set(watchId, messageListener);

  return watchId;
}

/**
 * Stop watching for a given watch ID and clean up resources.
 */
export function stopWatching(watchId: string): void {
  const entry = activeWatchers.get(watchId);
  if (entry) {
    // Inject cleanup script to disconnect observer
    void chrome.scripting
      .executeScript({
        target: { tabId: entry.tabId },
        func: disconnectObserver,
        args: [watchId],
      })
      .catch(() => {
        // Tab may already be closed
      });
  }

  activeWatchers.delete(watchId);

  const listener = watcherListeners.get(watchId);
  if (listener) {
    chrome.runtime.onMessage.removeListener(listener);
    watcherListeners.delete(watchId);
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────

/** Map of watchId -> message listener for cleanup */
const watcherListeners = new Map<
  string,
  (
    message: { type: string; watchId: string; found: boolean },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => void
>();

/**
 * Injected into the page. Sets up a MutationObserver watching for `selector`.
 * Sends a message back to the extension when the element is found or removed.
 * Returns true immediately if the element already exists.
 */
function injectMutationObserver(selector: string, watchId: string): boolean {
  const qsDeep = inlineDeepQuery;
  const existing = qsDeep(selector);

  // Store the observer on window so we can disconnect later
  const observerKey = `__ba_watcher_${watchId}`;

  const observer = new MutationObserver(() => {
    const found = qsDeep(selector) !== null;
    void chrome.runtime.sendMessage({
      type: "ELEMENT_WATCHER_UPDATE",
      watchId,
      found,
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  (window as unknown as Record<string, unknown>)[observerKey] = observer;

  return existing !== null;
}

/**
 * Injected into the page to disconnect a previously created observer.
 */
function disconnectObserver(watchId: string): void {
  const observerKey = `__ba_watcher_${watchId}`;
  const observer = (window as unknown as Record<string, unknown>)[observerKey];
  if (observer && typeof (observer as MutationObserver).disconnect === "function") {
    (observer as MutationObserver).disconnect();
  }
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete (window as unknown as Record<string, unknown>)[observerKey];
}
