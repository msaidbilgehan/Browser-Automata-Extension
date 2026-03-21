import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  TableProperties,
  Plus,
  ArrowLeft,
  Save,
  Trash2,
  X,
  Play,
  Undo2,
  Loader2,
  Copy,
} from "lucide-react";
import type { ExtractionRule, ExtractionField, ExtractionOutputAction, ExtractionTrigger, KeyCombo, UrlPattern, EntityId } from "@/shared/types/entities";
import { generateId, now } from "@/shared/utils";
import { useExtractionRulesStore } from "../../stores/extraction-rules-store";
import { useEditorDraft } from "../../hooks/use-editor-draft";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { UrlPatternInput } from "../editor/UrlPatternInput";
import { SelectorSourceList } from "../editor/SelectorSourceList";
import { ExtractionResultPanel, ExtractionErrorPanel } from "../ExtractionResultPanel";
import { KeyCaptureInput } from "../editor/KeyCaptureInput";
import { TransformEditor } from "../editor/TransformEditor";
import { injectResultWidget } from "@/shared/result-display";
import { sendToBackground } from "@/shared/messaging";
import { saveEditorDraft, loadEditorDraft, clearEditorDraft, removeDraft, loadAllDrafts } from "../../stores/editor-session";
import { useKeyComboConflicts } from "../../hooks/use-key-combo-conflicts";

const TRIGGER_OPTIONS: { value: ExtractionTrigger; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "page_load", label: "Page Load" },
  { value: "shortcut", label: "Shortcut" },
];

const OUTPUT_FORMAT_OPTIONS = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "text", label: "Text" },
  { value: "xml", label: "XML" },
];

const OUTPUT_ACTION_OPTIONS: { value: ExtractionOutputAction; label: string }[] = [
  { value: "show_page", label: "Show on Page" },
  { value: "show_tab", label: "Show in New Tab" },
  { value: "clipboard", label: "Copy to Clipboard" },
  { value: "download", label: "Download File" },
];

/**
 * Normalize legacy `trigger` (string) to `triggers` (array) for UI display.
 */
function normalizeTriggers(rule: ExtractionRule): ExtractionTrigger[] {
  if (rule.triggers.length > 0) return rule.triggers;
  const legacy = (rule as unknown as Record<string, unknown>)["trigger"] as ExtractionTrigger | undefined;
  if (legacy) return [legacy];
  return ["manual"];
}

