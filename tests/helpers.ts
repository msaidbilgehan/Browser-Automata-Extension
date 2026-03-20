import type { Mock } from "vitest";

/**
 * Get a chrome API function as a properly-typed async mock.
 * Avoids type conflicts between @types/chrome callback signatures and vi.fn().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockFn(fn: unknown): Mock<(...args: any[]) => Promise<any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fn as Mock<(...args: any[]) => Promise<any>>;
}
