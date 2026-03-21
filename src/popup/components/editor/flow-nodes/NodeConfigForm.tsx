import type { FlowNodeConfig, ConditionCheck, EntityId } from "@/shared/types/entities";
import { TransformEditor } from "../TransformEditor";
import { SelectorSourceList } from "../SelectorSourceList";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { SelectorInput } from "../SelectorInput";
import { OutputActionCheckboxes } from "./OutputActionCheckboxes";
import { ExtractTestButton, RunExtractionTestButton } from "./ExtractTestButton";
import { ExtractionRuleSelect } from "./ExtractionRuleSelect";

export interface NodeConfigFormProps {
  config: FlowNodeConfig;
  onChange: (config: FlowNodeConfig) => void;
  nodeId: string;
  onPickStart?: (() => void) | undefined;
}

export function NodeConfigForm({
  config,
  onChange,
  nodeId,
  onPickStart,
}: NodeConfigFormProps) {
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
                const next = { ...config };
                delete (next as Record<string, unknown>)["attribute"];
                onChange(next);
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
                const next = { ...config };
                delete (next as Record<string, unknown>)["count"];
                onChange(next);
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
                const next = { ...config };
                delete (next as Record<string, unknown>)["untilSelector"];
                onChange(next);
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
