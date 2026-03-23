import { localStore } from "@/shared/storage";
import { generateId, now } from "@/shared/utils";
import { fetchSingleTemplate } from "./template-registry";
import { computeTemplateContentHash, computeLocalEntitiesHash } from "@/shared/template-hash";
import type {
  Script,
  Shortcut,
  CSSRule,
  Flow,
  ExtractionRule,
  NetworkRule,
  Template,
  EntityMeta,
  ISOTimestamp,
} from "@/shared/types/entities";
import type { InstalledTemplateRecord } from "@/shared/storage/keys";

/**
 * Install entities from a resolved Template object.
 */
async function installFromTemplate(
  template: Template,
): Promise<{ ok: boolean; error?: string }> {
  const timestamp = now();
  const meta: EntityMeta = { createdAt: timestamp, updatedAt: timestamp };
  const tplId = template.id;

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
            templateId: tplId,
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
            templateId: tplId,
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
            templateId: tplId,
          };
          updated[id] = cssRule;
        }
        return updated;
      },
      {},
    );
  }

  // Install flows from template
  if (template.flows && template.flows.length > 0) {
    await localStore.update(
      "flows",
      (flows) => {
        const updated = { ...flows };
        for (const partial of template.flows ?? []) {
          const id = generateId();
          const flow: Flow = {
            ...partial,
            id,
            meta,
            templateId: tplId,
          };
          updated[id] = flow;
        }
        return updated;
      },
      {},
    );
  }

  // Install extraction rules from template
  if (template.extractionRules && template.extractionRules.length > 0) {
    await localStore.update(
      "extractionRules",
      (rules) => {
        const updated = { ...rules };
        for (const partial of template.extractionRules ?? []) {
          const id = generateId();
          const rule: ExtractionRule = {
            ...partial,
            id,
            meta,
            templateId: tplId,
          };
          updated[id] = rule;
        }
        return updated;
      },
      {},
    );
  }

  // Install network rules from template
  if (template.networkRules && template.networkRules.length > 0) {
    await localStore.update(
      "networkRules",
      (rules) => {
        const updated = { ...rules };
        for (const partial of template.networkRules ?? []) {
          const id = generateId();
          const rule: NetworkRule = {
            ...partial,
            id,
            meta,
            templateId: tplId,
          };
          updated[id] = rule;
        }
        return updated;
      },
      {},
    );
  }

  // Compute content hash and track installed template
  const contentHash = await computeTemplateContentHash(template);
  await trackInstalledTemplate(template.id, template.meta.templateVersion, timestamp, contentHash, template.name);

  return { ok: true };
}

/**
 * Save or update the installed template record.
 */
async function trackInstalledTemplate(
  templateId: string,
  templateVersion: string,
  timestamp: ISOTimestamp,
  contentHash: string,
  templateName?: string,
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
        contentHash,
        templateName: templateName ?? existing?.templateName,
      };
      return { ...records, [templateId]: record };
    },
    {},
  );
}

/**
 * Remove scripts belonging to a template.
 */
async function removeScriptsByTemplateId(templateId: string): Promise<void> {
  await localStore.update(
    "scripts",
    (scripts) => {
      const updated = { ...scripts };
      for (const [id, script] of Object.entries(updated)) {
        if (script.templateId === templateId) delete updated[id];
      }
      return updated;
    },
    {},
  );
}

/**
 * Remove shortcuts belonging to a template.
 */
async function removeShortcutsByTemplateId(templateId: string): Promise<void> {
  await localStore.update(
    "shortcuts",
    (shortcuts) => {
      const updated = { ...shortcuts };
      for (const [id, shortcut] of Object.entries(updated)) {
        if (shortcut.templateId === templateId) delete updated[id];
      }
      return updated;
    },
    {},
  );
}

/**
 * Remove CSS rules belonging to a template.
 */
async function removeCssRulesByTemplateId(templateId: string): Promise<void> {
  await localStore.update(
    "cssRules",
    (cssRules) => {
      const updated = { ...cssRules };
      for (const [id, rule] of Object.entries(updated)) {
        if (rule.templateId === templateId) delete updated[id];
      }
      return updated;
    },
    {},
  );
}

/**
 * Remove flows belonging to a template.
 */
async function removeFlowsByTemplateId(templateId: string): Promise<void> {
  await localStore.update(
    "flows",
    (flows) => {
      const updated = { ...flows };
      for (const [id, flow] of Object.entries(updated)) {
        if (flow.templateId === templateId) delete updated[id];
      }
      return updated;
    },
    {},
  );
}

/**
 * Remove extraction rules belonging to a template.
 */
async function removeExtractionRulesByTemplateId(templateId: string): Promise<void> {
  await localStore.update(
    "extractionRules",
    (rules) => {
      const updated = { ...rules };
      for (const [id, rule] of Object.entries(updated)) {
        if (rule.templateId === templateId) delete updated[id];
      }
      return updated;
    },
    {},
  );
}

/**
 * Remove network rules belonging to a template.
 */
async function removeNetworkRulesByTemplateId(templateId: string): Promise<void> {
  await localStore.update(
    "networkRules",
    (rules) => {
      const updated = { ...rules };
      for (const [id, rule] of Object.entries(updated)) {
        if (rule.templateId === templateId) delete updated[id];
      }
      return updated;
    },
    {},
  );
}

/**
 * Remove all entities that were installed from a specific template.
 */
async function removeTemplateEntities(templateId: string): Promise<void> {
  await Promise.all([
    removeScriptsByTemplateId(templateId),
    removeShortcutsByTemplateId(templateId),
    removeCssRulesByTemplateId(templateId),
    removeFlowsByTemplateId(templateId),
    removeExtractionRulesByTemplateId(templateId),
    removeNetworkRulesByTemplateId(templateId),
  ]);
}

