import { describe, it, expect } from "vitest";
import { isMessage, getMessageType } from "@/shared/messaging/message-types";

describe("isMessage", () => {
  it("returns true for valid messages with type field", () => {
    expect(isMessage({ type: "GET_STATE" })).toBe(true);
    expect(isMessage({ type: "CONTENT_READY", url: "https://example.com" })).toBe(true);
    expect(isMessage({ type: "PING" })).toBe(true);
  });

  it("returns false for non-message values", () => {
    expect(isMessage(null)).toBe(false);
    expect(isMessage(undefined)).toBe(false);
    expect(isMessage("string")).toBe(false);
    expect(isMessage(42)).toBe(false);
    expect(isMessage({})).toBe(false);
    expect(isMessage([])).toBe(false);
  });
});

describe("getMessageType", () => {
  it("extracts the type field from a message", () => {
    expect(getMessageType({ type: "GET_STATE" })).toBe("GET_STATE");
    expect(getMessageType({ type: "PING" })).toBe("PING");
    expect(getMessageType({ type: "CONTENT_READY", url: "https://test.com" })).toBe(
      "CONTENT_READY",
    );
  });
});
