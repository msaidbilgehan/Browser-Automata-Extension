import { isMessage } from "@/shared/messaging/message-types";
import { handleGetState } from "./handlers/state-handler";
import { handleSettingsUpdate } from "./handlers/settings-handler";
import {
  handleScriptSave,
  handleScriptDelete,
  handleScriptToggle,
} from "./handlers/script-handler";
import {
  handleShortcutSave,
  handleShortcutDelete,
  handleShortcutToggle,
} from "./handlers/shortcut-handler";
import { handleCSSRuleSave, handleCSSRuleDelete } from "./handlers/css-handler";
import { handleGetLog, handleClearLog } from "./handlers/log-handler";
import { runScriptNow, injectPageLoadScripts } from "./services/script-manager";
import { pushShortcutsToTab, handleShortcutExecution } from "./services/shortcut-manager";
import { injectMatchingCSS } from "./services/css-injector";
import { runPageLoadExtractions, openResultTab, testExtraction } from "./services/extraction-engine";
import { showErrorBadge } from "./services/error-surfacer";
import { handleFlowSave, handleFlowDelete, handleFlowRunNow } from "./handlers/flow-handler";
import {
  handleExtractionRuleSave,
  handleExtractionRuleDelete,
  handleExtractionRunNow,
} from "./handlers/extraction-handler";
import {
  handleProfileSave,
  handleProfileDelete,
  handleProfileSwitch,
} from "./handlers/profile-handler";
import { importConfig, exportConfig } from "./services/import-export";
import { installTemplate } from "./services/template-installer";
import { handleVariableSave, handleVariableDelete } from "./handlers/variable-handler";
import { handleLibrarySave, handleLibraryDelete } from "./handlers/library-handler";
import { handleNetworkRuleSave, handleNetworkRuleDelete } from "./handlers/network-handler";
import {
  handleFormFillSave,
  handleFormFillDelete,
  handleFormFillRun,
} from "./handlers/form-fill-handler";
import {
  handleNotificationRuleSave,
  handleNotificationRuleDelete,
} from "./handlers/notification-handler";
import { getHealthMetrics } from "./services/health-monitor";
import type { Message } from "@/shared/types/messages";

/**
 * Route an incoming message to the appropriate handler.
 * Returns the response to send back, or undefined if no handler matched.
 * Each handler dispatch is wrapped in try-catch to return structured errors.
 */
