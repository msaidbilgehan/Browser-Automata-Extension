import { describe, it, expect, vi, beforeEach } from "vitest";
import { runMigrations } from "@/shared/storage/schema-migration";
import { mockFn } from "../helpers";
describe("runMigrations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("initializes empty collections on first install (version 0 → 1)", async () => {
        const getMock = mockFn(chrome.storage.local.get);
        getMock
            .mockResolvedValueOnce({}) // schemaVersion = undefined
            .mockResolvedValueOnce({}) // scripts check
            .mockResolvedValueOnce({}) // shortcuts check
            .mockResolvedValueOnce({}) // cssRules check
            .mockResolvedValueOnce({}); // log check
        await runMigrations();
        const setCalls = vi.mocked(chrome.storage.local.set).mock.calls;
        const setKeys = setCalls.map((call) => Object.keys(call[0])[0]);
        expect(setKeys).toContain("scripts");
        expect(setKeys).toContain("shortcuts");
        expect(setKeys).toContain("cssRules");
        expect(setKeys).toContain("log");
        expect(setKeys).toContain("schemaVersion");
    });
    it("skips migration when already at current version", async () => {
        mockFn(chrome.storage.local.get).mockResolvedValueOnce({
            schemaVersion: 1,
        });
        await runMigrations();
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
    it("does not reinitialize existing collections", async () => {
        const getMock = mockFn(chrome.storage.local.get);
        getMock
            .mockResolvedValueOnce({}) // schemaVersion = undefined
            .mockResolvedValueOnce({ scripts: { existing: {} } })
            .mockResolvedValueOnce({ shortcuts: {} })
            .mockResolvedValueOnce({ cssRules: {} })
            .mockResolvedValueOnce({ log: [] });
        await runMigrations();
        const setCalls = vi.mocked(chrome.storage.local.set).mock.calls;
        const setKeys = setCalls.map((call) => Object.keys(call[0])[0]);
        expect(setKeys).toEqual(["schemaVersion"]);
    });
});
