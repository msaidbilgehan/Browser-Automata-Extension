import { describe, it, expect } from "vitest";
import { STORAGE_KEYS, CURRENT_SCHEMA_VERSION, DEFAULTS } from "@/shared/constants";

describe("scaffolding smoke test", () => {
  it("has correct schema version", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });

  it("has all required storage keys", () => {
    expect(STORAGE_KEYS.SCRIPTS).toBe("scripts");
    expect(STORAGE_KEYS.SHORTCUTS).toBe("shortcuts");
    expect(STORAGE_KEYS.SETTINGS).toBe("settings");
  });

  it("has sensible defaults", () => {
    expect(DEFAULTS.MAX_LOG_ENTRIES).toBe(5000);
    expect(DEFAULTS.SCRIPT_TIMEOUT_MS).toBe(30_000);
    expect(DEFAULTS.CHORD_TIMEOUT_MS).toBe(500);
  });

  it("has chrome API mocked", () => {
    expect(chrome.storage.local.get).toBeDefined();
    expect(chrome.runtime.sendMessage).toBeDefined();
    expect(chrome.scripting.executeScript).toBeDefined();
  });
});
