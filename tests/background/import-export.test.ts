import { describe, it, expect } from "vitest";
import { validateImportEnvelope, withValidId } from "@/background/services/import-export";
import { CURRENT_SCHEMA_VERSION } from "@/shared/constants";
import type { BrowserAutomataExport } from "@/shared/types/entities";

/** Build an import payload with loosely-typed envelope overrides (mimics untrusted file input). */
function payload(overrides: Record<string, unknown>): BrowserAutomataExport {
  return {
    _format: "browser-automata-export",
    _schemaVersion: CURRENT_SCHEMA_VERSION,
    _exportedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as BrowserAutomataExport;
}

describe("validateImportEnvelope", () => {
  it("accepts a well-formed current-schema export", () => {
    expect(validateImportEnvelope(payload({})).ok).toBe(true);
  });

  it("rejects a payload that is not a Browser Automata export", () => {
    const result = validateImportEnvelope(payload({ _format: "some-other-tool" }));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("unrecognized format");
  });

  it("rejects a payload with a missing/invalid schema version", () => {
    expect(validateImportEnvelope(payload({ _schemaVersion: undefined })).ok).toBe(false);
    expect(validateImportEnvelope(payload({ _schemaVersion: "1" })).ok).toBe(false);
    expect(validateImportEnvelope(payload({ _schemaVersion: NaN })).ok).toBe(false);
  });

  it("rejects a payload from a newer schema than this build supports", () => {
    const result = validateImportEnvelope(payload({ _schemaVersion: CURRENT_SCHEMA_VERSION + 1 }));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("newer");
  });
});

describe("withValidId", () => {
  it("keeps only entities with a non-empty string id", () => {
    const items = [
      { id: "a" },
      { id: "" },
      { id: "   " },
      { id: undefined as unknown as string },
      { id: 42 as unknown as string },
      { id: "b" },
    ];
    expect(withValidId(items).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for undefined input", () => {
    expect(withValidId(undefined)).toEqual([]);
  });
});
