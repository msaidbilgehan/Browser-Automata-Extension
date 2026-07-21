import { localStore } from "@/shared/storage";
import { DEEP_QUERY_SNIPPET } from "@/shared/deep-query-snippet";
import type { FormFillProfile, EntityId } from "@/shared/types/entities";

/**
 * Load a FormFillProfile from storage and inject a script that fills
 * each field on the target tab. Returns counts of filled and skipped fields.
 */
export async function fillForm(
  tabId: number,
  profileId: EntityId,
): Promise<{ filled: number; skipped: number }> {
  const profiles = (await localStore.get("formFillProfiles")) ?? {};
  const profile = profiles[profileId];

  if (!profile) {
    throw new Error(`FormFillProfile not found: ${profileId}`);
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: executeFill,
    args: [profile.fields, DEEP_QUERY_SNIPPET],
  });

  const first = results[0];
  if (
    first?.result &&
    typeof first.result === "object" &&
    "filled" in first.result &&
    "skipped" in first.result
  ) {
    return first.result as { filled: number; skipped: number };
  }

  return { filled: 0, skipped: profile.fields.length };
}

/**
 * Save a FormFillProfile to storage.
 */
export async function saveFillProfile(profile: FormFillProfile): Promise<void> {
  await localStore.update(
    "formFillProfiles",
    (profiles) => ({ ...profiles, [profile.id]: profile }),
    {},
  );
}

// ─── Injected function ──────────────────────────────────────────────────

interface InjectedFieldMapping {
  selector: string;
  fallbackSelectors: string[];
  value: string;
  type: "text" | "select" | "checkbox" | "radio" | "file";
}

/**
 * Injected into the page. Iterates over field mappings, tries the primary
 * selector first then fallbacks, and fills each element.
 *
 * Self-contained per `chrome.scripting.executeScript`'s `func` requirement —
 * it cannot reference an imported helper directly, so `snippet`
 * (DEEP_QUERY_SNIPPET) is passed in and eval'd to define `__qsDeep` in the page.
 */
function executeFill(
  fields: InjectedFieldMapping[],
  snippet: string,
): { filled: number; skipped: number } {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
  new Function(snippet)();
  let filled = 0;
  let skipped = 0;

  for (const field of fields) {
    const selectors = [field.selector, ...field.fallbackSelectors];
    let element: Element | null = null;

    for (const sel of selectors) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        element = (globalThis as any).__qsDeep(sel);
      } catch {
        // invalid selector syntax on this fallback — try the next one
        element = null;
      }
      if (element) break;
    }

    if (!element) {
      skipped++;
      continue;
    }

    try {
      switch (field.type) {
        case "text": {
          const input = element as HTMLInputElement | HTMLTextAreaElement;
          input.value = field.value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          break;
        }
        case "select": {
          const select = element as HTMLSelectElement;
          select.value = field.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          break;
        }
        case "checkbox": {
          const checkbox = element as HTMLInputElement;
          const shouldBeChecked = field.value === "true";
          if (checkbox.checked !== shouldBeChecked) {
            checkbox.click();
          }
          break;
        }
        case "radio": {
          const radio = element as HTMLInputElement;
          if (!radio.checked) {
            radio.click();
          }
          break;
        }
        case "file": {
          // File inputs cannot be programmatically filled for security reasons
          skipped++;
          continue;
        }
      }
      filled++;
    } catch {
      skipped++;
    }
  }

  return { filled, skipped };
}
