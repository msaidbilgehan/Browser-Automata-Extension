import {
  MousePointerClick,
  Type,
  ArrowDownUp,
  Code,
  Search,
  Clock,
  Hourglass,
  Loader,
  GitFork,
  Repeat,
  ExternalLink,
  X,
  Navigation,
  Clipboard,
  ClipboardPaste,
  TableProperties,
} from "lucide-react";
import { createElement } from "react";
import type { FlowNode, FlowNodeConfig, EntityId } from "@/shared/types/entities";

// ─── Constants ───────────────────────────────────────────────────────────────

export const NODE_CONFIG_TYPES = [
  { value: "click", label: "Click Element", group: "action" },
  { value: "type", label: "Type Text", group: "action" },
  { value: "scroll", label: "Scroll", group: "action" },
  { value: "script", label: "Run Script", group: "action" },
  { value: "extract", label: "Extract Value", group: "action" },
  { value: "run_extraction", label: "Run Extraction Rule", group: "action" },
  { value: "navigate", label: "Navigate", group: "action" },
  { value: "clipboard_copy", label: "Copy to Clipboard", group: "action" },
  { value: "clipboard_paste", label: "Paste from Clipboard", group: "action" },
  { value: "wait_element", label: "Wait for Element", group: "wait" },
  { value: "wait_ms", label: "Wait (ms)", group: "wait" },
  { value: "wait_idle", label: "Wait for Idle", group: "wait" },
  { value: "condition", label: "Condition (If/Else)", group: "condition" },
  { value: "loop", label: "Loop", group: "loop" },
  { value: "open_tab", label: "Open Tab", group: "open_tab" },
  { value: "close_tab", label: "Close Tab", group: "close_tab" },
] as const;

export type ConfigType = (typeof NODE_CONFIG_TYPES)[number]["value"];

export function configTypeToNodeType(
  configType: ConfigType,
): FlowNode["type"] {
  switch (configType) {
    case "click":
    case "type":
    case "scroll":
    case "script":
    case "extract":
    case "run_extraction":
    case "navigate":
    case "clipboard_copy":
    case "clipboard_paste":
      return "action";
    case "wait_element":
    case "wait_ms":
    case "wait_idle":
      return "wait";
    case "condition":
      return "condition";
    case "loop":
      return "loop";
    case "open_tab":
      return "open_tab";
    case "close_tab":
      return "close_tab";
  }
}

export function createDefaultConfig(configType: ConfigType): FlowNodeConfig {
  switch (configType) {
    case "click":
      return { type: "click", selector: "" };
    case "type":
      return { type: "type", selector: "", text: "" };
    case "scroll":
      return { type: "scroll", direction: "down", amount: 300 };
    case "script":
      return { type: "script", scriptId: "" as EntityId };
    case "extract":
      return { type: "extract", selector: "", outputVar: "" };
    case "run_extraction":
      return { type: "run_extraction", extractionRuleId: "" as EntityId };
    case "wait_element":
      return { type: "wait_element", selector: "", timeoutMs: 5000 };
    case "wait_ms":
      return { type: "wait_ms", duration: 1000 };
    case "wait_idle":
      return { type: "wait_idle" };
    case "condition":
      return {
        type: "condition",
        check: { type: "element_exists", selector: "" },
        thenNodeId: "",
      };
    case "loop":
      return { type: "loop", count: 3, bodyNodeIds: [] };
    case "open_tab":
      return { type: "open_tab", url: "" };
    case "close_tab":
      return { type: "close_tab" };
    case "navigate":
      return { type: "navigate", url: "" };
    case "clipboard_copy":
      return { type: "clipboard_copy", selector: "" };
    case "clipboard_paste":
      return { type: "clipboard_paste", selector: "" };
  }
}

const iconMap: Record<string, typeof MousePointerClick> = {
  click: MousePointerClick,
  type: Type,
  scroll: ArrowDownUp,
  script: Code,
  extract: Search,
  run_extraction: TableProperties,
  wait_element: Clock,
  wait_ms: Hourglass,
  wait_idle: Loader,
  condition: GitFork,
  loop: Repeat,
  open_tab: ExternalLink,
  close_tab: X,
  navigate: Navigation,
  clipboard_copy: Clipboard,
  clipboard_paste: ClipboardPaste,
};

export function getNodeIcon(configType: string) {
  const Icon = iconMap[configType] ?? Code;
  return createElement(Icon, { size: 12 });
}

export function getNodeLabel(configType: string): string {
  return NODE_CONFIG_TYPES.find((t) => t.value === configType)?.label ?? configType;
}

export function getNodeSummary(config: FlowNodeConfig): string {
  switch (config.type) {
    case "click": return config.selector || "(no selector)";
    case "type": return config.text ? `"${config.text.slice(0, 20)}${config.text.length > 20 ? "..." : ""}"` : "(no text)";
    case "scroll": return `${config.direction} ${String(config.amount)}px`;
    case "script": return config.scriptId || "(no script)";
    case "extract": return config.outputVar || config.selector || "(no config)";
    case "run_extraction": return config.extractionRuleId ? `Rule: ${config.extractionRuleId.slice(0, 8)}...` : "(no rule)";
    case "wait_element": return config.selector || "(no selector)";
    case "wait_ms": return `${String(config.duration)}ms`;
    case "wait_idle": return "until idle";
    case "condition": return config.check.selector ?? config.check.type;
    case "loop": return config.count !== undefined ? `${String(config.count)}x` : config.untilSelector ?? "loop";
    case "open_tab": return config.url || "(no url)";
    case "close_tab": return "current tab";
    case "navigate": return config.url || "(no url)";
    case "clipboard_copy": return config.selector || "(no selector)";
    case "clipboard_paste": return config.selector || "(no selector)";
  }
}
