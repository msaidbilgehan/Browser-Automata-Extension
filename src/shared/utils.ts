import type { EntityId, ISOTimestamp } from "./types/entities";

export function generateId(): EntityId {
  return crypto.randomUUID() as EntityId;
}

export function now(): ISOTimestamp {
  return new Date().toISOString() as ISOTimestamp;
}
