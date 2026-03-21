import type { EntityId, ISOTimestamp } from "./entities";

/** Status of an individual flow node execution */
export type FlowNodeStatus = "pending" | "running" | "success" | "error" | "skipped";

/** A single step in the flow run progress */
export interface FlowRunStep {
  nodeId: EntityId;
  nodeType: string;
  label: string;
  status: FlowNodeStatus;
  startedAt?: ISOTimestamp;
  completedAt?: ISOTimestamp;
  error?: string;
}

/** A log entry emitted during the flow run */
export interface FlowRunLogEntry {
  timestamp: ISOTimestamp;
  level: "info" | "success" | "error" | "warning";
  message: string;
}

/** Overall flow run state, stored in session storage */
export interface FlowRunState {
  flowId: EntityId;
  flowName: string;
  status: "running" | "success" | "error" | "idle";
  startedAt: ISOTimestamp;
  completedAt?: ISOTimestamp;
  currentNodeIndex: number;
  steps: FlowRunStep[];
  logs: FlowRunLogEntry[];
}
