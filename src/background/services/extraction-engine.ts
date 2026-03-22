import { localStore, syncStore } from "@/shared/storage";
import { matchUrl } from "@/shared/url-pattern/matcher";
import { appendLogEntry } from "@/background/handlers/log-handler";
import type { EntityId, ExtractionRule, ExtractionOutputAction, ExtractionTrigger } from "@/shared/types/entities";
import { injectResultWidget, buildResultPageHtml } from "@/shared/result-display";

/** Validate extraction fields: each must have a non-empty name and selector. Returns only valid fields. */
function validateFields<T extends { name: string; selector: string }>(
  fields: T[],
): { valid: T[]; errors: string[] } {
  const valid: T[] = [];
  const errors: string[] = [];
  for (const f of fields) {
    if (typeof f.name !== "string" || f.name.trim() === "") {
      errors.push(`Field missing required "name" property`);
      continue;
    }
    if (typeof f.selector !== "string" || f.selector.trim() === "") {
      errors.push(`Field "${f.name}" missing required "selector" property`);
      continue;
    }
    valid.push(f);
  }
  return { valid, errors };
}

/**
 * Ensure the content script is available on the tab. If not, inject it
 * programmatically and retry the PING to confirm it's ready.
 */
export async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  } catch {
    const manifest = chrome.runtime.getManifest();
    const contentJs = manifest.content_scripts?.[0]?.js?.[0];
    if (!contentJs) {
      throw new Error("Content script not found in manifest");
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [contentJs],
    });
    // Wait for the content script to initialise (CRXJS uses async import)
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "PING" });
        return;
      } catch {
        if (i === maxRetries - 1) {
          throw new Error("Content script did not initialise in time");
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
}

/**
 * Run an extraction rule on a specific tab by sending EXTRACT_DATA
 * to the content script, then formatting the results.
 */
export async function runExtraction(
  ruleId: EntityId,
  tabId: number,
): Promise<{ ok: boolean; data?: Record<string, unknown>[]; formatted?: string; error?: string }> {
  const extractionRules = (await localStore.get("extractionRules")) ?? {};
  const rule = extractionRules[ruleId];

  if (!rule) {
    return { ok: false, error: "Extraction rule not found" };
  }

  try {
    // Validate fields before sending to content script
    const { valid: validFields, errors: fieldErrors } = validateFields(rule.fields);
    if (validFields.length === 0) {
      return { ok: false, error: `No valid fields: ${fieldErrors.join("; ")}` };
    }
    if (fieldErrors.length > 0) {
      console.warn(`[Browser Automata] Skipped invalid fields for rule "${rule.name}":`, fieldErrors);
    }

    await ensureContentScript(tabId);

    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- chrome.tabs.sendMessage returns `any` */
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "EXTRACT_DATA",
      ruleId,
      fields: validFields,
    });

    if (!response?.ok) {
      throw new Error("Content script returned an error");
    }

    const data: Record<string, unknown>[] = response.data ?? [];
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const formatted = formatResults(data, rule.outputFormat);

    await appendLogEntry({
      action: "extraction_completed",
      status: "success",
      entityId: rule.id,
      entityType: "extraction",
      message: `Extraction "${rule.name}" completed: ${String(data.length)} row(s)`,
      details: { rowCount: data.length, format: rule.outputFormat },
    });

    return { ok: true, data, formatted };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await appendLogEntry({
      action: "extraction_completed",
      status: "error",
      entityId: rule.id,
      entityType: "extraction",
      message: `Extraction "${rule.name}" failed`,
      error: { name: "ExtractionError", message: errorMessage },
    });
    return { ok: false, error: errorMessage };
  }
}

/**
 * Run an ad-hoc extraction test with arbitrary fields on the active tab.
 * Used by the flow editor "Test" button — no rule ID required.
 */
