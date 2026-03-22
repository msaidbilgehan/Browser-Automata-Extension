import type { Template } from "./entities";

/** Entry in the remote template registry (templates.json on GitHub) */
export interface TemplateRegistryEntry {
  version: string;
  url: string;
}

/** The remote registry maps template slug → entry */
export type TemplateRegistry = Record<string, TemplateRegistryEntry>;

/** A template with its registry metadata attached */
export interface RemoteTemplate {
  slug: string;
  minVersion: string;
  compatible: boolean;
  template: Template | null;
}

/** Response from fetching the full template catalog */
export interface TemplateCatalogResponse {
  ok: boolean;
  error?: string;
  templates?: RemoteTemplate[];
}

/** File format of each individual template JSON */
export interface TemplateFile {
  _format: "browser-automata-export";
  _schemaVersion: number;
  _exportedAt: string;
  _includesSecrets: boolean;
  templates: Template[];
}
