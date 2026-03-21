import type { EntityId, ISOTimestamp } from "./types/entities";

export function generateId(): EntityId {
  return crypto.randomUUID() as EntityId;
}

export function now(): ISOTimestamp {
  return new Date().toISOString() as ISOTimestamp;
}

/**
 * Ensures a user-supplied URL string has a protocol prefix.
 * If the URL already starts with a scheme (e.g. "https://", "http://", "chrome://"),
 * it is returned unchanged. Otherwise "https://" is prepended.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return trimmed;
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
