import { localStore } from "@/shared/storage";
import type {
  EntityId,
  UrlPattern,
  ScopeMode,
  QuickRunTarget,
  ShortcutAction,
} from "@/shared/types/entities";

/** Describes an item whose target entity scope may need resolving */
interface ScopedItem {
  id: EntityId;
  scopeMode?: ScopeMode | undefined;
  target: QuickRunTarget | ShortcutAction;
}

/**
 * Extracts the referenced entity ID from a Quick Run target or Shortcut action.
 * Returns null for action types that don't reference an entity (click, focus, navigate, inline_script).
 */
function getTargetEntityRef(
  target: QuickRunTarget | ShortcutAction,
): { store: "scripts" | "flows" | "extractionRules" | "formFillProfiles"; entityId: EntityId } | null {
  switch (target.type) {
    case "script":
      return { store: "scripts", entityId: target.scriptId };
    case "flow":
      return { store: "flows", entityId: target.flowId };
    case "extraction":
      return { store: "extractionRules", entityId: target.extractionRuleId };
    case "form_fill":
      return { store: "formFillProfiles", entityId: ("formFillProfileId" in target ? target.formFillProfileId : "") as EntityId };
    default:
      // click, focus, navigate, inline_script — no target entity
      return null;
  }
}

type StoreKey = "scripts" | "flows" | "extractionRules" | "formFillProfiles";

/**
 * Batch-resolve target entity scopes for items that use non-custom scope mode.
 * Reads each entity store at most once, regardless of how many items reference it.
 *
 * @returns Map from item ID to the target entity's UrlPattern scope
 */
export async function resolveTargetScopes(
  items: readonly ScopedItem[],
): Promise<Map<EntityId, UrlPattern>> {
  const scopeMap = new Map<EntityId, UrlPattern>();

  // Collect which stores we need to read and which entity IDs from each
  const storeNeeds = new Map<StoreKey, { itemId: EntityId; entityId: EntityId }[]>();

  for (const item of items) {
    if (!item.scopeMode || item.scopeMode === "custom") continue;

    const ref = getTargetEntityRef(item.target);
    if (!ref) continue;

    const list = storeNeeds.get(ref.store) ?? [];
    list.push({ itemId: item.id, entityId: ref.entityId });
    storeNeeds.set(ref.store, list);
  }

  if (storeNeeds.size === 0) return scopeMap;

  // Batch-read all needed stores in parallel
  const storeKeys = [...storeNeeds.keys()];
  const storeValues = await Promise.all(
    storeKeys.map((key) => localStore.get(key)),
  );

  for (let i = 0; i < storeKeys.length; i++) {
    const key = storeKeys[i];
    if (!key) continue;
    const store = (storeValues[i] ?? {}) as Record<string, { scope: UrlPattern }>;
    const needs = storeNeeds.get(key);
    if (!needs) continue;

    for (const { itemId, entityId } of needs) {
      const entity = store[entityId];
      if (entity) {
        scopeMap.set(itemId, entity.scope);
      }
    }
  }

  return scopeMap;
}
