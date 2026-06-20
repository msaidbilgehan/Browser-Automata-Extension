import { generateId } from "@/shared/utils";
import { inlineDeepQuery } from "@/shared/deep-query-snippet";

interface WatcherEntry {
  watchId: string;
  tabId: number;
  selector: string;
  callback: (found: boolean) => void;
  /** Last reported presence — used to fire the callback only on a real change. */
  lastFound: boolean;
}

/** Registry of active watchers keyed by watch ID */
const activeWatchers = new Map<string, WatcherEntry>();

/**
 * Invoke a watcher's callback only when the element's presence actually changes.
 *
 * The callback used to fire both from the injection result and the first
 * mutation message — a double `callback(true)`. Edge-detecting here means the
 * callback fires once per real transition no matter how many (possibly
 * redundant) update messages the page observer sends.
 */
function reportFound(entry: WatcherEntry, found: boolean): void {
  if (found === entry.lastFound) return;
  entry.lastFound = found;
  entry.callback(found);
}

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
  const watchId: string = generateId();

  const entry: WatcherEntry = { watchId, tabId, selector, callback, lastFound: false };
  activeWatchers.set(watchId, entry);

  // Inject the observer script into the tab. The "found" signal is driven solely
  // by the message channel below (the injected observer sends an initial message
  // when the element already exists, then one per change), so the injection
  // result is not used to fire the callback — that previously double-fired.
  void chrome.scripting
    .executeScript({
      target: { tabId },
      func: injectMutationObserver,
      args: [selector, watchId],
    })
    .catch((err: unknown) => {
      console.debug("[Browser Automata] Element watcher injection failed (tab may be closed):", err);
      activeWatchers.delete(watchId);
    });

  // Listen for messages from the injected content script
  const messageListener = (message: { type: string; watchId: string; found: boolean }) => {
    if (message.type === "ELEMENT_WATCHER_UPDATE" && message.watchId === watchId) {
      const watcher = activeWatchers.get(watchId);
      if (watcher) {
        reportFound(watcher, message.found);
      }
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // Store cleanup reference on the entry so stopWatching can remove it
  watcherListeners.set(watchId, messageListener);

  return watchId;
}

/**
 * Stop all active watchers and clean up resources.
 * Call this on flow completion or extension shutdown to prevent leaks.
 */
export function stopAllWatchers(): void {
  // Collect IDs first to avoid mutating the map during iteration
  const ids = Array.from(activeWatchers.keys());
  for (const id of ids) {
    stopWatching(id);
  }
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
      .catch((err: unknown) => {
        console.debug("[Browser Automata] Element watcher disconnect failed (tab may be closed):", err);
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
 * Sends a message to the extension when the element is present or removed —
 * including an immediate message if it already exists — so the "found" signal is
 * driven entirely by the message channel (not the injection return value).
 *
 * Self-removes on `pagehide`: the observer and its debounce timer are torn down
 * when the page is unloaded so a long-lived SPA does not keep an orphaned
 * observer posting updates to a watcher the service worker has already deleted.
 */
function injectMutationObserver(selector: string, watchId: string): void {
  const qsDeep = inlineDeepQuery;

  // Store the observer on window so we can disconnect later
  const observerKey = `__ba_watcher_${watchId}`;

  // Debounce mutation callbacks to avoid expensive DOM queries on rapid mutations
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer !== null) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const found = qsDeep(selector) !== null;
      void chrome.runtime.sendMessage({
        type: "ELEMENT_WATCHER_UPDATE",
        watchId,
        found,
      });
    }, 100);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  (window as unknown as Record<string, unknown>)[observerKey] = observer;

  // Tear down on page unload so the observer/timer do not outlive the page and
  // keep messaging a deleted watcher (SPA soft-navigations included).
  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (window as unknown as Record<string, unknown>)[observerKey];
    },
    { once: true },
  );

  // Report the initial state immediately if the element is already present.
  if (qsDeep(selector) !== null) {
    void chrome.runtime.sendMessage({
      type: "ELEMENT_WATCHER_UPDATE",
      watchId,
      found: true,
    });
  }
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
