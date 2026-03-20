import { localStore } from "@/shared/storage";
import { appendLogEntry } from "@/background/handlers/log-handler";
import { inlineDeepQuery, inlineDeepQueryAll } from "@/shared/deep-query-snippet";
import type { EntityId, ExtractionRule, ExtractionField } from "@/shared/types/entities";

/**
 * Run an extraction rule on a specific tab: load the rule, inject
 * extraction script, collect and format results.
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
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: extractData,
      args: [rule.fields],
    });

    const rawData = results[0]?.result;
    const data = rawData ?? [];
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
 * The function injected into the page to extract data based on field definitions.
 * Uses shadow-DOM-aware query helpers so selectors reach Web Components.
 */
function extractData(fields: ExtractionField[]): Record<string, unknown>[] {
  // Inline deep query helpers (injected functions can't import modules)
  const qsDeep = inlineDeepQuery;
  const qsaDeep = inlineDeepQueryAll;

  // Find the maximum result set size by checking "multiple" fields
  const multipleField = fields.find((f) => f.multiple);
  const elements = multipleField ? qsaDeep(multipleField.selector) : null;

  const rowCount = elements ? elements.length : 1;
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.multiple) {
        const els = qsaDeep(field.selector);
        const el = els[i];
        row[field.name] = el
          ? ((field.attribute ? el.getAttribute(field.attribute) : el.textContent) ?? null)
          : null;
      } else {
        const el = qsDeep(field.selector);
        row[field.name] = el
          ? ((field.attribute ? el.getAttribute(field.attribute) : el.textContent) ?? null)
          : null;
      }
    }
    results.push(row);
  }

  return results;
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