export async function testExtraction(
  fields: { name: string; selector: string; attribute?: string; multiple: boolean; transforms?: import("@/shared/types/entities").ExtractionFieldTransform[] }[],
  outputFormat: import("@/shared/types/entities").ExtractionRule["outputFormat"],
): Promise<{ ok: boolean; data?: Record<string, unknown>[]; formatted?: string; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: "No active tab" };

  // Validate fields before sending to content script
  const { valid: validFields, errors: fieldErrors } = validateFields(fields);
  if (validFields.length === 0) {
    return { ok: false, error: `No valid fields: ${fieldErrors.join("; ")}` };
  }

  try {
    await ensureContentScript(tab.id);

    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- chrome.tabs.sendMessage returns `any` */
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_DATA",
      ruleId: "__test__",
      fields: validFields,
    });

    if (!response?.ok) {
      return { ok: false, error: "Content script returned an error" };
    }

    const data: Record<string, unknown>[] = response.data ?? [];
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const formatted = formatResults(data, outputFormat);
    return { ok: true, data, formatted };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Normalize legacy `trigger` (string) to `triggers` (array).
 * Existing rules stored before the multi-trigger change may have `trigger`
 * instead of `triggers`. This ensures consistent array access.
 */
export function normalizeTriggers(rule: ExtractionRule): ExtractionTrigger[] {
  if (rule.triggers.length > 0) return rule.triggers;
  // Legacy fallback: single string field
  const legacy = (rule as unknown as Record<string, unknown>)["trigger"] as ExtractionTrigger | undefined;
  if (legacy) return [legacy];
  return ["manual"];
}

/**
 * Get all enabled extraction rules matching a URL with a specific trigger.
 */
export async function getMatchingExtractionRules(
  url: string,
  trigger: ExtractionTrigger,
): Promise<ExtractionRule[]> {
  // Parallel reads: settings and rules are independent
  const [settings, rulesRecord] = await Promise.all([
    syncStore.get("settings"),
    localStore.get("extractionRules"),
  ]);
  if (!settings?.globalEnabled) return [];

  const extractionRules = rulesRecord ?? {};
  return Object.values(extractionRules).filter(
    (r) => r.enabled && normalizeTriggers(r).includes(trigger) && matchUrl(r.scope, url),
  );
}

/**
 * Run all page_load extraction rules for a given tab URL.
 * Results are extracted and output actions are processed in the background.
 */
export async function runPageLoadExtractions(tabId: number, url: string): Promise<void> {
  const rules = await getMatchingExtractionRules(url, "page_load");
  for (const rule of rules) {
    const result = await runExtraction(rule.id, tabId);
    const data = result.data ?? [];
    if (result.ok && result.formatted && data.length > 0) {
      await processOutputActions(tabId, rule, result.formatted, data);
    }
  }
}

const FORMAT_EXTENSIONS: Record<ExtractionRule["outputFormat"], string> = {
  json: "json", csv: "csv", markdown: "md", html: "html", text: "txt", xml: "xml",
};

const FORMAT_MIME: Record<ExtractionRule["outputFormat"], string> = {
  json: "application/json", csv: "text/csv", markdown: "text/markdown",
  html: "text/html", text: "text/plain", xml: "application/xml",
};

/**
 * Process output actions for an extraction result from the service worker.
 * Handles clipboard, download, show_page, and show_tab actions.
 * The "show" action (popup panel) is skipped since the popup may not be open.
 */
