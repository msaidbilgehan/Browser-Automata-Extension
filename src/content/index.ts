// Content script entry — runs on every page matching <all_urls>
// Thin shell: initializes shortcut listener and handles messages from service worker.

import { isSWToContentMessage } from "@/shared/messaging/message-types";
import type { Settings } from "@/shared/types/settings";
import { DEFAULT_SETTINGS } from "@/shared/types/settings";
import { initShortcutListener, setActiveShortcuts, getActiveShortcutCount } from "./shortcut-listener";
import { startRecording, stopRecording } from "./recorder";
import { startPicking } from "./element-picker";
import { extractFromDOM } from "./extractor";
import { highlightSelector, clearHighlights } from "./selector-tester";
import { initToast, updateToastSettings } from "./toast";
import { updateHighlightSettings } from "./action-highlight";
import { initQuickRunBar, setQuickRunActions } from "./quick-run-bar";
import { initQuickTip, showQuickTipShortcuts } from "./quick-tip";

/** Returns false when the extension has been reloaded/uninstalled and this content script is orphaned */
function isContextValid(): boolean {
  try {
    // Access chrome.runtime.id — throws if the extension context has been invalidated
    void chrome.runtime.id;
    return true;
  } catch {
    return false;
  }
}

/** Apply feedback settings to toast and highlight modules */
function applyFeedbackSettings(feedback: Settings["feedback"]): void {
  updateToastSettings(feedback.toastEnabled, feedback.toastDismissMode, feedback.toastDurationMs);
  updateHighlightSettings(feedback.highlightEnabled);
}

// Initialize shortcut keyboard listener and toast system
initShortcutListener();
initToast();
initQuickRunBar();
initQuickTip();

// Load initial feedback settings and listen for changes
if (isContextValid()) {
  chrome.storage.sync.get("settings", (result: Record<string, unknown>) => {
    const stored = result["settings"] as Partial<Settings> | undefined;
    const feedback = { ...DEFAULT_SETTINGS.feedback, ...stored?.feedback };
    applyFeedbackSettings(feedback);
  });

  chrome.storage.onChanged.addListener(
    (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "sync") return;
      const settingsChange = changes["settings"];
      if (settingsChange?.newValue !== undefined) {
        const stored = settingsChange.newValue as Partial<Settings>;
        const feedback = { ...DEFAULT_SETTINGS.feedback, ...stored.feedback };
        applyFeedbackSettings(feedback);
      }
    },
  );
}

/** Number of CONTENT_READY retries attempted */
let contentReadyRetries = 0;
/** Increased from 2 to 5: service worker wake-up can take several seconds on cold start */
const MAX_CONTENT_READY_RETRIES = 5;
const CONTENT_READY_RETRY_DELAY_MS = 500;

function init(): void {
  if (!isContextValid()) return;
  chrome.runtime.sendMessage({ type: "CONTENT_READY", url: location.href }).catch((err: unknown) => {
    console.debug("[Browser Automata] CONTENT_READY send failed (expected on first load):", err);
  });

  // After a short delay, check if shortcuts were pushed. If not, retry
  // CONTENT_READY. This handles the race condition where the service worker
  // wasn't fully ready when the first message was sent.
  scheduleRetryIfNeeded();
}

function scheduleRetryIfNeeded(): void {
  if (contentReadyRetries >= MAX_CONTENT_READY_RETRIES) return;
  setTimeout(() => {
    if (!isContextValid()) return;
    if (getActiveShortcutCount() > 0) return; // shortcuts already received
    contentReadyRetries++;
    console.debug(
      `[Browser Automata] No shortcuts received yet, retrying CONTENT_READY (attempt ${String(contentReadyRetries)})`,
    );
    chrome.runtime.sendMessage({ type: "CONTENT_READY", url: location.href, isRetry: true }).catch((err: unknown) => {
      console.debug("[Browser Automata] CONTENT_READY retry failed:", err);
    });
    scheduleRetryIfNeeded();
  }, CONTENT_READY_RETRY_DELAY_MS);
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    if (!isSWToContentMessage(message)) {
      return false;
    }
    try {
      switch (message.type) {
        case "PING":
          sendResponse({ ok: true });
          break;
        case "UPDATE_SHORTCUTS":
          setActiveShortcuts(message.shortcuts);
          break;
        case "START_RECORDING":
          startRecording();
          break;
        case "STOP_RECORDING":
          stopRecording();
          break;
        case "PICK_ELEMENT":
          startPicking();
          break;
        case "EXTRACT_DATA": {
          const results = extractFromDOM(message.fields);
          sendResponse({ ok: true, data: results });
          return true;
        }
        case "TEST_SELECTOR": {
          const matchCount = highlightSelector(message.selector);
          sendResponse({ matchCount });
          return true;
        }
        case "CLEAR_TEST_HIGHLIGHT":
          clearHighlights();
          break;
        case "UPDATE_QUICK_RUN_ACTIONS":
          setQuickRunActions(message.actions, message.matchingIds);
          break;
        case "UPDATE_QUICK_TIP_SHORTCUTS":
          showQuickTipShortcuts(message.shortcuts);
          break;
      }
    } catch (err) {
      console.error("[Browser Automata] Error handling message:", message.type, err);
      sendResponse({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
      return true;
    }
    return false;
  },
);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export {};
