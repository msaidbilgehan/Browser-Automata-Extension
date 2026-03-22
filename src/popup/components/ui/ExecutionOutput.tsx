import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Terminal, X } from "lucide-react";
import type { ScriptRunResult, ConsoleLogEntry } from "@/shared/types/script-run";

const LEVEL_STYLES: Record<ConsoleLogEntry["level"], string> = {
  log: "text-text-secondary",
  info: "text-active",
  warn: "text-warning",
  error: "text-error",
};

const LEVEL_LABELS: Record<ConsoleLogEntry["level"], string> = {
  log: "LOG",
  info: "INF",
  warn: "WRN",
  error: "ERR",
};

interface ExecutionOutputProps {
  result: ScriptRunResult;
  onDismiss: () => void;
}

export function ExecutionOutput({ result, onDismiss }: ExecutionOutputProps) {
  const [expanded, setExpanded] = useState(true);
  const hasLogs = result.consoleLogs.length > 0;
  const hasReturn = result.returnValue !== undefined;
  const hasError = !result.ok && result.error;

  return (
    <div
      className={`border rounded-lg overflow-hidden text-xs ${
        result.ok ? "border-active/30 bg-active/5" : "border-error/30 bg-error/5"
      }`}
      role="region"
      aria-label="Script execution output"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => { setExpanded((p) => !p); }}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 hover:bg-bg-tertiary/50 transition-colors"
        aria-expanded={expanded}
      >
        {result.ok ? (
          <CheckCircle2 size={12} className="text-active shrink-0" />
        ) : (
          <XCircle size={12} className="text-error shrink-0" />
        )}
        <span className="text-text-primary font-medium flex-1 text-left">
          {result.ok ? "Execution succeeded" : "Execution failed"}
        </span>
        <span className="text-text-muted flex items-center gap-0.5">
          <Clock size={10} />
          {result.durationMs}ms
        </span>
        {hasLogs && (
          <span className="text-text-muted flex items-center gap-0.5">
            <Terminal size={10} />
            {result.consoleLogs.length}
          </span>
        )}
        {expanded ? <ChevronUp size={12} className="text-text-muted" /> : <ChevronDown size={12} className="text-text-muted" />}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onDismiss(); } }}
          className="text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
          aria-label="Dismiss output"
        >
          <X size={10} />
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border/50 max-h-[200px] overflow-y-auto">
          {/* Console logs */}
          {hasLogs && (
            <div className="divide-y divide-border/30">
              {result.consoleLogs.map((entry, i) => (
                <div
                  key={i}
                  className={`px-2.5 py-1 font-mono text-[10px] leading-relaxed flex gap-1.5 ${LEVEL_STYLES[entry.level]}`}
                >
                  <span className="shrink-0 opacity-60 font-semibold w-6">
                    {LEVEL_LABELS[entry.level]}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{entry.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Return value */}
          {hasReturn && (
            <div className="border-t border-border/30 px-2.5 py-1.5">
              <span className="text-text-muted text-[10px]">Return value:</span>
              <pre className="text-text-primary font-mono text-[10px] mt-0.5 whitespace-pre-wrap break-all">
                {result.returnValue}
              </pre>
            </div>
          )}

          {/* Error */}
          {hasError && (
            <div className="border-t border-border/30 px-2.5 py-1.5">
              <p className="text-error font-medium">{result.error}</p>
              {result.stack && (
                <pre className="text-error/70 font-mono text-[10px] mt-1 whitespace-pre-wrap break-all leading-relaxed">
                  {result.stack}
                </pre>
              )}
            </div>
          )}

          {/* Empty state — no logs, no return, no error (just a silent success) */}
          {!hasLogs && !hasReturn && !hasError && (
            <div className="px-2.5 py-2 text-text-muted text-center">
              Script executed with no output.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
