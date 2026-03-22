import { useState, useEffect, useMemo, useCallback } from "react";
import { Paintbrush, Plus, Trash2, Copy } from "lucide-react";
import type { CSSRule, UrlPattern } from "@/shared/types/entities";
import { generateId, now } from "@/shared/utils";
import { useCSSRulesStore } from "../../stores/css-rules-store";
import { useEditorDraft } from "../../hooks/use-editor-draft";
import { removeDraft, loadAllDrafts } from "../../stores/editor-session";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { EditorHeader } from "../ui/EditorHeader";
import { EmptyState } from "../ui/EmptyState";
import { ListHeader } from "../ui/ListHeader";
import { CodeEditor } from "../editor/CodeEditor";
import { UrlPatternInput } from "../editor/UrlPatternInput";
import { cssEditorExtensions } from "@/lib/codemirror/setup";

function createNewCSSRule(): CSSRule {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    css: "/* Your CSS here */\n",
    scope: { type: "global", value: "" },
    enabled: true,
    injectAt: "document_idle",
    profileId: null,
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

function scopeLabel(scope: UrlPattern): string {
  return scope.type === "global" ? "Global" : scope.value || scope.type;
}

const INJECT_AT_OPTIONS = [
  { value: "document_start", label: "Document Start" },
  { value: "document_idle", label: "Document Idle" },
];

function CSSRuleEditor({
  initial,
  isNew,
  onBack,
}: {
  initial: CSSRule;
  isNew: boolean;
  onBack: () => void;
}) {
  const { save, remove } = useCSSRulesStore();
  const { draft, setDraft, isDirty, commitDraft, discardDraft } = useEditorDraft<CSSRule>({
    tab: "css-rules",
    entityId: initial.id,
    isNew,
    initial,
    saved: isNew ? null : initial,
  });

  const extensions = useMemo(() => cssEditorExtensions(), []);

  const patch = useCallback(<K extends keyof CSSRule>(key: K, value: CSSRule[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, [setDraft]);

  const handleSave = async () => {
    const updated: CSSRule = {
      ...draft,
      meta: { ...draft.meta, updatedAt: now() },
    };
    await save(updated);
    await commitDraft();
    onBack();
  };

  const handleDelete = async () => {
    await remove(draft.id);
    await removeDraft("css-rules", draft.id);
    onBack();
  };

  const handleDiscard = async () => {
    if (isNew) {
      await commitDraft();
      onBack();
    } else {
      await discardDraft();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <EditorHeader
        title={isNew ? "New CSS Rule" : "Edit CSS Rule"}
        isDirty={isDirty}
        onBack={onBack}
        onSave={() => void handleSave()}
        onDiscard={() => void handleDiscard()}
      />

      {/* Form */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        <Input
          label="Name"
          value={draft.name}
          onChange={(e) => {
            patch("name", e.target.value);
          }}
          placeholder="My CSS Rule"
        />

        <UrlPatternInput
          label="Scope"
          value={draft.scope}
          onChange={(scope) => {
            patch("scope", scope);
          }}
        />

        <Select
          label="Inject At"
          options={INJECT_AT_OPTIONS}
          value={draft.injectAt}
          onChange={(e) => {
            patch("injectAt", e.target.value as CSSRule["injectAt"]);
          }}
        />

        <div className="flex flex-col gap-1">
          <span className="text-text-secondary text-xs font-medium">CSS</span>
          <CodeEditor
            value={draft.css}
            onChange={(css) => {
              patch("css", css);
            }}
            extensions={extensions}
            height="200px"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Toggle
            checked={draft.enabled}
            onChange={(enabled) => {
              patch("enabled", enabled);
            }}
            label="Enabled"
            size="sm"
          />
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

export function CSSRulesView() {
  const { cssRules, loading, editingId, load, save, setEditing } = useCSSRulesStore();
  const [newRule, setNewRule] = useState<CSSRule | null>(null);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editingId && !newRule) {
      void loadAllDrafts("css-rules").then((map) => { setDraftIds(new Set(Object.keys(map))); });
    }
  }, [editingId, newRule]);

  const ruleList = useMemo(
    () =>
      Object.values(cssRules)
        .filter((s): s is CSSRule => typeof s.name === "string")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [cssRules],
  );

  // Toggle enable/disable via save (no dedicated toggle action on this store)
  const handleToggle = async (rule: CSSRule, enabled: boolean) => {
    await save({ ...rule, enabled, meta: { ...rule.meta, updatedAt: now() } });
  };

  // Editor for new rule
  if (newRule) {
    return (
      <CSSRuleEditor
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
    const rule = cssRules[editingId];
    if (rule) {
      return (
        <CSSRuleEditor
          key={editingId}
          initial={rule}
          isNew={false}
          onBack={() => {
            setEditing(null);
          }}
        />
      );
    }
  }

  // List view
  return (
    <div className="flex flex-col gap-2">
      <ListHeader
        title="CSS Rules"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setNewRule(createNewCSSRule());
            }}
            className="gap-1"
          >
            <Plus size={12} />
            New
          </Button>
        }
      />

      {loading ? (
        <p className="text-text-muted py-4 text-center text-xs" role="status">Loading...</p>
      ) : ruleList.length === 0 ? (
        <EmptyState
          icon={<Paintbrush size={32} />}
          title="No CSS rules yet"
          description="Inject custom CSS per domain for styling tweaks"
        />
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
                    setNewRule({
                      ...rule,
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
