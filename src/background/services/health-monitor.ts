import { localStore } from "@/shared/storage";
import type { HealthMetrics, EntityId, ISOTimestamp } from "@/shared/types/entities";

/**
 * Default empty health metrics used when none exist in storage.
 */
const EMPTY_HEALTH_METRICS: HealthMetrics = {
  scriptMetrics: {},
  selectorHealth: {},
  storageUsage: {
    total: 0,
    byType: {},
    lastCheckedAt: new Date().toISOString() as ISOTimestamp,
  },
};

/**
 * Update running metric totals for a given script after execution.
 */
export async function updateScriptMetrics(
  scriptId: EntityId,
  success: boolean,
  durationMs: number,
): Promise<void> {
  await localStore.update(
    "healthMetrics",
    (metrics) => {
      const existing = metrics.scriptMetrics[scriptId];
      const totalRuns = (existing?.totalRuns ?? 0) + 1;
      const successCount = (existing?.successCount ?? 0) + (success ? 1 : 0);
      const errorCount = (existing?.errorCount ?? 0) + (success ? 0 : 1);
      const prevAvg = existing?.avgDurationMs ?? 0;
      const avgDurationMs = prevAvg + (durationMs - prevAvg) / totalRuns;

      const updated: HealthMetrics = {
        ...metrics,
        scriptMetrics: {
          ...metrics.scriptMetrics,
          [scriptId]: {
            totalRuns,
            successCount,
            errorCount,
            lastRunAt: new Date().toISOString() as ISOTimestamp,
            avgDurationMs: Math.round(avgDurationMs * 100) / 100,
            ...(existing?.lastError !== undefined && !success
              ? {}
              : existing?.lastError !== undefined
                ? { lastError: existing.lastError }
                : {}),
          },
        },
      };

      return updated;
    },
    EMPTY_HEALTH_METRICS,
  );
}

/**
 * Calculate storage byte usage per entity type and update health metrics.
 */
export async function checkStorageUsage(): Promise<void> {
  const storageKeys = [
    "scripts",
    "shortcuts",
    "flows",
    "cssRules",
    "extractionRules",
    "profiles",
    "variables",
    "sharedLibraries",
    "networkRules",
    "formFillProfiles",
    "notificationRules",
    "log",
  ] as const;

  const byType: Record<string, number> = {};
  let total = 0;

  for (const key of storageKeys) {
    const data = await chrome.storage.local.get(key);
    const size = new Blob([JSON.stringify(data[key] ?? {})]).size;
    byType[key] = size;
    total += size;
  }

  await localStore.update(
    "healthMetrics",
    (metrics) => ({
      ...metrics,
      storageUsage: {
        total,
        byType,
        lastCheckedAt: new Date().toISOString() as ISOTimestamp,
      },
    }),
    EMPTY_HEALTH_METRICS,
  );
}

/**
 * Return current health metrics from storage.
 */
export async function getHealthMetrics(): Promise<HealthMetrics> {
  const metrics = await localStore.get("healthMetrics");
  return metrics ?? EMPTY_HEALTH_METRICS;
}