export async function processOutputActions(
  tabId: number,
  rule: ExtractionRule,
  formatted: string,
  data: Record<string, unknown>[],
): Promise<void> {
  // Skip all actions if extraction returned no data
  if (data.length === 0) return;

  const actions: ExtractionOutputAction[] = rule.outputActions;

  // Copy to clipboard via content script injection
  if (actions.includes("clipboard")) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (text: string) => { void navigator.clipboard.writeText(text); },
        args: [formatted],
      });
    } catch (err) {
      console.debug("[Browser Automata] Clipboard write failed on restricted page:", err);
    }
  }

  // Download via chrome.downloads API
  if (actions.includes("download")) {
    try {
      const safeName = (rule.name || "extraction").replace(/[^a-zA-Z0-9_-]/g, "_");
      const ext = FORMAT_EXTENSIONS[rule.outputFormat];
      const mime = FORMAT_MIME[rule.outputFormat];
      const dataUrl = `data:${mime};charset=utf-8,${encodeURIComponent(formatted)}`;
      await chrome.downloads.download({
        url: dataUrl,
        filename: `${safeName}.${ext}`,
        saveAs: false,
      });
    } catch (err) {
      console.debug("[Browser Automata] Download failed:", err);
    }
  }

  // Show on page as a draggable widget
  if (actions.includes("show_page")) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: injectResultWidget,
        args: [formatted, rule.outputFormat, data.length, rule.name],
      });
    } catch (err) {
      console.debug("[Browser Automata] Page widget injection failed:", err);
    }
  }

  // Show in a new tab
  if (actions.includes("show_tab")) {
    try {
      await openResultTab(formatted, rule.outputFormat, data.length, rule.name, false);
    } catch (err) {
      console.debug("[Browser Automata] Result tab creation failed:", err);
    }
  }
}

/**
 * Open a new tab and write extraction results into it.
 * Used by both popup (via EXTRACTION_SHOW_TAB message) and background output actions.
 *
 * Stores the pre-built HTML in chrome.storage.session, then opens the extension's
 * dedicated results page which reads and renders it. This avoids the MV3 issue
 * where chrome.scripting.executeScript fails on about:blank tabs.
 */
export async function openResultTab(
  formatted: string,
  format: string,
  rowCount: number,
  name: string,
  active = false,
): Promise<void> {
  const html = buildResultPageHtml(formatted, format, rowCount, name);

  // Store the result HTML in session storage for the results page to read
  await chrome.storage.session.set({
    _resultPageData: { html, timestamp: Date.now() },
  });

  // Open the extension's dedicated result viewer page
  const resultUrl = chrome.runtime.getURL("src/results/index.html");
  await chrome.tabs.create({ active, url: resultUrl });
}

/**
 * Format extraction results into the desired output format.
 */
export function formatResults(
  data: Record<string, unknown>[],
  format: ExtractionRule["outputFormat"],
): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);

    case "csv": {
      if (data.length === 0) return "";
      const firstRow = data[0];
      if (!firstRow) return "";
      const headers = Object.keys(firstRow);
      const lines = [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((h) => {
              const raw = row[h];
              const val = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
              return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
            })
            .join(","),
        ),
      ];
      return lines.join("\n");
    }

    case "markdown": {
      if (data.length === 0) return "";
      const firstRow = data[0];
      if (!firstRow) return "";
      const headers = Object.keys(firstRow);
      const headerLine = `| ${headers.join(" | ")} |`;
      const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
      const rows = data.map(
        (row) =>
          `| ${headers
            .map((h) => {
              const v = row[h];
              return typeof v === "string" ? v : JSON.stringify(v ?? "");
            })
            .join(" | ")} |`,
      );
      return [headerLine, separatorLine, ...rows].join("\n");
    }

    case "html": {
      if (data.length === 0) return "<table></table>";
      const firstRow = data[0];
      if (!firstRow) return "<table></table>";
      const headers = Object.keys(firstRow);
      const headerHtml = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
      const rowsHtml = data
        .map(
          (row) =>
            `<tr>${headers
              .map((h) => {
                const v = row[h];
                return `<td>${typeof v === "string" ? v : JSON.stringify(v ?? "")}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("");
      return `<table>${headerHtml}${rowsHtml}</table>`;
    }

    case "text": {
      return data.map((row) => Object.values(row).join("\t")).join("\n");
    }

    case "xml": {
      const rows = data
        .map((row) => {
          const fields = Object.entries(row)
            .map(([key, val]) => {
              const s = typeof val === "string" ? val : JSON.stringify(val ?? "");
              return `  <${key}>${s}</${key}>`;
            })
            .join("\n");
          return `<row>\n${fields}\n</row>`;
        })
        .join("\n");
      return `<data>\n${rows}\n</data>`;
    }
  }
}
