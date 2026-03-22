import type {
  PopupToSWMessage,
  StateResponse,
  LogResponse,
  ExportResponse,
  ExtractionRunResponse,
  HealthResponse,
  TemplateStatusesResponse,
} from "../types/messages";
import type { TemplateCatalogResponse } from "../types/template-registry";
import type { Template } from "../types/entities";
import type { ScriptRunResult } from "../types/script-run";
import type { InstalledTemplateRecord } from "../storage/keys";

/** Response type mapping: message type → expected response */
interface ResponseMap {
  GET_STATE: StateResponse;
  GET_LOG: LogResponse;
  SCRIPT_SAVE: { ok: boolean };
  SCRIPT_DELETE: { ok: boolean };
  SCRIPT_TOGGLE: { ok: boolean };
  SCRIPT_RUN_NOW: ScriptRunResult;
  SHORTCUT_SAVE: { ok: boolean };
  SHORTCUT_DELETE: { ok: boolean };
  SHORTCUT_TOGGLE: { ok: boolean };
  CSS_RULE_SAVE: { ok: boolean };
  CSS_RULE_DELETE: { ok: boolean };
  SETTINGS_UPDATE: { ok: boolean };
  CLEAR_LOG: { ok: boolean };
  FLOW_SAVE: { ok: boolean };
  FLOW_DELETE: { ok: boolean };
  FLOW_RUN_NOW: { ok: boolean; error?: string };
  EXTRACTION_RULE_SAVE: { ok: boolean };
  EXTRACTION_RULE_DELETE: { ok: boolean };
  EXTRACTION_RUN_NOW: ExtractionRunResponse;
  EXTRACTION_TEST: ExtractionRunResponse;
  EXTRACTION_SHOW_TAB: { ok: boolean };
  PROFILE_SAVE: { ok: boolean };
  PROFILE_DELETE: { ok: boolean };
  PROFILE_SWITCH: { ok: boolean };
  IMPORT_CONFIG: { ok: boolean };
  EXPORT_CONFIG: ExportResponse;
  INSTALL_TEMPLATE: { ok: boolean; error?: string };
  UPDATE_TEMPLATE: { ok: boolean; error?: string; newVersion?: string };
  UNINSTALL_TEMPLATE: { ok: boolean; error?: string };
  RESET_TEMPLATE: { ok: boolean; error?: string };
  GET_INSTALLED_TEMPLATES: { installed: Record<string, InstalledTemplateRecord> };
  FETCH_TEMPLATE_CATALOG: TemplateCatalogResponse;
  FETCH_SINGLE_TEMPLATE: { ok: boolean; template?: Template; error?: string };
  GET_TEMPLATE_STATUSES: TemplateStatusesResponse;
  START_RECORDING_POPUP: undefined;
  STOP_RECORDING_POPUP: undefined;
  VARIABLE_SAVE: { ok: boolean };
  VARIABLE_DELETE: { ok: boolean };
  LIBRARY_SAVE: { ok: boolean };
  LIBRARY_DELETE: { ok: boolean };
  NETWORK_RULE_SAVE: { ok: boolean };
  NETWORK_RULE_DELETE: { ok: boolean };
  FORM_FILL_SAVE: { ok: boolean };
  FORM_FILL_DELETE: { ok: boolean };
  FORM_FILL_RUN: { ok: boolean; error?: string };
  NOTIFICATION_RULE_SAVE: { ok: boolean };
  NOTIFICATION_RULE_DELETE: { ok: boolean };
  GET_HEALTH: HealthResponse;
  PICK_ELEMENT_POPUP: { ok: boolean };
  TEST_SELECTOR_POPUP: { ok: boolean; matchCount: number };
  CLEAR_TEST_HIGHLIGHT_POPUP: { ok: boolean };
}

/**
 * Compile-time check: every PopupToSWMessage["type"] must have an entry in ResponseMap.
 * If a new message type is added to PopupToSWMessage without a corresponding ResponseMap
 * entry, this line will produce a type error.
 */
type AssertResponseMapComplete = {
  [K in PopupToSWMessage["type"]]: K extends keyof ResponseMap ? true : never;
};
/** @internal Causes a compile error if ResponseMap is missing a message type */
export type { AssertResponseMapComplete as _ResponseMapCheck };

type MessageResponse<TMsg extends PopupToSWMessage> = TMsg["type"] extends keyof ResponseMap
  ? ResponseMap[TMsg["type"]]
  : never;

/**
 * Send a typed message from popup/options to the service worker.
 * Returns the typed response based on the message type.
 */
export async function sendToBackground<TMsg extends PopupToSWMessage>(
  message: TMsg,
): Promise<MessageResponse<TMsg>> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Send a message to a specific tab's content script.
 */
export async function sendToTab(tabId: number, message: unknown): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}
