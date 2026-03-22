import type { Template } from "./entities";

/** Entry in the remote template registry (templates.json on GitHub) */
export interface TemplateRegistryEntry {
  version: string;
  url: string;
  /** SHA-256 content hash of the template (for update detection) */
  contentHash?: string | undefined;
  /** ISO 8601 timestamp of the last content change */
  updatedAt?: string | undefined;
}

/** The remote registry maps template slug → entry */
export type TemplateRegistry = Record<string, TemplateRegistryEntry>;

/** A template with its registry metadata attached */
export interface RemoteTemplate {
  slug: string;
  minVersion: string;
  compatible: boolean;
  template: Template | null;
  /** SHA-256 content hash from the registry (for update detection) */
  contentHash?: string | undefined;
  /** ISO 8601 timestamp of last content change from the registry */
  updatedAt?: string | undefined;
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