function createNewExtractionRule(): ExtractionRule {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    scope: { type: "global", value: "" },
    enabled: true,
    profileId: null,
    fields: [],
    outputFormat: "json",
    outputActions: [],
    triggers: ["manual"],
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

function createNewField(): ExtractionField {
  return { name: "", selector: "", attribute: "", multiple: false };
}

function scopeLabel(scope: UrlPattern): string {
  return scope.type === "global" ? "Global" : scope.value || scope.type;
}

const TriggerCheckboxes = memo(function TriggerCheckboxes({
  value,
  onChange,
}: {
  value: ExtractionTrigger[];
  onChange: (triggers: ExtractionTrigger[]) => void;
}) {
  const toggle = (trigger: ExtractionTrigger) => {
    if (trigger === "manual") {
      // Manual is exclusive — selecting it deselects the others
      onChange(["manual"]);
      return;
    }
    // Selecting page_load or shortcut deselects manual
    let next: ExtractionTrigger[] = value.filter((t) => t !== "manual");
    if (next.includes(trigger)) {
      next = next.filter((t) => t !== trigger);
    } else {
      next = [...next, trigger];
    }
    // If nothing is left, fall back to manual
    if (next.length === 0) next = ["manual"];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-secondary text-xs font-medium">Trigger</span>
      <div className="flex flex-wrap gap-1.5">
        {TRIGGER_OPTIONS.map((opt) => {
          const checked = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                toggle(opt.value);
              }}
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
});

const OutputActionCheckboxes = memo(function OutputActionCheckboxes({
  value,
  onChange,
}: {
  value: ExtractionOutputAction[];
  onChange: (actions: ExtractionOutputAction[]) => void;
}) {
  const toggle = (action: ExtractionOutputAction) => {
    if (value.includes(action)) {
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
              onClick={() => {
                toggle(opt.value);
              }}
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
});

const FieldMappingTable = memo(function FieldMappingTable({
  ruleId,
  fields,
  onChange,
  onPickStart,
}: {
  ruleId: string;
  fields: ExtractionField[];
  onChange: (fields: ExtractionField[]) => void;
  onPickStart?: (() => void) | undefined;
}) {
  const addField = () => {
    onChange([...fields, createNewField()]);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, patch: Partial<ExtractionField>) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs font-medium">Fields</span>
        <button
          type="button"
          onClick={addField}
          className="text-active hover:bg-bg-tertiary rounded px-1.5 py-0.5 text-[10px]"
        >
          + Add Field
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="text-text-muted py-2 text-center text-[10px]">
          No fields defined. Add fields to extract data.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {fields.map((f, i) => (
            <div
              key={i}
              className="border-border bg-bg-tertiary flex flex-col gap-1 rounded-md border p-1.5"
            >
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={f.name}
                  onChange={(e) => {
                    updateField(i, { name: e.target.value });
                  }}
                  placeholder="Field name"
                  className="border-border bg-bg-primary text-text-primary placeholder-text-muted focus:border-border-active min-w-0 flex-1 rounded-md border px-2 py-1 text-[10px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    removeField(i);
                  }}
                  className="text-text-muted hover:bg-bg-primary hover:text-error rounded p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
              <SelectorSourceList
                selector={f.selector}
                fallbackSelectors={f.fallbackSelectors ?? []}
                onChange={(selector, fallbackSelectors) => {
                  updateField(i, {
                    selector,
                    ...(fallbackSelectors.length > 0 ? { fallbackSelectors } : {}),
                  } as Partial<ExtractionField>);
                }}
                pickIdPrefix={`extraction-${ruleId}-field-${String(i)}`}
                onPickStart={onPickStart}
              />
              <input
                type="text"
                value={f.attribute ?? ""}
                onChange={(e) => {
                  updateField(i, { attribute: e.target.value });
                }}
                placeholder="Attribute"
                className="border-border bg-bg-primary text-text-primary placeholder-text-muted focus:border-border-active rounded-md border px-2 py-1 text-[10px] outline-none"
              />
              <Toggle
                checked={f.multiple}
                onChange={(multiple) => {
                  updateField(i, { multiple });
                }}
                label="Multiple"
                size="sm"
              />
              <TransformEditor
                transforms={f.transforms ?? []}
                onChange={(transforms) => {
                  updateField(i, { transforms });
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

function ExtractionRuleEditor({
  initial,
  isNew,
  onBack,
}: {
  initial: ExtractionRule;
  isNew: boolean;
  onBack: () => void;
}) {
  const { save, remove, runNow, lastResult, clearResult } = useExtractionRulesStore();
  const { draft, setDraft, isDirty, commitDraft, discardDraft } = useEditorDraft<ExtractionRule>({
    tab: "extraction",
    entityId: initial.id,
    isNew,
    initial,
    saved: isNew ? null : initial,
  });

  const [running, setRunning] = useState(false);

  // Migrate legacy rules: normalize triggers and strip removed "show" action
  const effectiveDraft = useMemo(() => {
    const triggers = normalizeTriggers(draft);
    const outputActions = draft.outputActions.filter((a) => a !== "show");
    return { ...draft, triggers, outputActions };
  }, [draft]);

  const keyConflicts = useKeyComboConflicts(
    effectiveDraft.shortcutKeyCombo ?? null,
    effectiveDraft.scope,
    effectiveDraft.id,
  );

  const patch = useCallback(<K extends keyof ExtractionRule>(key: K, value: ExtractionRule[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, [setDraft]);

  const handleTriggersChange = useCallback((triggers: ExtractionTrigger[]) => {
    patch("triggers", triggers);
  }, [patch]);

  const handleOutputActionsChange = useCallback((actions: ExtractionOutputAction[]) => {
    patch("outputActions", actions);
  }, [patch]);

  const handleFieldsChange = useCallback((fields: ExtractionField[]) => {
    patch("fields", fields);
  }, [patch]);

  const handlePickStart = useCallback(async () => {
    await saveEditorDraft({
      tab: "extraction",
      isNew,
      editingId: isNew ? undefined : draft.id,
      draft,
    });
  }, [draft, isNew]);

  const handleSave = async () => {
    const updated: ExtractionRule = {
      ...effectiveDraft,
      meta: { ...effectiveDraft.meta, updatedAt: now() },
    };
    await save(updated);
    await commitDraft();
    void clearEditorDraft();
    onBack();
  };

  const handleDelete = async () => {
    await remove(draft.id);
    await removeDraft("extraction", draft.id);
    void clearEditorDraft();
    onBack();
  };

  const handleRunNow = async () => {
    clearResult();
    setRunning(true);

    try {
      // Save first, then run
      const updated: ExtractionRule = {
        ...effectiveDraft,
        meta: { ...effectiveDraft.meta, updatedAt: now() },
      };
      await save(updated);
      const result = await runNow(effectiveDraft.id);

      const actions = effectiveDraft.outputActions;
      const formatted = result.formatted;
      const rowCount = result.data?.length ?? 0;
      const hasData = result.ok && formatted != null && rowCount > 0;

      // Auto-copy to clipboard if configured
      if (hasData && actions.includes("clipboard")) {
        try {
          await navigator.clipboard.writeText(formatted);
        } catch {
          // Clipboard write can fail if popup lost focus
        }
      }

      // Auto-download if configured
      if (hasData && actions.includes("download")) {
        const FORMAT_EXTENSIONS: Record<ExtractionRule["outputFormat"], string> = {
          json: "json", csv: "csv", markdown: "md", html: "html", text: "txt", xml: "xml",
        };
        const FORMAT_MIME: Record<ExtractionRule["outputFormat"], string> = {
          json: "application/json", csv: "text/csv", markdown: "text/markdown",
          html: "text/html", text: "text/plain", xml: "application/xml",
        };
        const safeName = (effectiveDraft.name || "extraction").replace(/[^a-zA-Z0-9_-]/g, "_");
        const ext = FORMAT_EXTENSIONS[effectiveDraft.outputFormat];
        const mime = FORMAT_MIME[effectiveDraft.outputFormat];
        const blob = new Blob([formatted], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      // Show on page as a draggable widget
      if (hasData && actions.includes("show_page")) {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.id) {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              world: "MAIN",
              func: injectResultWidget,
              args: [formatted, effectiveDraft.outputFormat, rowCount, effectiveDraft.name],
            });
          }
        } catch {
          // Page injection can fail on restricted pages
        }
      }

      // Show in a new tab — delegate to background so popup can close safely
      if (hasData && actions.includes("show_tab")) {
        try {
          await sendToBackground({
            type: "EXTRACTION_SHOW_TAB",
            formatted,
            format: effectiveDraft.outputFormat,
            rowCount,
            name: effectiveDraft.name,
          });
        } catch {
          // Tab creation can fail in rare cases
        }
      }
    } catch {
      // If something went wrong, ensure we show an error in the panel
      const store = useExtractionRulesStore.getState();
      if (!store.lastResult) {
        useExtractionRulesStore.setState({
          lastResult: { ok: false, error: "Extraction failed unexpectedly" },
        });
      }
    } finally {
      setRunning(false);
    }
  };

  const handleDiscard = async () => {
    if (isNew) {
      await commitDraft();
      onBack();
    } else {
      await discardDraft();
    }
  };

  // Always show result panel in popup when manually triggered via Run Now
  const showResultPanel = lastResult != null;

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-text-primary flex-1 text-sm font-semibold">
          {isNew ? "New Extraction Rule" : "Edit Extraction Rule"}
        </h2>
        {isDirty && (
          <span className="text-warning text-[10px] font-medium">Unsaved</span>
        )}
        {isDirty && (
          <Button variant="ghost" onClick={() => void handleDiscard()} className="gap-1">
            <Undo2 size={12} />
            Discard
          </Button>
        )}
        <Button variant="primary" onClick={() => void handleSave()} className="gap-1">
          <Save size={12} />
          Save
        </Button>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        <Input
          label="Name"
          value={effectiveDraft.name}
          onChange={(e) => {
            patch("name", e.target.value);
          }}
          placeholder="My Extraction Rule"
        />

        <UrlPatternInput
          label="Scope"
          value={effectiveDraft.scope}
          onChange={(scope) => {
            patch("scope", scope);
          }}
        />

        <TriggerCheckboxes
          value={effectiveDraft.triggers}
          onChange={handleTriggersChange}
        />

        {effectiveDraft.triggers.includes("shortcut") && (
          <>
            <KeyCaptureInput
              label="Shortcut Key"
              value={effectiveDraft.shortcutKeyCombo ?? null}
              onChange={(combo: KeyCombo) => {
                patch("shortcutKeyCombo", combo);
              }}
            />
            {keyConflicts.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {keyConflicts.map((w, i) => (
                  <p key={i} className={`text-[10px] font-medium ${w.type === "browser" ? "text-warning" : "text-error"}`}>
                    {w.message}
                  </p>
                ))}
              </div>
            )}
          </>
        )}

        <Select
          label="Output Format"
          options={OUTPUT_FORMAT_OPTIONS}
          value={effectiveDraft.outputFormat}
          onChange={(e) => {
            patch("outputFormat", e.target.value as ExtractionRule["outputFormat"]);
          }}
        />

        <OutputActionCheckboxes
          value={effectiveDraft.outputActions}
          onChange={handleOutputActionsChange}
        />

        <FieldMappingTable
          ruleId={effectiveDraft.id}
          fields={effectiveDraft.fields}
          onChange={handleFieldsChange}
          onPickStart={() => void handlePickStart()}
        />

        {/* Result panel */}
        {showResultPanel && lastResult.ok && lastResult.formatted && (
          <ExtractionResultPanel
            formatted={lastResult.formatted}
            rowCount={lastResult.data?.length ?? 0}
            rule={effectiveDraft}
            onClose={clearResult}
          />
        )}
        {showResultPanel && !lastResult.ok && lastResult.error && (
          <ExtractionErrorPanel
            error={lastResult.error}
            onClose={clearResult}
          />
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Toggle
              checked={effectiveDraft.enabled}
              onChange={(enabled) => {
                patch("enabled", enabled);
              }}
              label="Enabled"
              size="sm"
            />
            {!isNew && (
              <Button
                variant="ghost"
                onClick={() => void handleRunNow()}
                disabled={running}
                className="gap-1"
              >
                {running ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Play size={12} />
                )}
                {running ? "Running..." : "Run Now"}
              </Button>
            )}
          </div>
          {!isNew && (
            <Button variant="danger" onClick={() => void handleDelete()} className="gap-1">
              <Trash2 size={12} />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExtractionView() {
  const { extractionRules, loading, editingId, load, save, setEditing, clearResult } = useExtractionRulesStore();
  const [newRule, setNewRule] = useState<ExtractionRule | null>(null);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editingId && !newRule) {
      void loadAllDrafts("extraction").then((map) => { setDraftIds(new Set(Object.keys(map))); });
    }
  }, [editingId, newRule]);

  // Restore editor draft from session (e.g. after element picking closed the popup)
  useEffect(() => {
    void loadEditorDraft().then((ctx) => {
      if (ctx?.tab !== "extraction") return;
      const draft = ctx.draft as ExtractionRule;
      if (ctx.isNew) {
        setNewRule(draft);
      } else if (ctx.editingId) {
        setEditing(ctx.editingId as EntityId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ruleList = useMemo(
    () =>
      Object.values(extractionRules)
        .filter((s): s is ExtractionRule => typeof s.name === "string")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [extractionRules],
  );

  const handleToggle = async (rule: ExtractionRule, enabled: boolean) => {
    await save({ ...rule, enabled, meta: { ...rule.meta, updatedAt: now() } });
  };

  // Editor for new rule
  if (newRule) {
    return (
      <ExtractionRuleEditor
        initial={newRule}
        isNew
        onBack={() => {
          setNewRule(null);
          clearResult();
          void clearEditorDraft();
        }}
      />
    );
  }

  // Editor for existing rule
  if (editingId) {
    const rule = extractionRules[editingId];
    if (rule) {
      return (
        <ExtractionRuleEditor
          key={editingId}
          initial={rule}
          isNew={false}
          onBack={() => {
            setEditing(null);
            clearResult();
            void clearEditorDraft();
          }}
        />
      );
    }
  }

  // List view
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold">Extraction Rules</h2>
        <Button
          variant="primary"
          onClick={() => {
            setNewRule(createNewExtractionRule());
          }}
          className="gap-1"
        >
          <Plus size={12} />
          New
        </Button>
      </div>

      {loading ? (
        <p className="text-text-muted py-4 text-center text-xs">Loading...</p>
      ) : ruleList.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <TableProperties size={32} className="text-text-muted" />
          <p className="text-text-muted text-xs">No extraction rules yet</p>
          <p className="text-text-muted text-[10px]">Extract structured data from web pages</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {ruleList.map((rule) => (
            <Card
              key={rule.id}
              onClick={() => {
                setEditing(rule.id);
              }}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-text-primary truncate text-xs font-medium">
                      {rule.name || "Untitled"}
                    </p>
                    <span className="bg-bg-tertiary text-text-muted shrink-0 rounded px-1.5 py-0.5 text-[10px]">
                      {rule.fields.length} field{rule.fields.length !== 1 ? "s" : ""}
                    </span>
                    <span className="bg-bg-tertiary text-text-muted shrink-0 rounded px-1.5 py-0.5 text-[10px]">
                      {normalizeTriggers(rule).join(", ")}
                    </span>
                    {draftIds.has(rule.id) && (
                      <span className="bg-warning/20 text-warning shrink-0 rounded px-1 py-0.5 text-[9px] font-medium">
                        Draft
                      </span>
                    )}
                  </div>
                  <span className="text-text-muted text-[10px]">{scopeLabel(rule.scope)}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const ts = now();
                    const copy = { ...rule };
                    delete (copy as Record<string, unknown>)["shortcutKeyCombo"];
                    setNewRule({
                      ...copy,
                      id: generateId(),
                      name: `${rule.name || "Untitled"} (Copy)`,
                      meta: { createdAt: ts, updatedAt: ts },
                    });
                  }}
                  className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors"
                  aria-label="Duplicate rule"
                >
                  <Copy size={12} />
                </button>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Toggle
                    checked={rule.enabled}
                    onChange={(enabled) => void handleToggle(rule, enabled)}
                    size="sm"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
