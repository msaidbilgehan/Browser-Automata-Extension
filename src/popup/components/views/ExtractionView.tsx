import { useState, useEffect, useMemo, useCallback } from "react";
import {
  TableProperties,
  Plus,
  ArrowLeft,
  Save,
  Trash2,
  X,
  Play,
} from "lucide-react";
import type { ExtractionRule, ExtractionField, UrlPattern, EntityId } from "@/shared/types/entities";
import { generateId, now } from "@/shared/utils";
import { useExtractionRulesStore } from "../../stores/extraction-rules-store";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { UrlPatternInput } from "../editor/UrlPatternInput";
import { SelectorInput } from "../editor/SelectorInput";
import { saveEditorDraft, loadEditorDraft } from "../../stores/editor-session";

const TRIGGER_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "shortcut", label: "Shortcut" },
  { value: "page_load", label: "Page Load" },
];

const OUTPUT_FORMAT_OPTIONS = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "text", label: "Text" },
  { value: "xml", label: "XML" },
];

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
    trigger: "manual",
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

function createNewField(): ExtractionField {
  return { name: "", selector: "", attribute: "", multiple: false };
}

function scopeLabel(scope: UrlPattern): string {
  return scope.type === "global" ? "Global" : scope.value || scope.type;
}

function FieldMappingTable({
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
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <SelectorInput
                    pickId={`extraction-${ruleId}-field-${String(i)}`}
                    value={f.selector}
                    onChange={(selector) => {
                      updateField(i, { selector });
                    }}
                    onPickStart={onPickStart}
                    label=""
                    compact
                    placeholder="CSS selector"
                  />
                </div>
                <input
                  type="text"
                  value={f.attribute ?? ""}
                  onChange={(e) => {
                    updateField(i, { attribute: e.target.value });
                  }}
                  placeholder="Attribute"
                  className="border-border bg-bg-primary text-text-primary placeholder-text-muted focus:border-border-active w-20 rounded-md border px-2 py-1 text-[10px] outline-none"
                />
              </div>
              <Toggle
                checked={f.multiple}
                onChange={(multiple) => {
                  updateField(i, { multiple });
                }}
                label="Multiple"
                size="sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExtractionRuleEditor({
  initial,
  isNew,
  onBack,
}: {
  initial: ExtractionRule;
  isNew: boolean;
  onBack: () => void;
}) {
  const { save, remove, runNow } = useExtractionRulesStore();
  const [draft, setDraft] = useState<ExtractionRule>(initial);

  const patch = useCallback(<K extends keyof ExtractionRule>(key: K, value: ExtractionRule[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePickStart = useCallback(() => {
    void saveEditorDraft({
      tab: "extraction",
      isNew,
      editingId: isNew ? undefined : draft.id,
      draft,
    });
  }, [draft, isNew]);

  const handleSave = async () => {
    const updated: ExtractionRule = {
      ...draft,
      meta: { ...draft.meta, updatedAt: now() },
    };
    await save(updated);
    onBack();
  };

  const handleDelete = async () => {
    await remove(draft.id);
    onBack();
  };

  const handleRunNow = async () => {
    // Save first, then run
    const updated: ExtractionRule = {
      ...draft,
      meta: { ...draft.meta, updatedAt: now() },
    };
    await save(updated);
    await runNow(draft.id);
  };

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
        <Button variant="primary" onClick={() => void handleSave()} className="gap-1">
          <Save size={12} />
          Save
        </Button>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        <Input
          label="Name"
          value={draft.name}
          onChange={(e) => {
            patch("name", e.target.value);
          }}
          placeholder="My Extraction Rule"
        />

        <UrlPatternInput
          label="Scope"
          value={draft.scope}
          onChange={(scope) => {
            patch("scope", scope);
          }}
        />

        <Select
          label="Trigger"
          options={TRIGGER_OPTIONS}
          value={draft.trigger}
          onChange={(e) => {
            patch("trigger", e.target.value as ExtractionRule["trigger"]);
          }}
        />

        <Select
          label="Output Format"
          options={OUTPUT_FORMAT_OPTIONS}
          value={draft.outputFormat}
          onChange={(e) => {
            patch("outputFormat", e.target.value as ExtractionRule["outputFormat"]);
          }}
        />

        <FieldMappingTable
          ruleId={draft.id}
          fields={draft.fields}
          onChange={(fields) => {
            patch("fields", fields);
          }}
          onPickStart={handlePickStart}
        />

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Toggle
              checked={draft.enabled}
              onChange={(enabled) => {
                patch("enabled", enabled);
              }}
              label="Enabled"
              size="sm"
            />
            {!isNew && (
              <Button variant="ghost" onClick={() => void handleRunNow()} className="gap-1">
                <Play size={12} />
                Run Now
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
  const { extractionRules, loading, editingId, load, save, setEditing } = useExtractionRulesStore();
  const [newRule, setNewRule] = useState<ExtractionRule | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<ExtractionRule | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Restore editor draft from session (e.g. after element picking closed the popup)
  useEffect(() => {
    void loadEditorDraft().then((ctx) => {
      if (ctx?.tab !== "extraction") return;
      const draft = ctx.draft as ExtractionRule;
      if (ctx.isNew) {
        setNewRule(draft);
      } else if (ctx.editingId) {
        setEditing(ctx.editingId as EntityId);
        setRestoredDraft(draft);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ruleList = useMemo(
    () => Object.values(extractionRules).sort((a, b) => a.name.localeCompare(b.name)),
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
        }}
      />
    );
  }

  // Editor for existing rule
  if (editingId) {
    const rule = extractionRules[editingId];
    if (rule) {
      const initial = restoredDraft?.id === editingId ? restoredDraft : rule;
      return (
        <ExtractionRuleEditor
          key={editingId}
          initial={initial}
          isNew={false}
          onBack={() => {
            setEditing(null);
            setRestoredDraft(null);
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
                      {rule.trigger}
                    </span>
                  </div>
                  <span className="text-text-muted text-[10px]">{scopeLabel(rule.scope)}</span>
                </div>
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
