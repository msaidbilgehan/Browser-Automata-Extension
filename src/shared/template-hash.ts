import type { Template } from "./types/entities";

/**
 * Recursively sort object keys for deterministic JSON serialization.
 * Arrays preserve order (order is semantically meaningful).
 */
function sortedReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

/**
 * Compute a SHA-256 hex digest from an arbitrary string.
 * Uses the Web Crypto API (available in service workers and extension pages).
 */
async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Strip the `enabled` field from each entity in an array.
 * The enabled/disabled toggle is a user-local preference and must not
 * affect the content hash – otherwise toggling causes a false "modified" status.
 */
function stripEnabled<T>(entities: T[] | undefined): T[] | undefined {
  if (!entities) return undefined;
  return entities.map((e) => {
    if (typeof e === "object" && e !== null && "enabled" in e) {
      const { enabled: _enabled, ...rest } = e as Record<string, unknown>;
      void _enabled;
      return rest as T;
    }
    return e;
  });
}

/**
 * Extract only the functional content fields from a template,
 * stripping volatile metadata (id, meta, timestamps) and the
 * `enabled` toggle that don't affect the installed entities.
 */
function extractContentPayload(template: Template): Record<string, unknown> {
  return {
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags,
    author: template.author,
    scripts: stripEnabled(template.scripts),
    shortcuts: stripEnabled(template.shortcuts),
    cssRules: stripEnabled(template.cssRules),
    flows: stripEnabled(template.flows),
    extractionRules: stripEnabled(template.extractionRules),
    networkRules: stripEnabled(template.networkRules),
  };
}

/**
 * Compute a deterministic SHA-256 content hash for a template.
 * Covers all functional content (scripts, shortcuts, cssRules, flows,
 * extractionRules, networkRules, name, description, category, tags, author).
 * Excludes: id, meta (timestamps, templateVersion).
 */
export async function computeTemplateContentHash(template: Template): Promise<string> {
  const payload = extractContentPayload(template);
  const canonical = JSON.stringify(payload, sortedReplacer);
  return sha256Hex(canonical);
}

/**
 * Compute a content hash from raw entity arrays belonging to a template.
 * Used to detect local modifications by re-hashing current stored entities
 * and comparing against the hash computed at install time.
 *
 * Each entity is stripped of `id`, `meta`, and `templateId` before hashing
 * to match what `computeTemplateContentHash` produces.
 */
export async function computeLocalEntitiesHash(entities: {
  name: string;
  description: string;
  category: string;
  tags: string[];
  author?: string | undefined;
  scripts?: Record<string, unknown>[] | undefined;
  shortcuts?: Record<string, unknown>[] | undefined;
  cssRules?: Record<string, unknown>[] | undefined;
  flows?: Record<string, unknown>[] | undefined;
  extractionRules?: Record<string, unknown>[] | undefined;
  networkRules?: Record<string, unknown>[] | undefined;
}): Promise<string> {
  const canonical = JSON.stringify(entities, sortedReplacer);
  return sha256Hex(canonical);
}
