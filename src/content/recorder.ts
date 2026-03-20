/** Action recorder — captures user interactions and generates scripts */

import { generateSelector } from "./element-picker";

/** Recorded action types */
interface ClickAction {
  type: "click";
  selector: string;
  text: string;
  timestamp: number;
}

interface TypeAction {
  type: "type";
  selector: string;
  value: string;
  timestamp: number;
}

interface ScrollAction {
  type: "scroll";
  direction: "up" | "down";
  amount: number;
  timestamp: number;
}

interface NavigateAction {
  type: "navigate";
  url: string;
  timestamp: number;
}

type RecordedAction = ClickAction | TypeAction | ScrollAction | NavigateAction;

let isRecording = false;
let recordedActions: RecordedAction[] = [];

/** Typing debounce state */
let typeBuffer = "";
let typeTarget: Element | null = null;
let typeTimeout: ReturnType<typeof setTimeout> | null = null;
const TYPE_DEBOUNCE_MS = 500;

/** Send a recorded action to the service worker */
function sendAction(action: RecordedAction): void {
  const messagePayload: {
    type: "RECORDED_ACTION";
    action: {
      type: "click" | "type" | "scroll" | "navigate";
      selector?: string;
      value?: string;
      url?: string;
    };
  } = {
    type: "RECORDED_ACTION",
    action: {
      type: action.type,
    },
  };

  switch (action.type) {
    case "click":
      messagePayload.action.selector = action.selector;
      messagePayload.action.value = action.text;
      break;
    case "type":
      messagePayload.action.selector = action.selector;
      messagePayload.action.value = action.value;
      break;
    case "scroll":
      messagePayload.action.value = `${action.direction}:${String(action.amount)}`;
      break;
    case "navigate":
      messagePayload.action.url = action.url;
      break;
  }

  try {
    if (chrome.runtime?.id === undefined) return;
  } catch {
    return;
  }
  chrome.runtime.sendMessage(messagePayload).catch(() => {
    // Service worker may not be ready
  });
}

/** Flush accumulated typing buffer as a single type action */
function flushTypeBuffer(): void {
  if (typeBuffer.length === 0 || typeTarget === null) return;

  const action: TypeAction = {
    type: "type",
    selector: generateSelector(typeTarget),
    value: typeBuffer,
    timestamp: Date.now(),
  };

  recordedActions.push(action);
  sendAction(action);

  typeBuffer = "";
  typeTarget = null;
  if (typeTimeout !== null) {
    clearTimeout(typeTimeout);
    typeTimeout = null;
  }
}

/** Handle click events */
function onRecordClick(e: MouseEvent): void {
  if (!isRecording) return;

  // Flush any pending typing
  flushTypeBuffer();

  const target = e.target;
  if (!(target instanceof Element)) return;

  const selector = generateSelector(target);
  const text = target instanceof HTMLElement ? (target.textContent ?? "").trim().slice(0, 100) : "";

  const action: ClickAction = {
    type: "click",
    selector,
    text,
    timestamp: Date.now(),
  };

  recordedActions.push(action);
  sendAction(action);
}

/** Handle keydown events — accumulate typing with debounce */
function onRecordKeyDown(e: KeyboardEvent): void {
  if (!isRecording) return;

  const target = e.target;
  if (
    !(target instanceof HTMLInputElement) &&
    !(target instanceof HTMLTextAreaElement) &&
    !(target instanceof HTMLElement && target.isContentEditable)
  ) {
    return;
  }

  // If the target changed, flush the old buffer
  if (typeTarget !== null && typeTarget !== target) {
    flushTypeBuffer();
  }

  typeTarget = target;

  // Accumulate printable characters
  if (e.key.length === 1) {
    typeBuffer += e.key;
  } else if (e.key === "Backspace" && typeBuffer.length > 0) {
    typeBuffer = typeBuffer.slice(0, -1);
  } else if (e.key === "Enter") {
    typeBuffer += "\n";
  }

  // Reset debounce timer
  if (typeTimeout !== null) {
    clearTimeout(typeTimeout);
  }
  typeTimeout = setTimeout(() => {
    flushTypeBuffer();
  }, TYPE_DEBOUNCE_MS);
}

