/** A single console log entry captured during script execution. */
export interface ConsoleLogEntry {
  level: "log" | "info" | "warn" | "error";
  text: string;
  timestamp: number;
}

/** Full result of a script execution — returned for both manual and automatic runs. */
export interface ScriptRunResult {
  ok: boolean;
  error?: string;
  stack?: string;
  returnValue?: string;
  consoleLogs: ConsoleLogEntry[];
  durationMs: number;
}