async function routeMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  try {
    return await dispatchMessage(message, sender);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Browser Automata] Handler error for ${message.type}:`, err);
    return { ok: false, error: errorMsg };
  }
}

async function dispatchMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case "GET_STATE":
      return handleGetState();

    case "SETTINGS_UPDATE":
      return handleSettingsUpdate(message.settings);

    case "SCRIPT_SAVE":
      return handleScriptSave(message.script);

    case "SCRIPT_DELETE":
      return handleScriptDelete(message.scriptId);

    case "SCRIPT_TOGGLE":
      return handleScriptToggle(message.scriptId, message.enabled);

    case "SCRIPT_RUN_NOW": {
      const result = await runScriptNow(message.scriptId);
      if (!result.ok) {
        await showErrorBadge();
      }
      return result;
    }

    case "SHORTCUT_SAVE":
      return handleShortcutSave(message.shortcut);

    case "SHORTCUT_DELETE":
      return handleShortcutDelete(message.shortcutId);

    case "SHORTCUT_TOGGLE":
      return handleShortcutToggle(message.shortcutId, message.enabled);

    case "CSS_RULE_SAVE":
      return handleCSSRuleSave(message.cssRule);

    case "CSS_RULE_DELETE":
      return handleCSSRuleDelete(message.cssRuleId);

    case "GET_LOG":
      return handleGetLog(message.filters);

    case "CLEAR_LOG":
      return handleClearLog();

    case "CONTENT_READY": {
      const tabId = sender.tab?.id;
      if (tabId) {
        if (message.isRetry) {
          // Retries only need to re-push shortcuts — skip scripts, CSS, and extractions
          await pushShortcutsToTab(tabId, message.url);
        } else {
          // First load: inject scripts, CSS, push shortcuts, and run page_load extractions
          await Promise.all([
            injectPageLoadScripts(tabId, message.url),
            injectMatchingCSS(tabId, message.url),
            pushShortcutsToTab(tabId, message.url),
            runPageLoadExtractions(tabId, message.url),
          ]);
        }
      }
      return undefined;
    }

    case "SHORTCUT_FIRED":
      await handleShortcutExecution(message.shortcutId, sender);
      return undefined;

    // ─── Phase 3: Flow messages ────────────────────────────────────────
    case "FLOW_SAVE":
      return handleFlowSave(message.flow);

    case "FLOW_DELETE":
      return handleFlowDelete(message.flowId);

    case "FLOW_RUN_NOW":
      return handleFlowRunNow(message.flowId);

    // ─── Phase 3: Extraction messages ──────────────────────────────────
    case "EXTRACTION_RULE_SAVE":
      return handleExtractionRuleSave(message.rule);

    case "EXTRACTION_RULE_DELETE":
      return handleExtractionRuleDelete(message.ruleId);

    case "EXTRACTION_RUN_NOW":
      return handleExtractionRunNow(message.ruleId);

    case "EXTRACTION_TEST":
      return testExtraction(message.fields, message.outputFormat);

    case "EXTRACTION_SHOW_TAB":
      await openResultTab(message.formatted, message.format, message.rowCount, message.name, true);
      return { ok: true };

    // ─── Phase 3: Profile messages ─────────────────────────────────────
    case "PROFILE_SAVE":
      return handleProfileSave(message.profile);

    case "PROFILE_DELETE":
      return handleProfileDelete(message.profileId);

    case "PROFILE_SWITCH":
      return handleProfileSwitch(message.profileId);

    // ─── Phase 3: Import/Export ────────────────────────────────────────
    case "IMPORT_CONFIG":
      return importConfig(message.data, message.strategy);

    case "EXPORT_CONFIG":
      return exportConfig();

    // ─── Phase 3: Template install ─────────────────────────────────────
    case "INSTALL_TEMPLATE":
      return installTemplate(message.templateId);

    // ─── Phase 4: Variable messages ────────────────────────────────────
    case "VARIABLE_SAVE":
      return handleVariableSave(message.variable);

    case "VARIABLE_DELETE":
      return handleVariableDelete(message.variableId);

    // ─── Phase 4: Library messages ──────────────────────────────────────
    case "LIBRARY_SAVE":
      return handleLibrarySave(message.library);

    case "LIBRARY_DELETE":
      return handleLibraryDelete(message.libraryId);

    // ─── Phase 4: Network rule messages ─────────────────────────────────
    case "NETWORK_RULE_SAVE":
      return handleNetworkRuleSave(message.rule);

    case "NETWORK_RULE_DELETE":
      return handleNetworkRuleDelete(message.ruleId);

    // ─── Phase 4: Form fill messages ────────────────────────────────────
    case "FORM_FILL_SAVE":
      return handleFormFillSave(message.profile);

    case "FORM_FILL_DELETE":
      return handleFormFillDelete(message.profileId);

    case "FORM_FILL_RUN":
      return handleFormFillRun(message.profileId);

    // ─── Phase 4: Notification rule messages ────────────────────────────
    case "NOTIFICATION_RULE_SAVE":
      return handleNotificationRuleSave(message.rule);

    case "NOTIFICATION_RULE_DELETE":
      return handleNotificationRuleDelete(message.ruleId);

    // ─── Phase 4: Health messages ───────────────────────────────────────
    case "GET_HEALTH": {
      const metrics = await getHealthMetrics();
      return { metrics };
    }

    // ─── Phase 3: Recording stubs ──────────────────────────────────────
    case "START_RECORDING_POPUP":
    case "STOP_RECORDING_POPUP":
      // TODO: implement recording in a future phase
      return undefined;

    // ─── Element picker relay (popup → content via session storage) ─────
    case "PICK_ELEMENT_POPUP": {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = activeTab?.id;
      if (!tabId) {
        return { ok: false };
      }
      // Store the pickId so ELEMENT_PICKED handler can tag the result
      await chrome.storage.session.set({ _pickId: message.pickId });
      // Ensure content script is injected, then send PICK_ELEMENT
      try {
        await chrome.tabs.sendMessage(tabId, { type: "PICK_ELEMENT" });
      } catch {
        // Content script not injected yet — inject programmatically
        // Read the content script path from the manifest so it works in both dev and production builds
        const manifest = chrome.runtime.getManifest();
        const contentJs = manifest.content_scripts?.[0]?.js?.[0];
        if (!contentJs) {
          return { ok: false };
        }
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [contentJs],
        });
        // Wait for the content script to initialize (CRXJS loader uses async import)
        const maxRetries = 10;
        for (let i = 0; i < maxRetries; i++) {
          try {
            await chrome.tabs.sendMessage(tabId, { type: "PICK_ELEMENT" });
            break;
          } catch {
            if (i === maxRetries - 1) {
              return { ok: false };
            }
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      }
      return { ok: true };
    }

    // ─── Content → SW: store picked selector in session storage ──────
    case "ELEMENT_PICKED": {
      const session = await chrome.storage.session.get("_pickId");
      const pickId = session["_pickId"] as string | undefined;
      if (pickId) {
        await chrome.storage.session.set({
          _pickedElement: {
            pickId,
            selector: message.selector,
            alternatives: message.alternatives ?? [],
          },
        });
        await chrome.storage.session.remove("_pickId");
      }
      return undefined;
    }

    case "RECORDED_ACTION":
      return undefined;

    // ─── Live selector testing relay (popup → content) ─────────────────
    case "TEST_SELECTOR_POPUP": {
      const [testTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const testTabId = testTab?.id;
      if (!testTabId) return { ok: false, matchCount: 0 };
      try {
        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- chrome.tabs.sendMessage returns `any` */
        const result = await chrome.tabs.sendMessage(testTabId, {
          type: "TEST_SELECTOR",
          selector: message.selector,
        });
        return { ok: true, matchCount: result.matchCount };
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      } catch {
        return { ok: false, matchCount: 0 };
      }
    }

    case "CLEAR_TEST_HIGHLIGHT_POPUP": {
      const [clearTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const clearTabId = clearTab?.id;
      if (!clearTabId) return { ok: false };
      try {
        await chrome.tabs.sendMessage(clearTabId, { type: "CLEAR_TEST_HIGHLIGHT" });
      } catch {
        // Content script may not be available
      }
      return { ok: true };
    }

    // ─── SW → Content messages (not handled in router) ─────────────────
    case "PING":
    case "UPDATE_SHORTCUTS":
    case "START_RECORDING":
    case "STOP_RECORDING":
    case "PICK_ELEMENT":
    case "EXTRACT_DATA":
    case "TEST_SELECTOR":
    case "CLEAR_TEST_HIGHLIGHT":
      // These are SW → content messages, not handled here
      return undefined;

    // Content → SW execution result messages (handled by execution pipeline)
    case "EXECUTION_RESULT":
    case "EXECUTION_ERROR":
      return undefined;

    default: {
      const _exhaustive: never = message;
      console.warn("[Browser Automata] Unknown message type:", _exhaustive);
      return undefined;
    }
  }
}

/**
 * Register the message router as the single onMessage listener.
 * Must be called at the top level of the service worker (synchronous registration).
 */
export function registerMessageRouter(): void {
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (!isMessage(message)) {
        return false;
      }

      void routeMessage(message, sender).then(
        (response) => {
          sendResponse(response);
        },
        (error: unknown) => {
          console.error("[Browser Automata] Message handler error:", error);
          sendResponse({ ok: false, error: String(error) });
        },
      );

      return true;
    },
  );
}
