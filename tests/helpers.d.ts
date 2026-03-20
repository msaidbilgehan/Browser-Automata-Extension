import type { Mock } from "vitest";
/**
 * Get a chrome API function as a properly-typed async mock.
 * Avoids type conflicts between @types/chrome callback signatures and vi.fn().
 */
export declare function mockFn(fn: unknown): Mock<(...args: any[]) => Promise<any>>;
