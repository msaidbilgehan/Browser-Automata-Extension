import { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { sendToBackground } from "@/shared/messaging";
import type { HealthMetrics } from "@/shared/types/entities";

interface ScriptMetricEntry {
  scriptId: string;
  totalRuns: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: number;
  lastRunAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StorageBar({
  label,
  bytes,
  maxBytes,
}: {
  label: string;
  bytes: number;
  maxBytes: number;
}) {
  const pct = maxBytes > 0 ? Math.min((bytes / maxBytes) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-text-secondary w-28 shrink-0 truncate" title={label}>
        {label}
      </span>
      <div className="bg-bg-tertiary h-3 flex-1 overflow-hidden rounded">
        <div
          className="bg-active h-full rounded transition-all"
          style={{ width: `${String(pct)}%` }}
        />
      </div>
      <span className="text-text-muted w-16 shrink-0 text-right">{formatBytes(bytes)}</span>
    </div>
  );
}

export function HealthView() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await sendToBackground({ type: "GET_HEALTH" });
      setMetrics(response.metrics);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-text-muted text-xs">Loading health metrics...</p>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="space-y-2 py-4">
        <p className="text-error text-xs">Failed to load health metrics: {error}</p>
        <Button variant="secondary" onClick={() => void loadMetrics()}>
          Retry
        </Button>
      </div>
    );
  }

  if (metrics === null) {
    return <p className="text-text-muted py-4 text-xs">No health data available.</p>;
  }

  // Build top 5 scripts by total runs
  const scriptEntries: ScriptMetricEntry[] = Object.entries(metrics.scriptMetrics)
    .map(([scriptId, m]) => ({
      scriptId,
      totalRuns: m.totalRuns,
      successCount: m.successCount,
      errorCount: m.errorCount,
      avgDurationMs: m.avgDurationMs,
      lastRunAt: m.lastRunAt,
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns)
    .slice(0, 5);

  // Aggregate totals
  const totalRuns = scriptEntries.reduce((sum, e) => sum + e.totalRuns, 0);
  const totalErrors = scriptEntries.reduce((sum, e) => sum + e.errorCount, 0);
  const errorRate = totalRuns > 0 ? ((totalErrors / totalRuns) * 100).toFixed(1) : "0.0";
  const avgDuration =
    scriptEntries.length > 0
      ? (scriptEntries.reduce((sum, e) => sum + e.avgDurationMs, 0) / scriptEntries.length).toFixed(
          0,
        )
      : "0";

  // Storage data
  const storageEntries = Object.entries(metrics.storageUsage.byType).sort((a, b) => b[1] - a[1]);
  const maxStorageBytes = Math.max(...storageEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold">Health Dashboard</h2>
        <Button variant="ghost" onClick={() => void loadMetrics()}>
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center">
          <p className="text-text-primary text-lg font-bold">{totalRuns}</p>
          <p className="text-text-muted text-[10px]">Total Runs</p>
        </Card>
        <Card className="text-center">
          <p className="text-error text-lg font-bold">{errorRate}%</p>
          <p className="text-text-muted text-[10px]">Error Rate</p>
        </Card>
        <Card className="text-center">
          <p className="text-text-primary text-lg font-bold">{avgDuration}ms</p>
          <p className="text-text-muted text-[10px]">Avg Duration</p>
        </Card>
      </div>

      {/* Top scripts */}
      <Card>
        <h3 className="text-text-primary mb-2 text-xs font-semibold">Top Scripts (by runs)</h3>
        {scriptEntries.length === 0 ? (
          <p className="text-text-muted text-xs">No script metrics yet.</p>
        ) : (
          <div className="space-y-1.5">
            {scriptEntries.map((entry) => {
              const successPct =
                entry.totalRuns > 0
                  ? ((entry.successCount / entry.totalRuns) * 100).toFixed(0)
                  : "0";
              return (
                <div key={entry.scriptId} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary w-32 truncate" title={entry.scriptId}>
                    {entry.scriptId.slice(0, 8)}...
                  </span>
                  <span className="text-text-muted">{entry.totalRuns} runs</span>
                  <span className="text-success">{successPct}% ok</span>
                  <span className="text-text-muted">{entry.avgDurationMs.toFixed(0)}ms</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Storage usage */}
      <Card>
        <h3 className="text-text-primary mb-2 text-xs font-semibold">
          Storage Usage ({formatBytes(metrics.storageUsage.total)})
        </h3>
        {storageEntries.length === 0 ? (
          <p className="text-text-muted text-xs">No storage data.</p>
        ) : (
          <div className="space-y-1.5">
            {storageEntries.map(([key, bytes]) => (
              <StorageBar key={key} label={key} bytes={bytes} maxBytes={maxStorageBytes} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
