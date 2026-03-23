/**
 * Recomputes contentHash for every template in Templates/templates.json.
 *
 * Uses the same deterministic algorithm as src/shared/template-hash.ts:
 *   SHA-256 of JSON.stringify(payload, sortedReplacer)
 * where payload = { name, description, category, tags, author, scripts,
 *                   shortcuts, cssRules, flows, extractionRules, networkRules }
 *
 * Usage:  npx tsx scripts/hash-templates.ts
 * Called automatically by the "build" npm script.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";

/* ── hash helpers (mirrors src/shared/template-hash.ts) ────────────── */

function sortedReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

interface TemplateData {
  name: string;
  description: string;
  category: string;
  tags: string[];
  author?: string;
  scripts?: unknown[];
  shortcuts?: unknown[];
  cssRules?: unknown[];
  flows?: unknown[];
  extractionRules?: unknown[];
  networkRules?: unknown[];
}

function stripEnabled(entities: unknown[] | undefined): unknown[] | undefined {
  if (!entities) return undefined;
  return entities.map((e) => {
    if (typeof e === "object" && e !== null && "enabled" in e) {
      const { enabled: _, ...rest } = e as Record<string, unknown>;
      return rest;
    }
    return e;
  });
}

function computeHash(template: TemplateData): string {
  const payload = {
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
  const canonical = JSON.stringify(payload, sortedReplacer);
  return createHash("sha256").update(canonical).digest("hex");
}

/* ── main ──────────────────────────────────────────────────────────── */

const TEMPLATES_DIR = resolve(import.meta.dirname ?? ".", "../Templates");
const REGISTRY_PATH = resolve(TEMPLATES_DIR, "templates.json");

interface RegistryEntry {
  version: string;
  url: string;
  contentHash: string;
  updatedAt: string;
}

const registry: Record<string, RegistryEntry> = JSON.parse(
  readFileSync(REGISTRY_PATH, "utf-8"),
);

const templateFiles = readdirSync(TEMPLATES_DIR).filter(
  (f) => f.endsWith(".json") && f !== "templates.json",
);

let changed = 0;

for (const file of templateFiles) {
  const slug = basename(file, ".json");
  const entry = registry[slug];
  if (!entry) {
    console.log(`  SKIP  ${slug} (not in registry)`);
    continue;
  }

  const filePath = resolve(TEMPLATES_DIR, file);
  const data = JSON.parse(readFileSync(filePath, "utf-8")) as {
    templates: TemplateData[];
  };
  const template = data.templates[0];
  if (!template) {
    console.log(`  SKIP  ${slug} (empty template file)`);
    continue;
  }

  const newHash = computeHash(template);
  if (entry.contentHash === newHash) {
    console.log(`  OK    ${slug}`);
  } else {
    console.log(`  UPDATE ${slug}  ${entry.contentHash.slice(0, 12)}… → ${newHash.slice(0, 12)}…`);
    entry.contentHash = newHash;
    changed++;
  }
}

if (changed > 0) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
  console.log(`\nUpdated ${String(changed)} hash(es) in templates.json`);
} else {
  console.log("\nAll hashes up to date.");
}
