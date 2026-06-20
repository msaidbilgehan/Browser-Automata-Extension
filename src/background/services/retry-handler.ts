/**
 * Retry policies (F16i).
 * Wraps async functions with configurable retry + exponential backoff.
 */

import type { RetryPolicy } from "@/shared/types/entities";
import { notifyError } from "@/background/services/error-surfacer";

/**
 * Default ceiling for a single backoff delay (5 minutes). Chosen to stay well
 * under the MV3 service-worker idle-termination window so a scheduled retry can
 * actually run.
 */
export const DEFAULT_MAX_RETRY_DELAY_MS = 5 * 60_000;

/** Delay for a given number of milliseconds */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Compute the backoff delay for a given attempt, clamped to `[0, maxDelayMs]`.
 *
 * A `backoffMultiplier < 1` would shrink the delay each attempt (almost never
 * intended) and is treated as 1 (constant delay). The exponential term is capped
 * so an aggressive policy can never produce a multi-hour delay that outlives the
 * service worker.
 */
export function computeBackoffDelay(policy: RetryPolicy, attempt: number): number {
  const multiplier = policy.backoffMultiplier >= 1 ? policy.backoffMultiplier : 1;
  const base = Math.max(0, policy.delayMs);
  const maxDelay = policy.maxDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
  const raw = base * Math.pow(multiplier, attempt);
  return Math.min(raw, maxDelay);
}

/**
 * Wrap an async function with retry logic using the given policy.
 *
 * On each failure the delay grows exponentially:
 *   `policy.delayMs * (policy.backoffMultiplier ^ attempt)`
 *
 * When retries are exhausted the `fallbackAction` determines behaviour:
 *   - "skip"   → return `undefined`
 *   - "abort"  → throw the last error (default)
 *   - "notify" → surface error via notifyError, then return `undefined`
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
): Promise<T | undefined> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      lastError = e;

      // If we still have retries left, delay before next attempt (clamped so an
      // aggressive policy can't schedule a delay that outlives the SW).
      if (attempt < policy.maxRetries) {
        await delay(computeBackoffDelay(policy, attempt));
      }
    }
  }

  // All retries exhausted — apply fallback action
  const fallback = policy.fallbackAction ?? "abort";
  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);

  if (fallback === "skip") {
    return undefined;
  }

  if (fallback === "notify") {
    await notifyError("Retry exhausted", errorMessage);
    return undefined;
  }

  // "abort" — re-throw the last error
  throw lastError;
}
