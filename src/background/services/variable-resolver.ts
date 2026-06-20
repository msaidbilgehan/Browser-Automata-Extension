/**
 * Variable/secrets vault resolver (F16d).
 * Replaces {{variableName}} placeholders in script code with values
 * from ScriptVariable storage, filtered by URL scope match.
 */

import { localStore } from "@/shared/storage";
import type { ScriptVariable } from "@/shared/types/entities";
import { matchUrl } from "@/shared/url-pattern/matcher";

/**
 * Replace `{{variableName}}` placeholders in `code` with matching
 * ScriptVariable values whose scope matches the given `url`.
 *
 * ⚠️ SECURITY — do not interpolate into executable source.
 * Substituting values directly into script text makes any code-shaped variable
 * value executable (injection) and risks leaking secret values into logs/errors.
 * Before this module is wired into the execution pipeline, variables MUST instead
 * be passed as bound `args` to `chrome.scripting.executeScript` (which serializes
 * them as data, never code):
 *
 *   chrome.scripting.executeScript({ target, func, args: [resolvedValues] })
 *
 * This string-replacement form is retained only for non-executable templates
 * (e.g. a URL or selector built from a trusted variable). It must never receive
 * user-controlled secret values destined for a code context.
 */
export async function resolveVariables(code: string, url: string): Promise<string> {
  const variableRecord = await localStore.get("variables");
  if (!variableRecord) return code;

  const variables: ScriptVariable[] = Object.values(variableRecord);

  // Build a lookup from key → value for variables whose scope matches the URL
  const scopedLookup = new Map<string, string>();
  for (const variable of variables) {
    if (matchUrl(variable.scope, url)) {
      scopedLookup.set(variable.key, variable.value);
    }
  }

  if (scopedLookup.size === 0) return code;

  // Replace all {{variableName}} occurrences
  return code.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const value = scopedLookup.get(name);
    return value ?? `{{${name}}}`;
  });
}
