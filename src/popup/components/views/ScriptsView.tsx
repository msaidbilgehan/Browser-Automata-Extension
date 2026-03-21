import { useState, useEffect, useMemo, useCallback } from "react";
import { FileCode, Plus, ArrowLeft, Play, Save, Trash2, Undo2, Copy } from "lucide-react";
import { SectionExportImport } from "../ui/SectionExportImport";
import type { Script, UrlPattern } from "@/shared/types/entities";
import { generateId, now } from "@/shared/utils";
import { useScriptsStore } from "../../stores/scripts-store";
import { useEditorDraft } from "../../hooks/use-editor-draft";
import { removeDraft, loadAllDrafts } from "../../stores/editor-session";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { CodeEditor } from "../editor/CodeEditor";
import { UrlPatternInput } from "../editor/UrlPatternInput";
import { jsEditorExtensions } from "@/lib/codemirror/setup";

function createNewScript(): Script {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    description: "",
    code: "// Your code here\n",
    trigger: "manual",
    scope: { type: "global", value: "" },
    executionWorld: "ISOLATED",
    runAt: "document_idle",
    enabled: true,
    priority: 100,
    profileId: null,
    meta: { createdAt: timestamp, updatedAt: timestamp, version: 1, tags: [] },
  };
}

function scopeLabel(scope: UrlPattern): string {
  return scope.type === "global" ? "Global" : scope.value || scope.type;
}

const TRIGGER_OPTIONS = [
  { value: "page_load", label: "Page Load" },
  { value: "manual", label: "Manual" },
  { value: "shortcut", label: "Shortcut" },
];

const WORLD_OPTIONS = [
  { value: "ISOLATED", label: "Isolated" },
  { value: "MAIN", label: "Main" },
];

const RUN_AT_OPTIONS = [
  { value: "document_start", label: "Document Start" },
  { value: "document_idle", label: "Document Idle" },
  { value: "document_end", label: "Document End" },
];

function ScriptEditor({
  initial,
  isNew,
  onBack,
}: {
  initial: Script;
  isNew: boolean;
  onBack: () => void;
}) {
  const { save, remove, runNow } = useScriptsStore();
  const { draft, setDraft, isDirty, commitDraft, discardDraft } = useEditorDraft<Script>({
    tab: "scripts",
    entityId: initial.id,
    isNew,
    initial,
    saved: isNew ? null : initial,
  });

  const extensions = useMemo(() => jsEditorExtensions(), []);

  const patch = useCallback(<K extends keyof Script>(key: K, value: Script[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, [setDraft]);

  const handleSave = async () => {
    const updated: Script = {
      ...draft,
      meta: { ...draft.meta, updatedAt: now() },
    };
    await save(updated);
    await commitDraft();
    onBack();
  };

  const handleDelete = async () => {
    await remove(draft.id);
    await removeDraft("scripts", draft.id);
    onBack();
  };

  const handleRun = async () => {
    await runNow(draft.id);
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
          {isNew ? "New Script" : "Edit Script"}
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
        {!isNew && (
          <Button variant="ghost" onClick={() => void handleRun()} className="gap-1">
            <Play size={12} />
            Run
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
          value={draft.name}
          onChange={(e) => {
            patch("name", e.target.value);
          }}
          placeholder="My Script"
        />

        <UrlPatternInput
          label="Scope"
          value={draft.scope}
          onChange={(scope) => {
            patch("scope", scope);
          }}
        />

        <div className="grid grid-cols-3 gap-2">
          <Select
            label="Trigger"
            options={TRIGGER_OPTIONS}
            value={draft.trigger}
            onChange={(e) => {
              patch("trigger", e.target.value as Script["trigger"]);
            }}
          />
          <Select
            label="World"
            options={WORLD_OPTIONS}
            value={draft.executionWorld}
            onChange={(e) => {
              patch("executionWorld", e.target.value as Script["executionWorld"]);
            }}
          />
          <Select
            label="Run At"
            options={RUN_AT_OPTIONS}
            value={draft.runAt}
            onChange={(e) => {
              patch("runAt", e.target.value as Script["runAt"]);
            }}
          />
        </div>

        <Input
          label="Priority"
          type="number"
          value={String(draft.priority)}
          onChange={(e) => {
            patch("priority", Number(e.target.value));
          }}
        />

        <div className="flex flex-col gap-1">
          <span className="text-text-secondary text-xs font-medium">Code</span>
          <CodeEditor
            value={draft.code}
            onChange={(code) => {
              patch("code", code);
            }}
            extensions={extensions}
            height="180px"
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

export function ScriptsView() {
  const { scripts, loading, editingId, load, toggle, runNow, setEditing } = useScriptsStore();
  const [newScript, setNewScript] = useState<Script | null>(null);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh draft indicators when returning to list view
  useEffect(() => {
    if (!editingId && !newScript) {
      void loadAllDrafts("scripts").then((map) => setDraftIds(new Set(Object.keys(map))));
    }
  }, [editingId, newScript]);

  const scriptList = useMemo(
    () =>
      Object.values(scripts)
        .filter((s): s is Script => s != null && typeof s.name === "string")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [scripts],
  );

  // Editor for new script
  if (newScript) {
    return (
      <ScriptEditor
        initial={newScript}
        isNew
        onBack={() => {
          setNewScript(null);
        }}
      />
    );
  }

  // Editor for existing script
  if (editingId) {
    const script = scripts[editingId];
    if (script) {
      return (
        <ScriptEditor
          key={editingId}
          initial={script}
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
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold">Scripts</h2>
        <div className="flex items-center gap-1">
          <SectionExportImport section="scripts" />
          <Button
            variant="primary"
            onClick={() => {
              setNewScript(createNewScript());
            }}
            className="gap-1"
          >
            <Plus size={12} />
            New
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-text-muted py-4 text-center text-xs">Loading...</p>
      ) : scriptList.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FileCode size={32} className="text-text-muted" />
          <p className="text-text-muted text-xs">No scripts yet</p>
          <p className="text-text-muted text-[10px]">Create a script to automate any website</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {scriptList.map((script) => (
            <Card
              key={script.id}
              onClick={() => {
                setEditing(script.id);
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    script.enabled ? "bg-active" : "bg-text-muted"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-text-primary truncate text-xs font-medium">
                      {script.name || "Untitled"}
                    </p>
                    {draftIds.has(script.id) && (
                      <span className="bg-warning/20 text-warning shrink-0 rounded px-1 py-0.5 text-[9px] font-medium">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted text-[10px]">{scopeLabel(script.scope)}</span>
                    <span className="text-text-muted text-[10px]">{script.trigger}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const ts = now();
                    setNewScript({
                      ...script,
                      id: generateId(),
                      name: `${script.name || "Untitled"} (Copy)`,
                      meta: { ...script.meta, createdAt: ts, updatedAt: ts },
                    });
                  }}
                  className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors"
                  aria-label="Duplicate script"
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void runNow(script.id);
                  }}
                  className="text-text-muted hover:bg-bg-tertiary hover:text-active rounded p-1 transition-colors"
                  aria-label="Run script"
                >
                  <Play size={12} />
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
                    checked={script.enabled}
                    onChange={(enabled) => void toggle(script.id, enabled)}
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
