import { useState, useEffect, useMemo, useCallback } from "react";
import { FileCode, Plus, Play, Trash2, Copy, Loader2, Info } from "lucide-react";
import { SectionExportImport } from "../ui/SectionExportImport";
import type { Script, UrlPattern } from "@/shared/types/entities";
import type { ScriptRunResult } from "@/shared/types/script-run";
import { generateId, now } from "@/shared/utils";
import { useScriptsStore } from "../../stores/scripts-store";
import { useAppStore } from "../../stores/app-store";
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
import { ExecutionOutput } from "../ui/ExecutionOutput";
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
    notifyOnError: false,
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
  const globalNotificationsEnabled = useAppStore((s) => s.settings.notifications.enabled);
  const { draft, setDraft, isDirty, commitDraft, discardDraft } = useEditorDraft<Script>({
    tab: "scripts",
    entityId: initial.id,
    isNew,
    initial,
    saved: isNew ? null : initial,
  });

  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ScriptRunResult | null>(null);

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
    setRunning(true);
    setLastResult(null);
    try {
      const result = await runNow(draft.id);
      setLastResult(result);
    } catch {
      setLastResult({ ok: false, error: "Failed to communicate with service worker", consoleLogs: [], durationMs: 0 });
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

  return (
    <div className="flex flex-col gap-2">
      <EditorHeader
        title={isNew ? "New Script" : "Edit Script"}
        isDirty={isDirty}
        onBack={onBack}
        onSave={() => void handleSave()}
        onDiscard={() => void handleDiscard()}
        actions={
          !isNew ? (
            <Button variant="ghost" onClick={() => void handleRun()} disabled={running} className="gap-1">
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {running ? "Running..." : "Run"}
            </Button>
          ) : undefined
        }
      />

      {/* Execution output */}
      {lastResult && (
        <ExecutionOutput result={lastResult} onDismiss={() => { setLastResult(null); }} />
      )}

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
          <Toggle
            checked={draft.notifyOnError ?? false}
            onChange={(notifyOnError) => {
              patch("notifyOnError", notifyOnError);
            }}
            label="Notify on Error"
            size="sm"
          />
          {!isNew && (
            <Button variant="danger" onClick={() => void handleDelete()} className="gap-1">
              <Trash2 size={12} />
              Delete
            </Button>
          )}
        </div>

        {(draft.notifyOnError ?? false) && !globalNotificationsEnabled && (
          <div className="bg-warning/10 text-warning flex items-start gap-1.5 rounded-md px-2.5 py-1.5">
            <Info size={12} className="mt-0.5 shrink-0" />
            <p className="text-[10px] leading-tight">
              Global notifications are disabled. Enable them in <strong>Settings &gt; Notifications</strong> for this to take effect.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ScriptsView() {
  const { scripts, loading, editingId, load, toggle, runNow, setEditing } = useScriptsStore();
  const [newScript, setNewScript] = useState<Script | null>(null);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [listRunResult, setListRunResult] = useState<{ scriptId: string; result: ScriptRunResult } | null>(null);
  const [listRunning, setListRunning] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh draft indicators when returning to list view
  useEffect(() => {
    if (!editingId && !newScript) {
      void loadAllDrafts("scripts").then((map) => { setDraftIds(new Set(Object.keys(map))); });
    }
  }, [editingId, newScript]);

  const scriptList = useMemo(
    () =>
      Object.values(scripts)
        .filter((s): s is Script => typeof s.name === "string")
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
      <ListHeader
        title="Scripts"
        actions={
          <>
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
          </>
        }
      />

      {loading ? (
        <p className="text-text-muted py-4 text-center text-xs" role="status">Loading...</p>
      ) : scriptList.length === 0 ? (
        <EmptyState
          icon={<FileCode size={32} />}
          title="No scripts yet"
          description="Create a script to automate any website"
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {scriptList.map((script) => (
            <div key={script.id} className="flex flex-col gap-1">
              <Card
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
                    disabled={listRunning === script.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setListRunning(script.id);
                      setListRunResult(null);
                      void runNow(script.id).then((result) => {
                        setListRunResult({ scriptId: script.id, result });
                        setListRunning(null);
                      }).catch(() => { setListRunning(null); });
                    }}
                    className="text-text-muted hover:bg-bg-tertiary hover:text-active rounded p-1 transition-colors disabled:opacity-50"
                    aria-label="Run script"
                  >
                    {listRunning === script.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Play size={12} />
                    )}
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
              {listRunResult?.scriptId === script.id && (
                <ExecutionOutput
                  result={listRunResult.result}
                  onDismiss={() => { setListRunResult(null); }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
