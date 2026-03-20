import { localStore } from "@/shared/storage";
import { executeFlow } from "@/background/services/flow-executor";
import type { Flow, EntityId } from "@/shared/types/entities";

/** Save a flow to local storage */
export async function handleFlowSave(flow: Flow): Promise<{ ok: boolean }> {
  await localStore.update("flows", (flows) => ({ ...flows, [flow.id]: flow }), {});
  return { ok: true };
}

/** Delete a flow from local storage */
export async function handleFlowDelete(flowId: EntityId): Promise<{ ok: boolean }> {
  await localStore.update(
    "flows",
    (flows) => {
      return Object.fromEntries(Object.entries(flows).filter(([key]) => key !== flowId));
    },
    {},
  );
  return { ok: true };
}

/** Run a flow immediately on the active tab */
export async function handleFlowRunNow(flowId: EntityId): Promise<{ ok: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "No active tab" };
  }
  return executeFlow(flowId, tab.id);
}
