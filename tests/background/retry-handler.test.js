import { describe, it, expect } from "vitest";
import { computeBackoffDelay, DEFAULT_MAX_RETRY_DELAY_MS } from "@/background/services/retry-handler";
/**
 * Regression tests for the dormant defect "RetryPolicy has no maxDelayMs;
 * delayMs * multiplier^attempt is uncapped" — an aggressive policy could
 * schedule a multi-hour delay that outlives the MV3 service worker, so the retry
 * would never fire. computeBackoffDelay clamps the exponential growth.
 */
function policy(overrides = {}) {
    return { maxRetries: 8, delayMs: 1000, backoffMultiplier: 2, ...overrides };
}
describe("computeBackoffDelay", () => {
    it("grows exponentially while under the cap", () => {
        const p = policy({ delayMs: 100, backoffMultiplier: 2, maxDelayMs: 100_000 });
        expect(computeBackoffDelay(p, 0)).toBe(100);
        expect(computeBackoffDelay(p, 1)).toBe(200);
        expect(computeBackoffDelay(p, 2)).toBe(400);
        expect(computeBackoffDelay(p, 3)).toBe(800);
    });
    it("clamps to the explicit maxDelayMs", () => {
        const p = policy({ delayMs: 1000, backoffMultiplier: 10, maxDelayMs: 5000 });
        // Unclamped attempt 3 would be 1000 * 10^3 = 1_000_000.
        expect(computeBackoffDelay(p, 3)).toBe(5000);
    });
    it("falls back to the default cap when maxDelayMs is omitted", () => {
        // The report's worst case: 1000ms × 10^8 ≈ 2.8h without a cap.
        const p = policy({ delayMs: 1000, backoffMultiplier: 10 });
        expect(computeBackoffDelay(p, 8)).toBe(DEFAULT_MAX_RETRY_DELAY_MS);
    });
    it("treats a sub-1 multiplier as constant delay (never shrinks)", () => {
        const p = policy({ delayMs: 1000, backoffMultiplier: 0.5, maxDelayMs: 100_000 });
        expect(computeBackoffDelay(p, 0)).toBe(1000);
        expect(computeBackoffDelay(p, 3)).toBe(1000);
    });
    it("clamps a negative base delay to zero", () => {
        const p = policy({ delayMs: -500, backoffMultiplier: 2, maxDelayMs: 100_000 });
        expect(computeBackoffDelay(p, 2)).toBe(0);
    });
});
