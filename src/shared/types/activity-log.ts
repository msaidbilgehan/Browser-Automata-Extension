import type { EntityId, ISOTimestamp } from "./entities";

export const LOG_ACTIONS = {
  SCRIPT_EXECUTED: "script_executed",
  SCRIPT_ERROR: "script_error",
  SHORTCUT_TRIGGERED: "shortcut_triggered",
  FLOW_EXECUTED: "flow_executed",
  FLOW_ERROR: "flow_error",
  CSS_INJECTED: "css_injected",
  NETWORK_RULE_APPLIED: "network_rule_applied",
  EXTRACTION_COMPLETED: "extraction_completed",
  SCHEDULE_FIRED: "schedule_fired",
  PROFILE_SWITCHED: "profile_switched",
  SYSTEM: "system",
} as const;

export type LogAction = (typeof LOG_ACTIONS)[keyof typeof LOG_ACTIONS];

export type LogStatus = "success" | "error" | "warning" | "info";

export type LogEntityType =
  | "script"
  | "shortcut"
  | "flow"
  | "css_rule"
  | "network_rule"
  | "extraction";

export interface ActivityLogEntry {
  seq: number;
  timestamp: ISOTimestamp;
  action: LogAction;
  status: LogStatus;
  url?: string;
  domain?: string;
  entityId?: EntityId;
  entityType?: LogEntityType;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  details?: Record<string, unknown>;
}