/** Handle scroll events */
function onRecordScroll(): void {
  if (!isRecording) return;

  // Debounce scroll — only record once scrolling stops
  const scrollY = window.scrollY;

  // Use a simple heuristic: compare to last recorded scroll action
  const lastAction = recordedActions[recordedActions.length - 1];
  if (lastAction?.type === "scroll") {
    // Update the existing scroll action instead of creating a new one
    const prevAmount = lastAction.amount;
    const newAmount = scrollY;
    lastAction.direction = newAmount > prevAmount ? "down" : "up";
    lastAction.amount = newAmount;
    lastAction.timestamp = Date.now();
    return;
  }

  const action: ScrollAction = {
    type: "scroll",
    direction: "down",
    amount: scrollY,
    timestamp: Date.now(),
  };

  recordedActions.push(action);
  sendAction(action);
}

/** Handle navigation via popstate */
function onPopState(): void {
  if (!isRecording) return;

  flushTypeBuffer();

  const action: NavigateAction = {
    type: "navigate",
    url: location.href,
    timestamp: Date.now(),
  };

  recordedActions.push(action);
  sendAction(action);
}

/** Start recording user actions */
export function startRecording(): void {
  if (isRecording) return;
  isRecording = true;
  recordedActions = [];
  typeBuffer = "";
  typeTarget = null;
  if (typeTimeout !== null) {
    clearTimeout(typeTimeout);
    typeTimeout = null;
  }

  document.addEventListener("click", onRecordClick, true);
  document.addEventListener("keydown", onRecordKeyDown, true);
  window.addEventListener("scroll", onRecordScroll, { passive: true });
  window.addEventListener("popstate", onPopState);
}

/** Stop recording and return all recorded actions */
export function stopRecording(): RecordedAction[] {
  if (!isRecording) return [];

  // Flush any pending typing
  flushTypeBuffer();

  isRecording = false;

  document.removeEventListener("click", onRecordClick, true);
  document.removeEventListener("keydown", onRecordKeyDown, true);
  window.removeEventListener("scroll", onRecordScroll);
  window.removeEventListener("popstate", onPopState);

  const actions = [...recordedActions];
  recordedActions = [];
  return actions;
}

/** Convert recorded actions to a JavaScript code string */
export function generateScriptFromActions(actions: RecordedAction[]): string {
  const lines: string[] = [
    "// Auto-generated script from Browser Automata recorder",
    "(async () => {",
  ];

  for (const action of actions) {
    switch (action.type) {
      case "click":
        lines.push(`  // Click: ${action.text.slice(0, 50)}`);
        lines.push(`  document.querySelector(${JSON.stringify(action.selector)})?.click();`);
        lines.push(`  await new Promise(r => setTimeout(r, 300));`);
        break;
      case "type":
        lines.push(`  // Type text`);
        lines.push(`  {`);
        lines.push(`    const el = document.querySelector(${JSON.stringify(action.selector)});`);
        lines.push(
          `    if (el) { el.focus(); el.value = ${JSON.stringify(action.value)}; el.dispatchEvent(new Event("input", { bubbles: true })); }`,
        );
        lines.push(`  }`);
        lines.push(`  await new Promise(r => setTimeout(r, 200));`);
        break;
      case "scroll":
        lines.push(`  // Scroll ${action.direction}`);
        lines.push(`  window.scrollTo({ top: ${String(action.amount)}, behavior: "smooth" });`);
        lines.push(`  await new Promise(r => setTimeout(r, 500));`);
        break;
      case "navigate":
        lines.push(`  // Navigate`);
        lines.push(`  window.location.href = ${JSON.stringify(action.url)};`);
        break;
    }
    lines.push("");
  }

  lines.push("})();");
  return lines.join("\n");
}
