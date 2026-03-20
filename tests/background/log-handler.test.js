import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleGetLog, handleClearLog, appendLogEntry } from "@/background/handlers/log-handler";
import { mockFn } from "../helpers";
describe("handleGetLog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("returns all log entries when no filters", async () => {
        const entries = [
            { seq: 1, action: "system", status: "info", message: "test" },
            { seq: 2, action: "script_executed", status: "success", message: "ran script" },
        ];
        mockFn(chrome.storage.local.get).mockResolvedValue({ log: entries });
        const result = await handleGetLog();
        expect(result.entries).toHaveLength(2);
    });
    it("filters entries by domain", async () => {
        const entries = [
            { seq: 1, action: "system", status: "info", message: "a", domain: "github.com" },
            { seq: 2, action: "system", status: "info", message: "b", domain: "google.com" },
        ];
        mockFn(chrome.storage.local.get).mockResolvedValue({ log: entries });
        const result = await handleGetLog({ domain: "github.com" });
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0]?.domain).toBe("github.com");
    });
    it("filters entries by status", async () => {
        const entries = [
            { seq: 1, action: "system", status: "success", message: "ok" },
            { seq: 2, action: "system", status: "error", message: "fail" },
        ];
        mockFn(chrome.storage.local.get).mockResolvedValue({ log: entries });
        const result = await handleGetLog({ status: "error" });
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0]?.status).toBe("error");
    });
    it("returns empty array when no log exists", async () => {
        mockFn(chrome.storage.local.get).mockResolvedValue({});
        const result = await handleGetLog();
        expect(result.entries).toEqual([]);
    });
});
describe("handleClearLog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("sets log to empty array", async () => {
        const result = await handleClearLog();
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ log: [] });
        expect(result).toEqual({ ok: true });
    });
});
describe("appendLogEntry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("appends entry with auto-incremented seq", async () => {
        const existingLog = [
            {
                seq: 1,
                timestamp: "2024-01-01T00:00:00.000Z",
                action: "system",
                status: "info",
                message: "first",
            },
        ];
        mockFn(chrome.storage.local.get).mockResolvedValue({ log: existingLog });
        await appendLogEntry({
            action: "script_executed",
            status: "success",
            message: "ran script",
        });
        const setCall = vi.mocked(chrome.storage.local.set).mock.calls[0];
        const savedLog = (setCall?.[0])["log"];
        expect(savedLog).toHaveLength(2);
        expect(savedLog[1]?.seq).toBe(2);
    });
    it("starts at seq 1 when log is empty", async () => {
        mockFn(chrome.storage.local.get).mockResolvedValue({ log: [] });
        await appendLogEntry({
            action: "system",
            status: "info",
            message: "init",
        });
        const setCall = vi.mocked(chrome.storage.local.set).mock.calls[0];
        const savedLog = (setCall?.[0])["log"];
        expect(savedLog[0]?.seq).toBe(1);
    });
});
