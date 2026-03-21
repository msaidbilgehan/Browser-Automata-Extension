import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { GitBranch, Plus, ArrowLeft, Save, Trash2, Play, Undo2, Copy } from "lucide-react";
import { SectionExportImport } from "../ui/SectionExportImport";
import { create } from "zustand";
import type { Flow, EntityId, UrlPattern } from "@/shared/types/entities";
import { localStore, onStorageChange } from "@/shared/storage";
import { sendToBackground } from "@/shared/messaging";
import { generateId, now } from "@/shared/utils";
import { saveEditorDraft, loadEditorDraft, clearEditorDraft, removeDraft, loadAllDrafts } from "@/popup/stores/editor-session";
import { useEditorDraft } from "../../hooks/use-editor-draft";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { UrlPatternInput } from "../editor/UrlPatternInput";
import { FlowNodeEditor } from "../editor/FlowNodeEditor";
import { FlowRunWidget } from "../widgets/FlowRunWidget";

// ─── Inline Flows Store ─────────────────────────────────────────────────────

interface FlowsState {
  flows: Record<string, Flow>;
  loading: boolean;

  load: () => Promise<void>;
  save: (flow: Flow) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
  toggle: (id: EntityId, enabled: boolean) => Promise<void>;
  runNow: (id: EntityId) => Promise<void>;
}

