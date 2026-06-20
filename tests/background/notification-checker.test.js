import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkNotificationRuleById } from "@/background/services/notification-checker";
import { mockFn } from "../helpers";
/**
 * Regression tests for C1 — notification rules never fired because the alarm
 * handler discarded `notification-check:` alarms (only `schedule:` was routed).
 * The fix routes them to {@link checkNotificationRuleById}; these tests confirm
 * the per-rule check actually raises a notification when its condition is met.
 */
function notificationRule(id, enabled = true) {
    return {
        id,
        name: `rule-${id}`,
        scope: { type: "global", value: "" },
        enabled,
        profileId: null,
        condition: { type: "element_appears", selector: ".target" },
        checkIntervalMinutes: 5,
        notification: { title: "Found", message: "Element appeared", sound: false },
        meta: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    };
}
describe("checkNotificationRuleById (C1)", () => {
    let notificationRules;
    let notificationsEnabled;
    beforeEach(() => {
        vi.clearAllMocks();
        notificationRules = {};
        notificationsEnabled = true;
        mockFn(chrome.storage.sync.get).mockImplementation(async () => ({
            settings: { notifications: { enabled: notificationsEnabled } },
        }));
        mockFn(chrome.storage.local.get).mockImplementation(async (key) => key === "notificationRules" ? { notificationRules } : {});
        mockFn(chrome.tabs.query).mockResolvedValue([{ id: 1, url: "https://example.com" }]);
    });
    it("fires a notification when the rule's condition is met", async () => {
        notificationRules = { r1: notificationRule("r1") };
        mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: true }]);
        await checkNotificationRuleById("r1");
        expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
    });
    it("does not fire when the condition is not met", async () => {
        notificationRules = { r1: notificationRule("r1") };
        mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: false }]);
        await checkNotificationRuleById("r1");
        expect(chrome.notifications.create).not.toHaveBeenCalled();
    });
    it("no-ops when notifications are globally disabled", async () => {
        notificationsEnabled = false;
        notificationRules = { r1: notificationRule("r1") };
        await checkNotificationRuleById("r1");
        expect(chrome.tabs.query).not.toHaveBeenCalled();
        expect(chrome.notifications.create).not.toHaveBeenCalled();
    });
    it("no-ops for a disabled rule", async () => {
        notificationRules = { r1: notificationRule("r1", false) };
        await checkNotificationRuleById("r1");
        expect(chrome.tabs.query).not.toHaveBeenCalled();
        expect(chrome.notifications.create).not.toHaveBeenCalled();
    });
    it("no-ops for an unknown rule id", async () => {
        notificationRules = { r1: notificationRule("r1") };
        await checkNotificationRuleById("does-not-exist");
        expect(chrome.tabs.query).not.toHaveBeenCalled();
        expect(chrome.notifications.create).not.toHaveBeenCalled();
    });
});
/**
 * Regression tests for the dormant defect "text_changes never detects a change"
 * and "no cooldown → notification spam". The fix tracks per-rule+tab state in
 * chrome.storage.session: text_changes fires only on a real text change, and the
 * boolean conditions are edge-triggered so a persistently-true condition does
 * not re-notify every check interval.
 */
describe("checkNotificationRuleById — change detection & anti-spam", () => {
    let notificationRules;
    let sessionStore;
    beforeEach(() => {
        vi.clearAllMocks();
        notificationRules = {};
        sessionStore = {};
        mockFn(chrome.storage.sync.get).mockResolvedValue({
            settings: { notifications: { enabled: true } },
        });
        mockFn(chrome.storage.local.get).mockImplementation(async (key) => key === "notificationRules" ? { notificationRules } : {});
        mockFn(chrome.tabs.query).mockResolvedValue([{ id: 1, url: "https://example.com" }]);
        // Stateful session storage so per-rule+tab state survives across checks.
        mockFn(chrome.storage.session.get).mockImplementation(async (key) => key in sessionStore ? { [key]: sessionStore[key] } : {});
        mockFn(chrome.storage.session.set).mockImplementation(async (items) => {
            Object.assign(sessionStore, items);
        });
    });
    function textChangesRule(id) {
        return {
            id,
            name: `rule-${id}`,
            scope: { type: "global", value: "" },
            enabled: true,
            profileId: null,
            condition: { type: "text_changes", selector: ".price" },
            checkIntervalMinutes: 5,
            notification: { title: "Changed", message: "Text changed", sound: false },
            meta: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        };
    }
    it("text_changes does not fire on first observation (establishes baseline)", async () => {
        notificationRules = { r1: textChangesRule("r1") };
        mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: "$10.00" }]);
        await checkNotificationRuleById("r1");
        expect(chrome.notifications.create).not.toHaveBeenCalled();
    });
    it("text_changes fires when the text differs from the last observed value", async () => {
        notificationRules = { r1: textChangesRule("r1") };
        mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: "$10.00" }]);
        await checkNotificationRuleById("r1"); // baseline
        mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: "$12.00" }]);
        await checkNotificationRuleById("r1"); // changed
        expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
    });
    it("text_changes does not fire when the text is unchanged", async () => {
        notificationRules = { r1: textChangesRule("r1") };
        mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: "$10.00" }]);
        await checkNotificationRuleById("r1"); // baseline
        await checkNotificationRuleById("r1"); // same value
        expect(chrome.notifications.create).not.toHaveBeenCalled();
    });
    it("element_appears is edge-triggered: no re-notify while it stays present", async () => {
        notificationRules = { r1: notificationRule("r1") };
        mockFn(chrome.scripting.executeScript).mockResolvedValue([{ result: true }]);
        await checkNotificationRuleById("r1"); // appears → fires once
        await checkNotificationRuleById("r1"); // still present → must NOT re-fire
        expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
    });
});
