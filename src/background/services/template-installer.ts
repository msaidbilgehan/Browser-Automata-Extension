import { localStore } from "@/shared/storage";
import { generateId, now } from "@/shared/utils";
import { BUNDLED_TEMPLATES } from "@/data/templates/index";
import { fetchSingleTemplate } from "./template-registry";
import type { Script, Shortcut, CSSRule, Template, EntityMeta, ISOTimestamp } from "@/shared/types/entities";
import type { InstalledTemplateRecord } from "@/shared/storage/keys";

/**
 * Install entities from a resolved Template object.
 */
async function installFromTemplate(
  template: Template,
): Promise<{ ok: boolean; error?: string }> {
  const timestamp = now();
  const meta: EntityMeta = { createdAt: timestamp, updatedAt: timestamp };

  // Install scripts from template
  if (template.scripts && template.scripts.length > 0) {
    await localStore.update(
      "scripts",
      (scripts) => {
        const updated = { ...scripts };
        for (const partial of template.scripts ?? []) {
          const id = generateId();
          const script: Script = {
            ...partial,
            id,
            meta: {
              ...meta,
              version: 1,
              tags: [],
            },
            templateId: template.id,
          };
          updated[id] = script;
        }
        return updated;
      },
      {},
    );
  }

  // Install shortcuts from template
  if (template.shortcuts && template.shortcuts.length > 0) {
    await localStore.update(
      "shortcuts",
      (shortcuts) => {
        const updated = { ...shortcuts };
        for (const partial of template.shortcuts ?? []) {
          const id = generateId();
          const shortcut: Shortcut = {
            ...partial,
            id,
            meta,
          };
          updated[id] = shortcut;
        }
        return updated;
      },
      {},
    );
  }

  // Install CSS rules from template
  if (template.cssRules && template.cssRules.length > 0) {
    await localStore.update(
      "cssRules",
      (cssRules) => {
        const updated = { ...cssRules };
        for (const partial of template.cssRules ?? []) {
          const id = generateId();
          const cssRule: CSSRule = {
            ...partial,
            id,
            meta,
          };
          updated[id] = cssRule;
        }
        return updated;
      },
      {},
    );
  }

  // Track installed template version
  await trackInstalledTemplate(template.id, template.meta.templateVersion, timestamp);

  return { ok: true };
}

/**
 * Save or update the installed template record.
 */
async function trackInstalledTemplate(
  templateId: string,
  templateVersion: string,
  timestamp: ISOTimestamp,
): Promise<void> {
  await localStore.update(
    "installedTemplates",
    (records) => {
      const existing = records[templateId];
      const record: InstalledTemplateRecord = {
        templateId,
        templateVersion,
        installedAt: existing?.installedAt ?? timestamp,
        updatedAt: timestamp,
      };
      return { ...records, [templateId]: record };
    },
    {},
  );
}

/**
 * Remove all entities that were installed from a specific template.
 */
async function removeTemplateEntities(templateId: string): Promise<void> {
  // Remove scripts linked to this template
  await localStore.update(
    "scripts",
    (scripts) => {
      const updated = { ...scripts };
      for (const [id, script] of Object.entries(updated)) {
        if (script.templateId === templateId) {
          delete updated[id];
        }
      }
      return updated;
    },
    {},
  );

  // Remove shortcuts — shortcuts don't have templateId, but we can't distinguish them.
  // For now, only scripts are tracked by templateId. Future entity types can be added here.
}

/**
 * Resolve a template by ID: try remote first, then bundled.
 */
async function resolveTemplate(
  templateId: string,
): Promise<{ template: Template | null; error?: string }> {
  const slug = templateId.startsWith("tpl-") ? templateId.slice(4) : templateId;

  // Try remote fetch first
  const remote = await fetchSingleTemplate(slug);
  if (remote.ok && remote.template) {
    return { template: remote.template };
  }

  // Fallback: check bundled templates
  const bundled = BUNDLED_TEMPLATES.find((t) => t.id === templateId);
  if (bundled) {
    return { template: bundled };
  }

  return { template: null, error: remote.error ?? "Template not found" };
}

/**
 * Install a template by ID.
 * First tries remote fetch, falls back to bundled templates.
 */
export async function installTemplate(
  templateId: string,
): Promise<{ ok: boolean; error?: string }> {
  const resolved = await resolveTemplate(templateId);
  if (!resolved.template) {
    return { ok: false, error: resolved.error ?? "Template not found" };
  }
  return installFromTemplate(resolved.template);
}

/**
 * Update an already-installed template: removes old entities, installs fresh ones.
 */
export async function updateTemplate(
  templateId: string,
): Promise<{ ok: boolean; error?: string; newVersion?: string }> {
  const resolved = await resolveTemplate(templateId);
  if (!resolved.template) {
    return { ok: false, error: resolved.error ?? "Template not found" };
  }
  const template = resolved.template;

  // Remove entities from the old version
  await removeTemplateEntities(templateId);

  // Install the new version
  const result = await installFromTemplate(template);
  if (result.ok) {
    return { ok: true, newVersion: template.meta.templateVersion };
  }
  return result;
}

/**
 * Return all installed template records (for update detection in the popup).
 */
export async function getInstalledTemplates(): Promise<Record<string, InstalledTemplateRecord>> {
  return (await localStore.get("installedTemplates")) ?? {};
}

/**
 * Return the list of available bundled templates.
 */
export function getAvailableTemplates(): Template[] {
  return BUNDLED_TEMPLATES;
}
