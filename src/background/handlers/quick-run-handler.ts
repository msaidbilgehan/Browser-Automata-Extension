import { localStore } from "@/shared/storage";
import { matchUrl } from "@/shared/url-pattern/matcher";
import { runScriptNow } from "@/background/services/script-manager";
import { handleFlowRunNow } from "./flow-handler";
import { handleExtractionRunNow } from "./extraction-handler";
import { handleFormFillRun } from "./form-fill-handler";
import type { QuickRunAction, EntityId } from "@/shared/types/entities";

/**
 * Save a QuickRunAction to local storage.
 */
export async function handleQuickRunSave(action: QuickRunAction): Promise<{ ok: boolean }> {
  await localStore.update(
    "quickRunActions",
    (actions) => ({ ...actions, [action.id]: action }),
    {},
  );
  return { ok: true };
}

/**
 * Delete a QuickRunAction from local storage.
 */
export async function handleQuickRunDelete(actionId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "quickRunActions",
    (actions) => {
      const updated = { ...actions };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete updated[actionId];
      return updated;
    },
    {},
  );
  return { ok: true };
}

/**
 * Reorder QuickRunActions by updating their `order` field.
 */
export async function handleQuickRunReorder(orderedIds: EntityId[]): Promise<{ ok: boolean }> {
  await localStore.update(
    "quickRunActions",
    (actions) => {
      const updated = { ...actions };
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        if (id !== undefined && updated[id] !== undefined) {
          updated[id] = { ...updated[id], order: i };
        }
      }
      return updated;
    },
    {},
  );
  return { ok: true };
}

/**
 * Execute a QuickRunAction by dispatching to the appropriate run handler.
 */
export async function handleQuickRunExecute(
  actionId: EntityId,
): Promise<{ ok: boolean; error?: string }> {
  const actions = (await localStore.get("quickRunActions")) ?? {};
  const action = actions[actionId];
  if (!action) {
    return { ok: false, error: "Quick run action not found" };
  }
  if (!action.enabled) {
    return { ok: false, error: "Quick run action is disabled" };
  }

  switch (action.target.type) {
    case "script": {
      const result = await runScriptNow(action.target.scriptId);
      if (!result.ok) return { ok: false, error: "Script execution failed" };
      return { ok: true };
    }
    case "flow": {
      const result = await handleFlowRunNow(action.target.flowId);
      const flowResult = result as { ok?: boolean };
      return { ok: flowResult.ok !== false };
    }
    case "extraction": {
      const result = await handleExtractionRunNow(action.target.extractionRuleId);
      if (!result.ok) return { ok: false, error: result.error ?? "Extraction failed" };
      return { ok: true };
    }
    case "form_fill": {
      const result = await handleFormFillRun(action.target.formFillProfileId);
      if (!result.ok) return { ok: false, error: result.error ?? "Form fill failed" };
      return { ok: true };
    }
  }
}

/**
 * Get all QuickRunActions that match a given URL, sorted by order.
 */
export async function handleQuickRunGetMatching(
  url: string,
): Promise<{ actions: QuickRunAction[] }> {
  const actions = (await localStore.get("quickRunActions")) ?? {};
  const matching = Object.values(actions)
    .filter((a) => a.enabled && matchUrl(a.scope, url))
    .sort((a, b) => a.order - b.order);
  return { actions: matching };
}
