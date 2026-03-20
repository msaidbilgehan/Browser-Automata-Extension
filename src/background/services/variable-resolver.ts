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
