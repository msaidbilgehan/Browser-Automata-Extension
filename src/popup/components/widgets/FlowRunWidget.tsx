import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { FlowRunState, FlowNodeStatus } from "@/shared/types/flow-run";

const SESSION_KEY = "_flowRunState";

function formatElapsed(startIso: string, endIso?: string): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins > 0) return `${String(mins)}m ${String(remainSecs)}s`;
  if (secs > 0) return `${String(secs)}.${String(Math.floor((ms % 1000) / 100))}s`;
  return `${String(ms)}ms`;
}

function StepIcon({ status }: { status: FlowNodeStatus }) {
  switch (status) {
    case "success":
      return <CheckCircle2 size={12} className="text-active shrink-0" />;
    case "error":
      return <XCircle size={12} className="text-error shrink-0" />;
    case "running":
      return <Loader2 size={12} className="text-active shrink-0 animate-spin" />;
    case "skipped":
      return <Circle size={12} className="text-text-muted shrink-0 opacity-50" />;
    default:
      return <Circle size={12} className="text-text-muted shrink-0" />;
  }
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  info: "text-text-secondary",
  success: "text-active",
  error: "text-error",
  warning: "text-warning",
};

export function FlowRunWidget() {
  const [runState, setRunState] = useState<FlowRunState | null>(null);
  const [elapsed, setElapsed] = useState("");
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Load initial state + subscribe to session storage changes
  useEffect(() => {
    // Load current state
    chrome.storage.session.get(SESSION_KEY).then((result) => {
      const state = result[SESSION_KEY] as FlowRunState | undefined;
      if (state) setRunState(state);
    });

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === "session" && SESSION_KEY in changes) {
        const state = changes[SESSION_KEY]?.newValue as FlowRunState | undefined;
        setRunState(state ?? null);
        setDismissed(false);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Update elapsed timer
  useEffect(() => {
    if (!runState) return undefined;

    const update = () => {
      setElapsed(formatElapsed(runState.startedAt, runState.completedAt));
    };

    update();

    if (runState.status === "running") {
      const interval = setInterval(update, 100);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [runState]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsExpanded) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [runState?.logs.length, logsExpanded]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    void chrome.storage.session.remove(SESSION_KEY);
  }, []);

  if (!runState || dismissed) return null;

  const completedSteps = runState.steps.filter((s) => s.status === "success").length;
  const totalSteps = runState.steps.length;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const isRunning = runState.status === "running";
  const isError = runState.status === "error";
  const isSuccess = runState.status === "success";

  const statusColor = isError ? "border-error/30" : isSuccess ? "border-active/30" : "border-border-active";

  return (
    <div
      className={`bg-bg-secondary border ${statusColor} flex flex-col gap-1.5 rounded-lg p-2.5 shadow-sm`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Loader2 size={14} className="text-active shrink-0 animate-spin" />
        ) : isSuccess ? (
          <CheckCircle2 size={14} className="text-active shrink-0" />
        ) : (
          <XCircle size={14} className="text-error shrink-0" />
        )}

        <span className="text-text-primary min-w-0 flex-1 truncate text-xs font-semibold">
          {runState.flowName || "Flow Run"}
        </span>

        <div className="flex items-center gap-1 text-text-muted">
          <Clock size={10} />
          <span className="text-[10px] font-mono tabular-nums">{elapsed}</span>
        </div>

        {!isRunning && (
          <button
            type="button"
            onClick={handleDismiss}
            className="text-text-muted hover:text-text-primary rounded p-0.5 transition-colors"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-bg-tertiary h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isError ? "bg-error" : "bg-active"
          }`}
          style={{ width: `${String(progressPct)}%` }}
        />
      </div>

      {/* Step counter */}
      <div className="flex items-center justify-between">
        <span className="text-text-muted text-[10px]">
          Step {String(Math.min(completedSteps + (isRunning ? 1 : 0), totalSteps))}/{String(totalSteps)}
        </span>
        {isSuccess && (
          <span className="text-active text-[10px] font-medium">Completed</span>
        )}
        {isError && (
          <span className="text-error text-[10px] font-medium">Failed</span>
        )}
      </div>

      {/* Steps list */}
      <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
        {runState.steps.map((step) => (
          <div
            key={step.nodeId}
            className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] ${
              step.status === "running" ? "bg-active/10" : ""
            }`}
          >
            <StepIcon status={step.status} />
            <span
              className={`min-w-0 flex-1 truncate ${
                step.status === "pending"
                  ? "text-text-muted"
                  : step.status === "error"
                    ? "text-error"
                    : "text-text-secondary"
              }`}
            >
              {step.label}
            </span>
            {step.startedAt && step.completedAt && (
              <span className="text-text-muted shrink-0 font-mono text-[9px]">
                {formatElapsed(step.startedAt, step.completedAt)}
              </span>
            )}
            {step.error && (
              <span className="text-error shrink-0 text-[9px]" title={step.error}>
                !
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Logs toggle */}
      {runState.logs.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setLogsExpanded((v) => !v)}
            className="text-text-muted hover:text-text-secondary flex items-center gap-1 text-[10px] transition-colors"
          >
            {logsExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            Logs ({String(runState.logs.length)})
          </button>

          {logsExpanded && (
            <div className="bg-bg-primary border-border max-h-28 overflow-y-auto rounded border p-1.5">
              {runState.logs.map((log, i) => (
                <div key={i} className="flex gap-1.5 text-[9px] leading-relaxed">
                  <span className="text-text-muted shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={LOG_LEVEL_COLORS[log.level] ?? "text-text-secondary"}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
