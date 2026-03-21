import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
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
  Play,
} from "lucide-react";
import type { FlowNode, FlowNodeConfig, EntityId, ConditionCheck, ExtractionOutputAction, ExtractionRule } from "@/shared/types/entities";
import type { ExtractionRunResponse } from "@/shared/types/messages";
import { localStore } from "@/shared/storage";
import { sendToBackground } from "@/shared/messaging";
import { TransformEditor } from "./TransformEditor";
import { SelectorSourceList } from "./SelectorSourceList";
import { generateId } from "@/shared/utils";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { SelectorInput } from "./SelectorInput";

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_CONFIG_TYPES = [
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

type ConfigType = (typeof NODE_CONFIG_TYPES)[number]["value"];

function configTypeToNodeType(
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

function createDefaultConfig(configType: ConfigType): FlowNodeConfig {
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

function getNodeIcon(configType: string) {
  switch (configType) {
    case "click": return <MousePointerClick size={12} />;
    case "type": return <Type size={12} />;
    case "scroll": return <ArrowDownUp size={12} />;
    case "script": return <Code size={12} />;
    case "extract": return <Search size={12} />;
    case "run_extraction": return <TableProperties size={12} />;
    case "wait_element": return <Clock size={12} />;
    case "wait_ms": return <Hourglass size={12} />;
    case "wait_idle": return <Loader size={12} />;
    case "condition": return <GitFork size={12} />;
    case "loop": return <Repeat size={12} />;
    case "open_tab": return <ExternalLink size={12} />;
    case "close_tab": return <X size={12} />;
    case "navigate": return <Navigation size={12} />;
    case "clipboard_copy": return <Clipboard size={12} />;
    case "clipboard_paste": return <ClipboardPaste size={12} />;
    default: return <Code size={12} />;
  }
}

function getNodeLabel(configType: string): string {
  return NODE_CONFIG_TYPES.find((t) => t.value === configType)?.label ?? configType;
}

function getNodeSummary(config: FlowNodeConfig): string {
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

// ─── Output Action Checkboxes ─────────────────────────────────────────────────

const OUTPUT_ACTION_OPTIONS: { value: ExtractionOutputAction; label: string }[] = [
  { value: "show", label: "Show in Logs" },
  { value: "show_page", label: "Show on Page" },
  { value: "show_tab", label: "Show in New Tab" },
  { value: "clipboard", label: "Copy to Clipboard" },
  { value: "download", label: "Download File" },
];

function OutputActionCheckboxes({
  value,
  onChange,
}: {
  value: ExtractionOutputAction[];
  onChange: (actions: ExtractionOutputAction[]) => void;
}) {
  const toggle = (action: ExtractionOutputAction) => {
    if (value.includes(action)) {
      if (value.length <= 1) return;
      onChange(value.filter((a) => a !== action));
    } else {
      onChange([...value, action]);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-secondary text-xs font-medium">After Extraction</span>
      <div className="flex flex-wrap gap-1.5">
        {OUTPUT_ACTION_OPTIONS.map((opt) => {
          const checked = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { toggle(opt.value); }}
              className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
                checked
                  ? "border-active bg-active/10 text-active"
                  : "border-border bg-bg-tertiary text-text-muted hover:border-border-active hover:text-text-secondary"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Extraction Test Panel ────────────────────────────────────────────────────

function TestResultPanel({
  result,
  onClose,
}: {
  result: ExtractionRunResponse;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!result.ok) {
    return (
      <div className="border-error/30 bg-error/5 flex items-start gap-1.5 rounded-md border p-2">
        <p className="text-error min-w-0 flex-1 text-[10px]">{result.error}</p>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary shrink-0">
          <X size={10} />
        </button>
      </div>
    );
  }

  const rowCount = result.data?.length ?? 0;

  return (
    <div className="border-border bg-bg-primary flex flex-col gap-1 rounded-md border">
      <div className="border-border flex items-center gap-1.5 border-b px-2 py-1">
        <span className="text-text-primary flex-1 text-[10px] font-medium">Test Result</span>
        <span className="bg-bg-tertiary text-text-muted rounded px-1 py-0.5 text-[9px]">
          {String(rowCount)} row{rowCount !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            if (result.formatted) {
              void navigator.clipboard.writeText(result.formatted).then(() => {
                setCopied(true);
                setTimeout(() => { setCopied(false); }, 1500);
              });
            }
          }}
          className={`text-[9px] ${copied ? "text-active" : "text-text-muted hover:text-text-primary"}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={10} />
        </button>
      </div>
      <pre className="text-text-secondary max-h-32 overflow-auto px-2 py-1 font-mono text-[9px] leading-relaxed">
        {result.formatted ?? "No data"}
      </pre>
    </div>
  );
}

function ExtractTestButton({
  fields,
  outputFormat,
  disabled,
}: {
  fields: { name: string; selector: string; attribute?: string; multiple: boolean; transforms?: import("@/shared/types/entities").ExtractionFieldTransform[] }[];
  outputFormat?: ExtractionRule["outputFormat"];
  disabled?: boolean;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ExtractionRunResponse | null>(null);

  const handleTest = async () => {
    setResult(null);
    setTesting(true);
    try {
      const res = await sendToBackground({
        type: "EXTRACTION_TEST",
        fields,
        outputFormat: outputFormat ?? "json",
      });
      setResult(res ?? { ok: false, error: "No response" });
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { void handleTest(); }}
        disabled={disabled || testing}
        className="border-border bg-bg-tertiary text-text-secondary hover:border-active hover:text-active disabled:opacity-40 flex items-center gap-1 self-start rounded-md border px-2 py-1 text-[10px] font-medium transition-colors"
      >
        <Play size={10} />
        {testing ? "Testing..." : "Test Extract"}
      </button>
      {result && (
        <TestResultPanel result={result} onClose={() => { setResult(null); }} />
      )}
    </>
  );
}

function RunExtractionTestButton({ ruleId }: { ruleId: EntityId }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ExtractionRunResponse | null>(null);

  const handleTest = async () => {
    if (!ruleId) return;
    setResult(null);
    setTesting(true);
    try {
      const res = await sendToBackground({ type: "EXTRACTION_RUN_NOW", ruleId });
      setResult(res ?? { ok: false, error: "No response" });
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { void handleTest(); }}
        disabled={!ruleId || testing}
        className="border-border bg-bg-tertiary text-text-secondary hover:border-active hover:text-active disabled:opacity-40 flex items-center gap-1 self-start rounded-md border px-2 py-1 text-[10px] font-medium transition-colors"
      >
        <Play size={10} />
        {testing ? "Testing..." : "Test Extract"}
      </button>
      {result && (
        <TestResultPanel result={result} onClose={() => { setResult(null); }} />
      )}
    </>
  );
}

// ─── Extraction Rule Selector ─────────────────────────────────────────────────

function ExtractionRuleSelect({
  value,
  onChange,
}: {
  value: EntityId;
  onChange: (id: EntityId) => void;
}) {
  const [rules, setRules] = useState<ExtractionRule[]>([]);

  useEffect(() => {
    void localStore.get("extractionRules").then((data) => {
      const map = data ?? {};
      setRules(
        Object.values(map)
          .filter((r): r is ExtractionRule => r != null && typeof r.name === "string")
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    });
  }, []);

  const selected = useMemo(() => rules.find((r) => r.id === value), [rules, value]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-secondary text-xs font-medium">Extraction Rule</span>
      {rules.length === 0 ? (
        <p className="text-text-muted text-[10px]">
          No extraction rules found. Create one in the Extraction Rules tab first.
        </p>
      ) : (
        <>
          <select
            value={value}
            onChange={(e) => { onChange(e.target.value as EntityId); }}
            className="border-border bg-bg-primary text-text-primary focus:border-border-active rounded-md border px-2 py-1.5 text-xs outline-none"
          >
            <option value="">Select a rule...</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name || "Untitled"} ({String(r.fields.length)} field{r.fields.length !== 1 ? "s" : ""}, {r.outputFormat})
              </option>
            ))}
          </select>
          {selected && (
            <div className="text-text-muted flex flex-wrap gap-1 text-[9px]">
              <span>Format: {selected.outputFormat.toUpperCase()}</span>
              <span>·</span>
              <span>Fields: {selected.fields.map((f) => f.name || "?").join(", ")}</span>
              {selected.outputActions.length > 0 && (
                <>
                  <span>·</span>
                  <span>Actions: {selected.outputActions.join(", ")}</span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Node Config Form ────────────────────────────────────────────────────────

function NodeConfigForm({
  config,
  onChange,
  nodeId,
  onPickStart,
}: {
  config: FlowNodeConfig;
  onChange: (config: FlowNodeConfig) => void;
  nodeId: string;
  onPickStart?: (() => void) | undefined;
}) {
  switch (config.type) {
    case "click":
      return (
        <SelectorInput
          label="CSS Selector"
          value={config.selector}
          onChange={(value) => { onChange({ ...config, selector: value }); }}
          pickId={`flow-${nodeId}-click-selector`}
          placeholder="#submit-btn, .my-button"
          onPickStart={onPickStart}
          compact
        />
      );

    case "type":
      return (
        <div className="flex flex-col gap-2">
          <SelectorInput
            label="CSS Selector"
            value={config.selector}
            onChange={(value) => { onChange({ ...config, selector: value }); }}
            pickId={`flow-${nodeId}-type-selector`}
            placeholder="#email-input"
            onPickStart={onPickStart}
            compact
          />
          <Input
            label="Text to Type"
            value={config.text}
            onChange={(e) => { onChange({ ...config, text: e.target.value }); }}
            placeholder="Hello {{myVar}}"
          />
          <p className="text-text-muted text-[9px]">Use {"{{varName}}"} to insert extracted values</p>
        </div>
      );

    case "scroll":
      return (
        <div className="flex items-end gap-2">
          <Select
            label="Direction"
            value={config.direction}
            onChange={(e) => {
              onChange({
                ...config,
                direction: e.target.value as "up" | "down",
              });
            }}
            options={[
              { value: "down", label: "Down" },
              { value: "up", label: "Up" },
            ]}
          />
          <Input
            label="Amount (px)"
            type="number"
            value={String(config.amount)}
            onChange={(e) => { onChange({ ...config, amount: Number(e.target.value) }); }}
            placeholder="300"
          />
        </div>
      );

    case "script":
      return (
        <Input
          label="Script ID"
          value={config.scriptId}
          onChange={(e) => { onChange({ ...config, scriptId: e.target.value as EntityId }); }}
          placeholder="Paste script ID"
        />
      );

    case "extract":
      return (
        <div className="flex flex-col gap-2">
          <SelectorSourceList
            selector={config.selector}
            fallbackSelectors={config.fallbackSelectors ?? []}
            onChange={(selector, fallbackSelectors) => {
              const next = { ...config, selector };
              if (fallbackSelectors.length > 0) {
                (next as typeof config & { fallbackSelectors: string[] }).fallbackSelectors = fallbackSelectors;
              } else {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete (next as Record<string, unknown>)["fallbackSelectors"];
              }
              onChange(next);
            }}
            pickIdPrefix={`flow-${nodeId}-extract`}
            onPickStart={onPickStart}
          />
          <Input
            label="Attribute (optional)"
            value={config.attribute ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                onChange({ ...config, attribute: val });
              } else {
                const { attribute: _, ...rest } = config;
                onChange(rest as typeof config);
              }
            }}
            placeholder="href, src, textContent"
          />
          <Input
            label="Output Variable"
            value={config.outputVar}
            onChange={(e) => { onChange({ ...config, outputVar: e.target.value }); }}
            placeholder="myVar"
          />
          <TransformEditor
            transforms={config.transforms ?? []}
            onChange={(transforms) => { onChange({ ...config, transforms }); }}
          />
          <OutputActionCheckboxes
            value={config.outputActions ?? ["show"]}
            onChange={(actions) => { onChange({ ...config, outputActions: actions }); }}
          />
          <ExtractTestButton
            fields={[{
              name: config.outputVar || "value",
              selector: config.selector,
              ...(config.fallbackSelectors ? { fallbackSelectors: config.fallbackSelectors } : {}),
              ...(config.attribute ? { attribute: config.attribute } : {}),
              multiple: false,
              ...(config.transforms ? { transforms: config.transforms } : {}),
            }]}
            disabled={!config.selector}
          />
        </div>
      );

    case "run_extraction":
      return (
        <div className="flex flex-col gap-2">
          <ExtractionRuleSelect
            value={config.extractionRuleId}
            onChange={(extractionRuleId) => { onChange({ ...config, extractionRuleId }); }}
          />
          <RunExtractionTestButton ruleId={config.extractionRuleId} />
        </div>
      );

    case "wait_element":
      return (
        <div className="flex flex-col gap-2">
          <SelectorInput
            label="CSS Selector"
            value={config.selector}
            onChange={(value) => { onChange({ ...config, selector: value }); }}
            pickId={`flow-${nodeId}-wait-selector`}
            placeholder="#loading-done"
            onPickStart={onPickStart}
            compact
          />
          <Input
            label="Timeout (ms)"
            type="number"
            value={String(config.timeoutMs)}
            onChange={(e) => { onChange({ ...config, timeoutMs: Number(e.target.value) }); }}
            placeholder="5000"
          />
        </div>
      );

    case "wait_ms":
      return (
        <Input
          label="Duration (ms)"
          type="number"
          value={String(config.duration)}
          onChange={(e) => { onChange({ ...config, duration: Number(e.target.value) }); }}
          placeholder="1000"
        />
      );

    case "wait_idle":
      return (
        <p className="text-text-muted text-[10px]">
          Waits until the page network is idle. No configuration needed.
        </p>
      );

    case "condition":
      return (
        <div className="flex flex-col gap-2">
          <Select
            label="Condition Type"
            value={config.check.type}
            onChange={(e) => {
              const checkType = e.target.value as ConditionCheck["type"];
              const check: ConditionCheck = { type: checkType };
              if (config.check.selector) check.selector = config.check.selector;
              if (config.check.value) check.value = config.check.value;
              onChange({ ...config, check });
            }}
            options={[
              { value: "element_exists", label: "Element Exists" },
              { value: "element_visible", label: "Element Visible" },
              { value: "text_contains", label: "Text Contains" },
              { value: "url_matches", label: "URL Matches" },
            ]}
          />
          {config.check.type !== "url_matches" ? (
            <SelectorInput
              label="Selector"
              value={config.check.selector ?? ""}
              onChange={(value) => {
                onChange({
                  ...config,
                  check: { ...config.check, selector: value },
                });
              }}
              pickId={`flow-${nodeId}-condition-selector`}
              placeholder=".success-msg"
              onPickStart={onPickStart}
              compact
            />
          ) : null}
          {config.check.type === "text_contains" || config.check.type === "url_matches" ? (
            <Input
              label="Value"
              value={config.check.value ?? ""}
              onChange={(e) => {
                onChange({
                  ...config,
                  check: { ...config.check, value: e.target.value },
                });
              }}
              placeholder={config.check.type === "url_matches" ? "*/dashboard*" : "Success"}
            />
          ) : null}
        </div>
      );

    case "loop":
      return (
        <div className="flex flex-col gap-2">
          <Input
            label="Loop Count"
            type="number"
            value={config.count !== undefined ? String(config.count) : ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                onChange({ ...config, count: Number(val) });
              } else {
                const { count: _, ...rest } = config;
                onChange(rest as typeof config);
              }
            }}
            placeholder="3"
          />
          <SelectorInput
            label="Until Selector (optional)"
            value={config.untilSelector ?? ""}
            onChange={(value) => {
              if (value) {
                onChange({ ...config, untilSelector: value });
              } else {
                const { untilSelector: _, ...rest } = config;
                onChange(rest as typeof config);
              }
            }}
            pickId={`flow-${nodeId}-loop-until-selector`}
            placeholder=".no-more-items"
            onPickStart={onPickStart}
            compact
          />
        </div>
      );

    case "open_tab":
      return (
        <div className="flex flex-col gap-2">
          <Input
            label="URL"
            value={config.url}
            onChange={(e) => { onChange({ ...config, url: e.target.value }); }}
            placeholder="https://example.com/{{path}}"
          />
          <p className="text-text-muted text-[9px]">Use {"{{varName}}"} to insert extracted values</p>
        </div>
      );

    case "close_tab":
      return (
        <p className="text-text-muted text-[10px]">
          Closes the current tab. No configuration needed.
        </p>
      );

    case "navigate":
      return (
        <div className="flex flex-col gap-2">
          <Input
            label="URL"
            value={config.url}
            onChange={(e) => { onChange({ ...config, url: e.target.value }); }}
            placeholder="https://google.com/search?q={{searchTerm}}"
          />
          <p className="text-text-muted text-[9px]">Use {"{{varName}}"} to insert extracted values</p>
        </div>
      );

    case "clipboard_copy":
      return (
        <SelectorInput
          label="CSS Selector"
          value={config.selector}
          onChange={(value) => { onChange({ ...config, selector: value }); }}
          pickId={`flow-${nodeId}-clipboard-copy-selector`}
          placeholder=".copy-target"
          onPickStart={onPickStart}
          compact
        />
      );

    case "clipboard_paste":
      return (
        <SelectorInput
          label="CSS Selector"
          value={config.selector}
          onChange={(value) => { onChange({ ...config, selector: value }); }}
          pickId={`flow-${nodeId}-clipboard-paste-selector`}
          placeholder="#paste-target"
          onPickStart={onPickStart}
          compact
        />
      );
  }
}

// ─── Single Node Row ─────────────────────────────────────────────────────────

function FlowNodeRow({
  node,
  index,
  totalCount,
  expanded,
  onToggle,
  onUpdate,
  onMove,
  onDelete,
  onPickStart,
}: {
  node: FlowNode;
  index: number;
  totalCount: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (node: FlowNode) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
  onPickStart?: (() => void) | undefined;
}) {
  return (
    <div className="border-border bg-bg-secondary rounded-md border">
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="hover:bg-bg-tertiary flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-text-muted shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-text-muted shrink-0" />
        )}
        <span className="text-text-muted shrink-0 font-mono text-[10px]">
          {String(index + 1)}.
        </span>
        <span className="text-active shrink-0">{getNodeIcon(node.config.type)}</span>
        <span className="text-text-primary min-w-0 flex-1 truncate text-xs font-medium">
          {getNodeLabel(node.config.type)}
        </span>
        {!expanded ? (
          <span className="text-text-muted min-w-0 truncate text-[10px]">
            {getNodeSummary(node.config)}
          </span>
        ) : null}
      </button>

      {/* Expanded config */}
      {expanded ? (
        <div className="border-border flex flex-col gap-2 border-t px-2.5 py-2">
          <NodeConfigForm
            config={node.config}
            onChange={(config) => { onUpdate({ ...node, config }); }}
            nodeId={node.id}
            onPickStart={onPickStart}
          />

          {/* Actions row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => { onMove("up"); }}
                disabled={index === 0}
                className="text-text-muted hover:text-text-primary disabled:opacity-30 rounded p-0.5 transition-colors"
                aria-label="Move up"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => { onMove("down"); }}
                disabled={index === totalCount - 1}
                className="text-text-muted hover:text-text-primary disabled:opacity-30 rounded p-0.5 transition-colors"
                aria-label="Move down"
              >
                <ArrowDown size={12} />
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="text-text-muted hover:text-error flex items-center gap-1 rounded p-0.5 text-[10px] transition-colors"
              aria-label="Delete node"
            >
              <Trash2 size={11} />
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Add Node Menu ───────────────────────────────────────────────────────────

function AddNodeMenu({
  onAdd,
  onClose,
}: {
  onAdd: (configType: ConfigType) => void;
  onClose: () => void;
}) {
  const groups = [
    { label: "Actions", types: NODE_CONFIG_TYPES.filter((t) => t.group === "action") },
    { label: "Wait", types: NODE_CONFIG_TYPES.filter((t) => t.group === "wait") },
    { label: "Control Flow", types: NODE_CONFIG_TYPES.filter((t) => t.group === "condition" || t.group === "loop") },
    { label: "Tabs", types: NODE_CONFIG_TYPES.filter((t) => t.group === "open_tab" || t.group === "close_tab") },
  ];

  return (
    <div className="border-border bg-bg-secondary rounded-md border p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-text-secondary text-[10px] font-semibold uppercase tracking-wide">
          Add Node
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-primary rounded p-0.5 transition-colors"
          aria-label="Close menu"
        >
          <X size={12} />
        </button>
      </div>
      {groups.map((group) => (
        <div key={group.label} className="mb-1.5">
          <span className="text-text-muted mb-0.5 block text-[9px] font-medium uppercase tracking-wider">
            {group.label}
          </span>
          <div className="flex flex-wrap gap-1">
            {group.types.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => { onAdd(t.value); }}
                className="border-border bg-bg-tertiary text-text-primary hover:border-active hover:text-active flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors"
              >
                {getNodeIcon(t.value)}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

interface FlowNodeEditorProps {
  nodes: FlowNode[];
  onChange: (nodes: FlowNode[]) => void;
  /** Called before element picker activates (persist draft before popup closes) */
  onPickStart?: (() => void) | undefined;
  /** Restore a previously expanded node (e.g. after draft restore) */
  initialExpandedId?: string | null | undefined;
  /** Notifies parent when the expanded node changes (for draft persistence) */
  onExpandChange?: ((nodeId: string | null) => void) | undefined;
}

export function FlowNodeEditor({ nodes, onChange, onPickStart, initialExpandedId, onExpandChange }: FlowNodeEditorProps) {
  const [expandedId, setExpandedIdRaw] = useState<string | null>(initialExpandedId ?? null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const setExpandedId = useCallback(
    (id: string | null) => {
      setExpandedIdRaw(id);
      onExpandChange?.(id);
    },
    [onExpandChange],
  );

  // Sync expanded state when initialExpandedId prop arrives after initial mount
  // (handles race between zustand and React state updates during draft restoration)
  const lastAppliedInitialRef = useRef<string | null>(initialExpandedId ?? null);
  useEffect(() => {
    if (initialExpandedId != null && initialExpandedId !== lastAppliedInitialRef.current) {
      lastAppliedInitialRef.current = initialExpandedId;
      setExpandedIdRaw(initialExpandedId);
      onExpandChange?.(initialExpandedId);
    }
  }, [initialExpandedId, onExpandChange]);

  const handleAdd = useCallback(
    (configType: ConfigType) => {
      const newNode: FlowNode = {
        id: generateId(),
        type: configTypeToNodeType(configType),
        config: createDefaultConfig(configType),
      };
      onChange([...nodes, newNode]);
      setExpandedId(newNode.id);
      setShowAddMenu(false);
    },
    [nodes, onChange],
  );

  const handleUpdate = useCallback(
    (index: number, updated: FlowNode) => {
      const next = [...nodes];
      next[index] = updated;
      onChange(next);
    },
    [nodes, onChange],
  );

  const handleMove = useCallback(
    (index: number, direction: "up" | "down") => {
      const next = [...nodes];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return;
      const temp = next[targetIndex];
      if (!temp) return;
      next[targetIndex] = next[index] as FlowNode;
      next[index] = temp;
      onChange(next);
    },
    [nodes, onChange],
  );

  const handleDelete = useCallback(
    (index: number) => {
      const next = nodes.filter((_, i) => i !== index);
      onChange(next);
      if (expandedId === nodes[index]?.id) {
        setExpandedId(null);
      }
    },
    [nodes, onChange, expandedId],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs font-medium">
          Nodes ({String(nodes.length)})
        </span>
        <Button
          variant="ghost"
          onClick={() => { setShowAddMenu((prev) => !prev); }}
          className="gap-1"
        >
          <Plus size={12} />
          Add
        </Button>
      </div>

      {/* Add menu */}
      {showAddMenu ? (
        <AddNodeMenu
          onAdd={handleAdd}
          onClose={() => { setShowAddMenu(false); }}
        />
      ) : null}

      {/* Node list */}
      {nodes.length === 0 ? (
        <div className="border-border rounded-md border border-dashed p-4 text-center">
          <p className="text-text-muted text-[10px]">
            No nodes yet. Click &quot;Add&quot; to create your first step.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {nodes.map((node, index) => (
            <FlowNodeRow
              key={node.id}
              node={node}
              index={index}
              totalCount={nodes.length}
              expanded={expandedId === node.id}
              onToggle={() => {
                setExpandedId(expandedId === node.id ? null : node.id);
              }}
              onUpdate={(updated) => { handleUpdate(index, updated); }}
              onMove={(direction) => { handleMove(index, direction); }}
              onDelete={() => { handleDelete(index); }}
              onPickStart={onPickStart}
            />
          ))}
        </div>
      )}
    </div>
  );
}
