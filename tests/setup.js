import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";
function asyncMock(defaultValue = undefined) {
    return vi.fn().mockResolvedValue(defaultValue);
}
// Chrome storage API mock
const storageMock = {
    local: {
        get: asyncMock({}),
        set: asyncMock(),
        remove: asyncMock(),
        clear: asyncMock(),
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    sync: {
        get: asyncMock({}),
        set: asyncMock(),
        remove: asyncMock(),
        clear: asyncMock(),
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
};
const runtimeMock = {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
    id: "mock-extension-id",
};
const tabsMock = {
    query: asyncMock([]),
    sendMessage: vi.fn(),
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    create: vi.fn(),
    remove: vi.fn(),
};
const alarmsMock = {
    create: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
    get: vi.fn(),
    getAll: asyncMock([]),
    onAlarm: { addListener: vi.fn(), removeListener: vi.fn() },
};
const scriptingMock = {
    executeScript: asyncMock([]),
    insertCSS: asyncMock(),
    removeCSS: asyncMock(),
};
const notificationsMock = {
    create: vi.fn(),
    clear: vi.fn(),
    onClicked: { addListener: vi.fn() },
};
const actionMock = {
    setBadgeText: asyncMock(),
    setBadgeBackgroundColor: asyncMock(),
    onClicked: { addListener: vi.fn() },
};
globalThis.chrome = {
    storage: storageMock,
    runtime: runtimeMock,
    tabs: tabsMock,
    alarms: alarmsMock,
    scripting: scriptingMock,
    notifications: notificationsMock,
    action: actionMock,
};
