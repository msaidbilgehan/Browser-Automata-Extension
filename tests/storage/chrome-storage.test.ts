import { describe, it, expect, vi, beforeEach } from "vitest";
import { localStore, syncStore, onStorageChange } from "@/shared/storage/chrome-storage";
import { mockFn } from "../helpers";

describe("localStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets a value from chrome.storage.local", async () => {
    mockFn(chrome.storage.local.get).mockResolvedValue({
      scripts: { "abc-123": { id: "abc-123", name: "Test" } },
    });

    const result = await localStore.get("scripts");
    expect(chrome.storage.local.get).toHaveBeenCalledWith("scripts");
    expect(result).toEqual({ "abc-123": { id: "abc-123", name: "Test" } });
  });

  it("returns undefined when key has no value", async () => {
    mockFn(chrome.storage.local.get).mockResolvedValue({});

    const result = await localStore.get("scripts");
    expect(result).toBeUndefined();
  });

  it("sets a value in chrome.storage.local", async () => {
    await localStore.set("scripts", { "abc-123": {} as never });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      scripts: { "abc-123": {} },
    });
  });

  it("removes a key from chrome.storage.local", async () => {
    await localStore.remove("scripts");
    expect(chrome.storage.local.remove).toHaveBeenCalledWith("scripts");
  });

  it("updates a record value using updater function", async () => {
    mockFn(chrome.storage.local.get).mockResolvedValue({
      scripts: { existing: { id: "existing" } },
    });

    await localStore.update(
      "scripts",
      (scripts) => ({ ...scripts, new: { id: "new" } as never }),
      {},
    );

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      scripts: { existing: { id: "existing" }, new: { id: "new" } },
    });
  });

  it("uses default value when current is undefined", async () => {
    mockFn(chrome.storage.local.get).mockResolvedValue({});

    await localStore.update(
      "scripts",
      (scripts) => ({ ...scripts, first: { id: "first" } as never }),
      {},
    );

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      scripts: { first: { id: "first" } },
    });
  });
});

describe("syncStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets settings from chrome.storage.sync", async () => {
    mockFn(chrome.storage.sync.get).mockResolvedValue({
      settings: { globalEnabled: true },
    });

    const result = await syncStore.get("settings");
    expect(result).toEqual({ globalEnabled: true });
  });

  it("sets settings in chrome.storage.sync", async () => {
    await syncStore.set("settings", { globalEnabled: false } as never);
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      settings: { globalEnabled: false },
    });
  });
});

describe("onStorageChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls callback when watched key changes", () => {
    const callback = vi.fn();
    onStorageChange("scripts", callback);

    const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0]?.[0];
    expect(listener).toBeDefined();

    listener!(
      { scripts: { newValue: { abc: {} }, oldValue: {} } },
      "local",
    );

    expect(callback).toHaveBeenCalledWith({ abc: {} });
  });

  it("ignores changes to other keys", () => {
    const callback = vi.fn();
    onStorageChange("scripts", callback);

    const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0]?.[0];
    listener!({ shortcuts: { newValue: {} } }, "local");

    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores changes from sync area", () => {
    const callback = vi.fn();
    onStorageChange("scripts", callback);

    const listener = vi.mocked(chrome.storage.onChanged.addListener).mock.calls[0]?.[0];
    listener!({ scripts: { newValue: {} } }, "sync");

    expect(callback).not.toHaveBeenCalled();
  });

  it("returns unsubscribe function", () => {
    const callback = vi.fn();
    const unsubscribe = onStorageChange("scripts", callback);

    unsubscribe();
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled();
  });
});
