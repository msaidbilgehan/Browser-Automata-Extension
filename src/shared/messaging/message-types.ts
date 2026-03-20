import type { Message, SWToContentMessage } from "../types/messages";

/** Type guard: checks if a value looks like a valid extension message */
export function isMessage(value: unknown): value is Message {
  return typeof value === "object" && value !== null && "type" in value;
}

/** Extract message type string for dispatch matching */
export function getMessageType(message: Message): Message["type"] {
  return message.type;
}

const SW_TO_CONTENT_TYPES = new Set([
  "PING",
  "UPDATE_SHORTCUTS",
  "START_RECORDING",
  "STOP_RECORDING",
  "PICK_ELEMENT",
  "EXTRACT_DATA",
  "TEST_SELECTOR",
  "CLEAR_TEST_HIGHLIGHT",
]);

/** Type guard: checks if a value is a service-worker-to-content message */
export function isSWToContentMessage(value: unknown): value is SWToContentMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string" &&
    SW_TO_CONTENT_TYPES.has((value as { type: string }).type)
  );
}
