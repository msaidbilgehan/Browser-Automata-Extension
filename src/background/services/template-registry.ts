import type { Template } from "@/shared/types/entities";
import type {
  TemplateRegistry,
  TemplateFile,
  RemoteTemplate,
  TemplateCatalogResponse,
} from "@/shared/types/template-registry";

const REGISTRY_URL =
  "https://raw.githubusercontent.com/msaidbilgehan/Browser-Automata-Extension/refs/heads/master/Templates/templates.json";

/** Get the current app version from the extension manifest */
function getAppVersion(): string {
  return chrome.runtime.getManifest().version;
}

/** Check if the app version satisfies a semver constraint like ">=0.2.1" */
function satisfiesVersion(appVersion: string, constraint: string): boolean {
  const match = constraint.match(/^(>=?|<=?|=)?(\d+\.\d+\.\d+)$/);
  if (!match) return false;

  const operator = match[1] ?? ">=";
  const required = match[2];
  if (!required) return false;

  const toNum = (v: string): [number, number, number] => {
    const parts = v.split(".").map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };

  const app = toNum(appVersion);
  const req = toNum(required);

  const compare = (): number => {
    for (let i = 0; i < 3; i++) {
      const a = app[i] ?? 0;
      const r = req[i] ?? 0;
      if (a > r) return 1;
      if (a < r) return -1;
    }
    return 0;
  };

  const cmp = compare();
  switch (operator) {
    case ">=": return cmp >= 0;
    case ">":  return cmp > 0;
    case "<=": return cmp <= 0;
    case "<":  return cmp < 0;
    case "=":  return cmp === 0;
    default:   return cmp >= 0;
  }
}

/** Fetch the template registry index from GitHub */
async function fetchRegistry(): Promise<TemplateRegistry> {
  const response = await fetch(REGISTRY_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch template registry: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<TemplateRegistry>;
}

/** Fetch a single template file from its URL */
async function fetchTemplateFile(url: string): Promise<Template[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
  }
  const file = (await response.json()) as TemplateFile;
  return file.templates;
}

/**
 * Fetch the full template catalog: registry + all individual templates.
 */
export async function fetchTemplateCatalog(): Promise<TemplateCatalogResponse> {
  const appVersion = getAppVersion();

  try {
    const registry = await fetchRegistry();
    const slugs = Object.keys(registry);

    const results: RemoteTemplate[] = await Promise.all(
      slugs.map(async (slug) => {
        const entry = registry[slug];
        if (!entry) {
          return { slug, minVersion: "unknown", compatible: false, template: null };
        }

        const compatible = satisfiesVersion(appVersion, entry.version);
        if (!compatible) {
          return { slug, minVersion: entry.version, compatible, template: null };
        }

        try {
          const templates = await fetchTemplateFile(entry.url);
          const template = templates[0] ?? null;
          return {
            slug,
            minVersion: entry.version,
            compatible,
            template,
            contentHash: entry.contentHash,
            updatedAt: entry.updatedAt,
          };
        } catch {
          return { slug, minVersion: entry.version, compatible, template: null };
        }
      }),
    );

    return { ok: true, templates: results };
  } catch {
    return { ok: false, templates: [], error: "Failed to fetch template catalog. Check your network connection." };
  }
}

/**
 * Fetch a single template by slug from the remote registry.
 */
export async function fetchSingleTemplate(
  slug: string,
): Promise<{ ok: boolean; template?: Template; error?: string }> {
  try {
    const registry = await fetchRegistry();
    const entry = registry[slug];
    if (!entry) {
      return { ok: false, error: `Template "${slug}" not found in registry` };
    }

    const appVersion = getAppVersion();
    if (!satisfiesVersion(appVersion, entry.version)) {
      return {
        ok: false,
        error: `Template requires app version ${entry.version}, current is ${appVersion}`,
      };
    }

    const templates = await fetchTemplateFile(entry.url);
    const template = templates[0];
    if (!template) {
      return { ok: false, error: "Template file is empty" };
    }

    return { ok: true, template };
  } catch {
    return { ok: false, error: `Failed to fetch template "${slug}". Check your network connection.` };
  }
}
