// DOM extraction helper for EXTRACT_DATA messages.

import { querySelectorDeep, querySelectorAllDeep } from "./deep-query";
import type { ExtractionFieldTransform } from "@/shared/types/entities";

interface FieldSpec {
  name: string;
  selector: string;
  fallbackSelectors?: string[];
  attribute?: string;
  multiple: boolean;
  transforms?: ExtractionFieldTransform[];
}

function getAttributeValue(el: Element, attr: string): string {
  if (attr === "textContent") return el.textContent?.trim() ?? "";
  if (attr === "innerHTML") return el.innerHTML;
  return el.getAttribute(attr) ?? "";
}

/**
 * Apply a single transform to a string value.
 */
function applyTransform(value: string, transform: ExtractionFieldTransform): string {
  switch (transform.type) {
    case "trim":
      return value.trim();
    case "lowercase":
      return value.toLowerCase();
    case "uppercase":
      return value.toUpperCase();
    case "strip_html": {
      const tmp = document.createElement("div");
      tmp.innerHTML = value;
      return tmp.textContent ?? "";
    }
    case "normalize_url": {
      if (!value.trim()) return "";
      try {
        return new URL(value, document.baseURI).href;
      } catch {
        return value;
      }
    }
    case "normalize_whitespace":
      return value.replace(/\s+/g, " ").trim();
    case "replace":
      return value.split(transform.search).join(transform.replacement);
    case "regex_replace": {
      try {
        const re = new RegExp(transform.pattern, transform.flags);
        return value.replace(re, transform.replacement);
      } catch {
        return value;
      }
    }
  }
}

/**
 * Apply all transforms in sequence to a value.
 */
function applyTransforms(value: string, transforms: ExtractionFieldTransform[] | undefined): string {
  if (!transforms || transforms.length === 0) return value;
  let result = value;
  for (const t of transforms) {
    result = applyTransform(result, t);
  }
  return result;
}

/**
 * Build the ordered list of selectors to try: primary first, then fallbacks.
 */
function getSelectorsInOrder(field: FieldSpec): string[] {
  const selectors = [field.selector];
  if (field.fallbackSelectors && field.fallbackSelectors.length > 0) {
    for (const s of field.fallbackSelectors) {
      if (s) selectors.push(s);
    }
  }
  return selectors;
}

/**
 * Queries the DOM for each field and assembles row objects.
 *
 * For `multiple: true` fields, all matching elements are collected.
 * Single fields are broadcast to every row. Rows are padded to the
 * length of the longest multi-valued field.
 *
 * When fallbackSelectors are present, each selector is tried in order.
 * The first selector that returns a non-empty result wins.
 */
export function extractFromDOM(fields: FieldSpec[]): Record<string, string>[] {
  const fieldResults: Record<string, string[]> = {};
  let maxRows = 1;

  for (const field of fields) {
    const attr = field.attribute ?? "textContent";
    const selectors = getSelectorsInOrder(field);

    if (field.multiple) {
      // Try each selector in order; first one with results wins
      const values: string[] = [];
      for (const sel of selectors) {
        const elements = querySelectorAllDeep(sel);
        if (elements.length > 0) {
          elements.forEach((el) => {
            values.push(applyTransforms(getAttributeValue(el, attr), field.transforms));
          });
          break;
        }
      }
      fieldResults[field.name] = values;
      maxRows = Math.max(maxRows, values.length);
    } else {
      // Try each selector in order; first non-empty value wins
      let found = false;
      for (const sel of selectors) {
        const el = querySelectorDeep(sel);
        if (el) {
          const val = applyTransforms(getAttributeValue(el, attr), field.transforms);
          if (val !== "") {
            fieldResults[field.name] = [val];
            found = true;
            break;
          }
        }
      }
      if (!found) {
        fieldResults[field.name] = [""];
      }
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