const useFlowsStore = create<FlowsState>((set, get) => {
  onStorageChange("flows", (newValue) => {
    if (newValue) set({ flows: newValue });
  });

  return {
    flows: {},
    loading: false,

    load: async () => {
      set({ loading: true });
      const flows = (await localStore.get("flows")) ?? {};
      set({ flows, loading: false });
    },

    save: async (flow) => {
      await sendToBackground({ type: "FLOW_SAVE", flow });
      set((s) => ({
        flows: { ...s.flows, [flow.id]: flow },
      }));
    },

    remove: async (id) => {
      await sendToBackground({ type: "FLOW_DELETE", flowId: id });
      set((s) => {
        const next = { ...s.flows };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[id];
        return { flows: next };
      });
    },

    toggle: async (id, enabled) => {
      const { flows } = get();
      const flow = flows[id];
      if (!flow) return;
      const updated: Flow = {
        ...flow,
        enabled,
        meta: { ...flow.meta, updatedAt: now() },
      };
      await sendToBackground({ type: "FLOW_SAVE", flow: updated });
      set((s) => ({
        flows: { ...s.flows, [id]: updated },
      }));
    },

    runNow: async (id) => {
      await sendToBackground({ type: "FLOW_RUN_NOW", flowId: id });
    },
  };
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function createNewFlow(): Flow {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    description: "",
    scope: { type: "global", value: "" },
    enabled: true,
    profileId: null,
    nodes: [],
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

function scopeLabel(scope: UrlPattern): string {
  return scope.type === "global" ? "Global" : scope.value || scope.type;
}

// ─── Editor Mode ────────────────────────────────────────────────────────────

interface FlowDraftState {
  flow: Flow;
  expandedNodeId: string | null;
}

/** Discriminated union — single source of truth for the editor's UI state. */
type EditorMode =
  | { type: "list" }
  | { type: "new"; flow: Flow; expandedNodeId: string | null }
  | { type: "edit"; editingId: EntityId; flow: Flow; expandedNodeId: string | null };

// ─── Flow Editor ────────────────────────────────────────────────────────────

function FlowEditor({
  initial,
  isNew,
  onBack,
  initialExpandedNodeId,
}: {
  initial: Flow;
  isNew: boolean;
  onBack: () => void;
  initialExpandedNodeId?: string | null | undefined;
}) {
  const { save, remove, runNow } = useFlowsStore();
  const { draft, setDraft, isDirty, commitDraft, discardDraft } = useEditorDraft<Flow>({
    tab: "flows",
    entityId: initial.id,
    isNew,
    initial,
    saved: isNew ? null : initial,
  });
  const draftRef = useRef<Flow>(draft);
  const expandedNodeIdRef = useRef<string | null>(initialExpandedNodeId ?? null);

  const patch = useCallback(<K extends keyof Flow>(key: K, value: Flow[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      draftRef.current = next;
      return next;
    });
  }, [setDraft]);

  // Keep draftRef in sync when hook restores from session storage
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const handleSave = async () => {
    const updated: Flow = {
      ...draftRef.current,
      meta: { ...draftRef.current.meta, updatedAt: now() },
    };
    await save(updated);
    await commitDraft();
    void clearEditorDraft();
    onBack();
  };

  const handleDelete = async () => {
    await remove(draftRef.current.id);
    await removeDraft("flows", draftRef.current.id);
    void clearEditorDraft();
    onBack();
  };

  const handleRun = async () => {
    await runNow(draftRef.current.id);
  };

  const handleDiscard = async () => {
    if (isNew) {
      await commitDraft();
      onBack();
    } else {
      await discardDraft();
    }
  };

  /** Always reads from refs so it never captures stale state.
   *  Returns a Promise so the caller can await completion before proceeding. */
  const handlePickStart = useCallback(async () => {
    const state: FlowDraftState = {
      flow: draftRef.current,
      expandedNodeId: expandedNodeIdRef.current,
    };
    await saveEditorDraft({
      tab: "flows",
      isNew,
      editingId: isNew ? undefined : draftRef.current.id,
      draft: state,
    });
  }, [isNew]);

  const handleExpandChange = useCallback((nodeId: string | null) => {
    expandedNodeIdRef.current = nodeId;
  }, []);

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
          {isNew ? "New Flow" : "Edit Flow"}
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
        {!isNew ? (
          <Button variant="ghost" onClick={() => void handleRun()} className="gap-1">
            <Play size={12} />
            Run
          </Button>
        ) : null}
        <Button variant="primary" onClick={() => void handleSave()} className="gap-1">
          <Save size={12} />
          Save
        </Button>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-2">
        <Input
          label="Name"
          value={draft.name}
          onChange={(e) => {
            patch("name", e.target.value);
          }}
          placeholder="My Flow"
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="flow-description" className="text-text-secondary text-xs font-medium">
            Description
          </label>
          <textarea
            id="flow-description"
            value={draft.description}
            onChange={(e) => {
              patch("description", e.target.value);
            }}
            placeholder="What does this flow do?"
            rows={2}
            className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active rounded-md border px-2.5 py-1.5 text-xs transition-colors outline-none"
          />
        </div>

        <UrlPatternInput
          label="Scope"
          value={draft.scope}
          onChange={(scope) => {
            patch("scope", scope);
          }}
        />

        <div className="flex items-center justify-between pt-1">
          <Toggle
            checked={draft.enabled}
            onChange={(enabled) => {
              patch("enabled", enabled);
            }}
            label="Enabled"
            size="sm"
          />
        </div>

        {/* Node editor */}
        <FlowNodeEditor
          nodes={draft.nodes}
          onChange={(nodes) => { patch("nodes", nodes); }}
          onPickStart={handlePickStart}
          initialExpandedId={initialExpandedNodeId}
          onExpandChange={handleExpandChange}
        />

        {!isNew ? (
          <div className="flex justify-end pt-1">
            <Button variant="danger" onClick={() => void handleDelete()} className="gap-1">
              <Trash2 size={12} />
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Flows View ─────────────────────────────────────────────────────────────

export function FlowsView() {
  const { flows, loading, load, toggle, runNow } = useFlowsStore();
  const [mode, setMode] = useState<EditorMode>({ type: "list" });
  const [initDone, setInitDone] = useState(false);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (mode.type === "list" && initDone) {
      void loadAllDrafts("flows").then((map) => setDraftIds(new Set(Object.keys(map))));
    }
  }, [mode.type, initDone]);

  // Single sequential init: load flows THEN restore draft.
  // This eliminates the race between concurrent useEffects and between
  // zustand/React state updates that caused stale mounts on consecutive picks.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      await load();
      const ctx = await loadEditorDraft();
      if (cancelled) return;

      if (ctx?.tab === "flows") {
        const state = ctx.draft as FlowDraftState;
        if (ctx.isNew) {
          setMode({ type: "new", flow: state.flow, expandedNodeId: state.expandedNodeId });
        } else if (ctx.editingId) {
          setMode({
            type: "edit",
            editingId: ctx.editingId as EntityId,
            flow: state.flow,
            expandedNodeId: state.expandedNodeId,
          });
        }
      }

      setInitDone(true);
    }

    void init();
    return () => { cancelled = true; };
  }, [load]);

  const flowList = useMemo(
    () =>
      Object.values(flows)
        .filter((s): s is Flow => s != null && typeof s.name === "string")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [flows],
  );

  const handleBack = useCallback(() => {
    setMode({ type: "list" });
    void clearEditorDraft();
  }, []);

  // Gate on init to prevent stale FlowEditor mounts
  if (!initDone) {
    return <p className="text-text-muted py-4 text-center text-xs">Loading...</p>;
  }

  // Editor for new flow
  if (mode.type === "new") {
    return (
      <FlowEditor
        key={mode.flow.id}
        initial={mode.flow}
        isNew
        onBack={handleBack}
        initialExpandedNodeId={mode.expandedNodeId}
      />
    );
  }

  // Editor for existing flow
  if (mode.type === "edit") {
    return (
      <FlowEditor
        key={mode.editingId}
        initial={mode.flow}
        isNew={false}
        onBack={handleBack}
        initialExpandedNodeId={mode.expandedNodeId}
      />
    );
  }

  // List view
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold">Flows</h2>
        <div className="flex items-center gap-1">
          <SectionExportImport section="flows" />
          <Button
            variant="primary"
            onClick={() => {
              setMode({ type: "new", flow: createNewFlow(), expandedNodeId: null });
            }}
            className="gap-1"
          >
            <Plus size={12} />
            New
          </Button>
        </div>
      </div>

      <FlowRunWidget />

      {loading ? (
        <p className="text-text-muted py-4 text-center text-xs">Loading...</p>
      ) : flowList.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <GitBranch size={32} className="text-text-muted" />
          <p className="text-text-muted text-xs">No flows yet</p>
          <p className="text-text-muted text-[10px]">
            Chain actions into multi-step automation sequences
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {flowList.map((f) => (
            <Card
              key={f.id}
              onClick={() => {
                setMode({ type: "edit", editingId: f.id, flow: f, expandedNodeId: null });
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    f.enabled ? "bg-active" : "bg-text-muted"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-text-primary truncate text-xs font-medium">
                      {f.name || "Untitled"}
                    </p>
                    {draftIds.has(f.id) && (
                      <span className="bg-warning/20 text-warning shrink-0 rounded px-1 py-0.5 text-[9px] font-medium">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted text-[10px]">{scopeLabel(f.scope)}</span>
                    <span className="text-text-muted text-[10px]">
                      {String(f.nodes.length)} node{f.nodes.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const ts = now();
                    setMode({
                      type: "new",
                      flow: { ...f, id: generateId(), name: `${f.name || "Untitled"} (Copy)`, meta: { createdAt: ts, updatedAt: ts } },
                      expandedNodeId: null,
                    });
                  }}
                  className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors"
                  aria-label="Duplicate flow"
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void runNow(f.id);
                  }}
                  className="text-text-muted hover:bg-bg-tertiary hover:text-active rounded p-1 transition-colors"
                  aria-label="Run flow"
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
                    checked={f.enabled}
                    onChange={(enabled) => void toggle(f.id, enabled)}
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
