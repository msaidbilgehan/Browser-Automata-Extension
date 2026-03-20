/**
 * Retry policies (F16i).
 * Wraps async functions with configurable retry + exponential backoff.
 */

import type { RetryPolicy } from "@/shared/types/entities";
import { notifyError } from "@/background/services/error-surfacer";

/** Delay for a given number of milliseconds */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

      // If we still have retries left, delay before next attempt
      if (attempt < policy.maxRetries) {
        const backoffDelay = policy.delayMs * Math.pow(policy.backoffMultiplier, attempt);
        await delay(backoffDelay);
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
    notifyError("Retry exhausted", errorMessage);
    return undefined;
  }

  // "abort" — re-throw the last error
  throw lastError;
}