/**
 * Resolve a template by ID from the remote registry.
 */
async function resolveTemplate(
  templateId: string,
): Promise<{ template: Template | null; error?: string }> {
  const slug = templateId.startsWith("tpl-") ? templateId.slice(4) : templateId;

  const remote = await fetchSingleTemplate(slug);
  if (remote.ok && remote.template) {
    return { template: remote.template };
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
 * Reset a locally modified template: removes modified entities and reinstalls from source.
 */
export async function resetTemplate(
  templateId: string,
): Promise<{ ok: boolean; error?: string }> {
  const installed = await getInstalledTemplates();
  if (!installed[templateId]) {
    return { ok: false, error: "Template is not installed" };
  }

  const resolved = await resolveTemplate(templateId);
  if (!resolved.template) {
    return { ok: false, error: resolved.error ?? "Template not found" };
  }

  await removeTemplateEntities(templateId);
  return installFromTemplate(resolved.template);
}

/**
 * Uninstall a template: remove all its entities AND the installed record.
 */
export async function uninstallTemplate(
  templateId: string,
): Promise<{ ok: boolean; error?: string }> {
  const installed = await getInstalledTemplates();
  if (!installed[templateId]) {
    return { ok: false, error: "Template is not installed" };
  }

  // Remove all entities belonging to this template
  await removeTemplateEntities(templateId);

  // Remove the installed template record
  await localStore.update(
    "installedTemplates",
    (records) => {
      const updated = { ...records };
      delete updated[templateId];
      return updated;
    },
    {},
  );

  return { ok: true };
}

/**
 * Return all installed template records (for update detection in the popup).
 */
export async function getInstalledTemplates(): Promise<Record<string, InstalledTemplateRecord>> {
  return (await localStore.get("installedTemplates")) ?? {};
}

/**
 * Compute the local content hash for entities belonging to a specific template.
 * Reconstructs a payload matching the shape used by computeTemplateContentHash,
 * then hashes it for comparison.
 */
/**
 * Check whether any entities belonging to a template still exist in storage.
 * Returns `true` if at least one entity with the given templateId is found.
 */
export async function hasTemplateEntities(templateId: string): Promise<boolean> {
  const [scripts, shortcuts, cssRules, flows, extractionRules, networkRules] = await Promise.all([
    localStore.get("scripts").then((s) => s ?? {}),
    localStore.get("shortcuts").then((s) => s ?? {}),
    localStore.get("cssRules").then((s) => s ?? {}),
    localStore.get("flows").then((s) => s ?? {}),
    localStore.get("extractionRules").then((s) => s ?? {}),
    localStore.get("networkRules").then((s) => s ?? {}),
  ]);

  return (
    Object.values(scripts).some((s) => s.templateId === templateId) ||
    Object.values(shortcuts).some((s) => s.templateId === templateId) ||
    Object.values(cssRules).some((s) => s.templateId === templateId) ||
    Object.values(flows).some((s) => s.templateId === templateId) ||
    Object.values(extractionRules).some((s) => s.templateId === templateId) ||
    Object.values(networkRules).some((s) => s.templateId === templateId)
  );
}

export async function computeLocalHash(
  templateId: string,
  templateMeta: { name: string; description: string; category: string; tags: string[]; author?: string | undefined },
): Promise<string> {
  const [scripts, shortcuts, cssRules, flows, extractionRules, networkRules] = await Promise.all([
    localStore.get("scripts").then((s) => s ?? {}),
    localStore.get("shortcuts").then((s) => s ?? {}),
    localStore.get("cssRules").then((s) => s ?? {}),
    localStore.get("flows").then((s) => s ?? {}),
    localStore.get("extractionRules").then((s) => s ?? {}),
    localStore.get("networkRules").then((s) => s ?? {}),
  ]);

  // Filter entities belonging to this template, strip id/meta/templateId
  const stripEntity = <T extends { id: unknown; meta: unknown; templateId?: unknown; enabled?: unknown }>(
    entity: T,
  ): Omit<T, "id" | "meta" | "templateId" | "enabled"> => {
    const { id: _id, meta: _meta, templateId: _tid, enabled: _enabled, ...rest } = entity;
    return rest as Omit<T, "id" | "meta" | "templateId" | "enabled">;
  };

  const tplScripts = Object.values(scripts)
    .filter((s) => s.templateId === templateId)
    .map(stripEntity);
  const tplShortcuts = Object.values(shortcuts)
    .filter((s) => s.templateId === templateId)
    .map(stripEntity);
  const tplCssRules = Object.values(cssRules)
    .filter((s) => s.templateId === templateId)
    .map(stripEntity);
  const tplFlows = Object.values(flows)
    .filter((s) => s.templateId === templateId)
    .map(stripEntity);
  const tplExtractionRules = Object.values(extractionRules)
    .filter((s) => s.templateId === templateId)
    .map(stripEntity);
  const tplNetworkRules = Object.values(networkRules)
    .filter((s) => s.templateId === templateId)
    .map(stripEntity);

  return computeLocalEntitiesHash({
    name: templateMeta.name,
    description: templateMeta.description,
    category: templateMeta.category,
    tags: templateMeta.tags,
    author: templateMeta.author,
    scripts: tplScripts.length > 0 ? tplScripts : undefined,
    shortcuts: tplShortcuts.length > 0 ? tplShortcuts : undefined,
    cssRules: tplCssRules.length > 0 ? tplCssRules : undefined,
    flows: tplFlows.length > 0 ? tplFlows : undefined,
    extractionRules: tplExtractionRules.length > 0 ? tplExtractionRules : undefined,
    networkRules: tplNetworkRules.length > 0 ? tplNetworkRules : undefined,
  });
}

