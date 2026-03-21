import { ScrollText, Trash2, RefreshCw, Download } from "lucide-react";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { sendToBackground } from "@/shared/messaging";
import type { ActivityLogEntry } from "@/shared/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { exportLogs } from "../../utils/export-import";

const STATUS_COLORS: Record<string, string> = {
  success: "text-active",
  error: "text-error",
  warning: "text-warning",
  info: "text-text-muted",
};

const STATUS_ICONS: Record<string, string> = {
  success: "\u25CF",
  error: "\u2715",
  warning: "\u25B2",
  info: "\u25CB",
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

export function LogView() {
  const [allEntries, setAllEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const response = await sendToBackground({ type: "GET_LOG" });
      setAllEntries(response.entries);
    } catch {
      // Silently handle
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  // Filter and reverse (most recent first)
  const filtered = useMemo(() => {
    let result = allEntries;
    if (statusFilter) {
      result = result.filter((e) => e.status === statusFilter);
    }
    if (domainFilter) {
      result = result.filter((e) => e.domain?.toLowerCase().includes(domainFilter.toLowerCase()));
    }
    return [...result].reverse();
  }, [allEntries, statusFilter, domainFilter]);

  // Unique domains for display
  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) {
      if (e.domain) set.add(e.domain);
    }
    return Array.from(set).sort();
  }, [allEntries]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const handleClear = async () => {
    await sendToBackground({ type: "CLEAR_LOG" });
    setAllEntries([]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold">Activity Log</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            onClick={() => {
              exportLogs(filtered);
            }}
            disabled={filtered.length === 0}
            title="Export logs"
          >
            <Download size={12} />
          </Button>
          <Button variant="ghost" onClick={() => void loadLog()}>
            <RefreshCw size={12} />
          </Button>
          <Button variant="ghost" onClick={() => void handleClear()}>
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        <div className="flex-1">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
          />
        </div>
        <div className="flex-1">
          <Select
            options={[
              { value: "", label: "All domains" },
              ...domains.map((d) => ({ value: d, label: d })),
            ]}
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value);
            }}
          />
        </div>
      </div>

      {/* Count */}
      <p className="text-text-muted text-[10px]">
        {String(filtered.length)} entr{filtered.length === 1 ? "y" : "ies"}
        {statusFilter || domainFilter ? " (filtered)" : ""}
      </p>

      {/* Log entries */}
      {loading ? (
        <p className="text-text-muted py-4 text-center text-xs">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ScrollText size={32} className="text-text-muted" />
          <p className="text-text-muted text-xs">No activity yet</p>
        </div>
      ) : (
        <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
          <div
            style={{
              height: `${String(virtualizer.getTotalSize())}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const entry = filtered[virtualItem.index];
              if (!entry) return null;

              return (
                <div
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${String(virtualItem.start)}px)`,
                  }}
                  className="px-0.5 py-0.5"
                >
                  <LogEntry
                    entry={entry}
                    onToggle={() => { virtualizer.measureElement(
                      parentRef.current?.querySelector(`[data-index="${String(virtualItem.index)}"]`) as HTMLElement | null
                    ); }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LogEntry({ entry, onToggle }: { entry: ActivityLogEntry; onToggle?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border-border bg-bg-secondary flex cursor-pointer flex-col gap-0.5 rounded border px-2 py-1.5"
      onClick={() => {
        setExpanded(!expanded);
        // Re-measure after DOM update so virtualizer adjusts row height
        requestAnimationFrame(() => onToggle?.());
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-medium ${STATUS_COLORS[entry.status] ?? "text-text-muted"}`}
        >
          {STATUS_ICONS[entry.status] ?? "\u25CB"} {entry.domain ?? "system"}
        </span>
        <span className="text-text-muted text-[10px]">{formatTime(entry.timestamp)}</span>
      </div>
      <p className="text-text-secondary truncate text-[11px]">{entry.message}</p>
      {expanded && entry.error ? (
        <div className="bg-bg-primary mt-1 rounded p-1.5">
          <p className="text-error font-mono text-[10px]">{entry.error.message}</p>
          {entry.error.stack ? (
            <pre className="text-text-muted mt-1 max-h-20 overflow-auto text-[9px]">
              {entry.error.stack}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
