/**
 * Shared libraries resolver (F16c).
 * Finds `// @use('lib-name')` directives in script code and prepends
 * the referenced SharedLibrary code.
 */

import { localStore } from "@/shared/storage";
import type { SharedLibrary } from "@/shared/types/entities";

/** Pattern matching `// @use('lib-name')` or `// @use("lib-name")` directives.
 *  Non-global source pattern — global instances are created per-call to avoid shared lastIndex state. */
const USE_DIRECTIVE_PATTERN = /^\/\/\s*@use\(['"]([^'"]+)['"]\)\s*$/m;

/**
 * Resolve `// @use('lib-name')` directives in `code`.
 * Each directive is replaced by the matching SharedLibrary code,
 * prepended before the rest of the script.
 */
export async function resolveLibraries(code: string): Promise<string> {
  const libRecord = await localStore.get("sharedLibraries");
  if (!libRecord) return code;

  const libraries: SharedLibrary[] = Object.values(libRecord);

  // Build a lookup by library name
  const libByName = new Map<string, SharedLibrary>();
  for (const lib of libraries) {
    libByName.set(lib.name, lib);
  }

  // Collect all referenced library names in order.
  // Create a fresh global regex per call to avoid shared lastIndex state.
  const directiveRe = new RegExp(USE_DIRECTIVE_PATTERN.source, "gm");
  const referencedNames: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = directiveRe.exec(code)) !== null) {
    const name = match[1];
    if (name !== undefined && !seen.has(name)) {
      seen.add(name);
      referencedNames.push(name);
    }
  }

  if (referencedNames.length === 0) return code;

  // Collect library code blocks to prepend
  const prependBlocks: string[] = [];
  for (const name of referencedNames) {
    const lib = libByName.get(name);
    if (lib) {
      prependBlocks.push(`/* --- SharedLibrary: ${lib.name} --- */\n${lib.code}`);
    }
  }

  // Strip directive lines from the original code (fresh regex for replace)
  const stripRe = new RegExp(USE_DIRECTIVE_PATTERN.source, "gm");
  const strippedCode = code.replace(stripRe, "").trimStart();

  if (prependBlocks.length === 0) return strippedCode;

  return prependBlocks.join("\n\n") + "\n\n" + strippedCode;
}
