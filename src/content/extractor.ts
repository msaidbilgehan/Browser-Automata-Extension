// DOM extraction helper for EXTRACT_DATA messages.

import { querySelectorDeep, querySelectorAllDeep } from "./deep-query";

interface FieldSpec {
  name: string;
  selector: string;
  attribute?: string;
  multiple: boolean;
}

function getAttributeValue(el: Element, attr: string): string {
  if (attr === "textContent") return el.textContent?.trim() ?? "";
  if (attr === "innerHTML") return el.innerHTML;
  return el.getAttribute(attr) ?? "";
}

/**
 * Queries the DOM for each field and assembles row objects.
 *
 * For `multiple: true` fields, all matching elements are collected.
 * Single fields are broadcast to every row. Rows are padded to the
 * length of the longest multi-valued field.
 */
export function extractFromDOM(fields: FieldSpec[]): Record<string, string>[] {
  const fieldResults: Record<string, string[]> = {};
  let maxRows = 1;

  for (const field of fields) {
    const attr = field.attribute ?? "textContent";
    if (field.multiple) {
      const elements = querySelectorAllDeep(field.selector);
      const values: string[] = [];
      elements.forEach((el) => {
        values.push(getAttributeValue(el, attr));
      });
      fieldResults[field.name] = values;
      maxRows = Math.max(maxRows, values.length);
    } else {
      const el = querySelectorDeep(field.selector);
      fieldResults[field.name] = el ? [getAttributeValue(el, attr)] : [""];
    }
  }

  // Build row objects
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < maxRows; i++) {
    const row: Record<string, string> = {};
    for (const field of fields) {
      const values = fieldResults[field.name];
      row[field.name] = values?.[i] ?? "";
    }
    rows.push(row);
  }

  return rows;
}
