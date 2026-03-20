import { localStore } from "@/shared/storage";
import { generateId, now } from "@/shared/utils";
import { BUNDLED_TEMPLATES } from "@/data/templates/index";
import type { Script, Shortcut, CSSRule, Template, EntityMeta } from "@/shared/types/entities";

/**
 * Install a template: create entities with fresh IDs and save to storage.
 */
export async function installTemplate(
  templateId: string,
): Promise<{ ok: boolean; error?: string }> {
  const template = BUNDLED_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return { ok: false, error: "Template not found" };
  }

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

  return { ok: true };
}

/**
 * Return the list of available bundled templates.
 */
export function getAvailableTemplates(): Template[] {
  return BUNDLED_TEMPLATES;
}
