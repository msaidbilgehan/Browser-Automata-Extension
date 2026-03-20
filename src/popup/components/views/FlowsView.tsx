import { useState, useEffect, useMemo, useCallback } from "react";
import { GitBranch, Plus, ArrowLeft, Save, Trash2, Play, ExternalLink } from "lucide-react";
import { SectionExportImport } from "../ui/SectionExportImport";
import { create } from "zustand";
import type { Flow, EntityId, UrlPattern } from "@/shared/types/entities";
import { localStore, onStorageChange } from "@/shared/storage";
import { sendToBackground } from "@/shared/messaging";
import { generateId, now } from "@/shared/utils";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { UrlPatternInput } from "../editor/UrlPatternInput";

// ─── Inline Flows Store ─────────────────────────────────────────────────────

interface FlowsState {
  flows: Record<string, Flow>;
  loading: boolean;
  editingId: EntityId | null;

  load: () => Promise<void>;
  save: (flow: Flow) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
  toggle: (id: EntityId, enabled: boolean) => Promise<void>;
  runNow: (id: EntityId) => Promise<void>;
  setEditing: (id: EntityId | null) => void;
}

const useFlowsStore = create<FlowsState>((set, get) => {
  onStorageChange("flows", (newValue) => {
    if (newValue) set({ flows: newValue });
  });

  return {
    flows: {},
    loading: false,
    editingId: null,

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
        return {
          flows: next,
          editingId: s.editingId === id ? null : s.editingId,
        };
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

    setEditing: (id) => {
      set({ editingId: id });
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

// ─── Flow Editor ────────────────────────────────────────────────────────────

function FlowEditor({
  initial,
  isNew,
  onBack,
}: {
  initial: Flow;
  isNew: boolean;
  onBack: () => void;
}) {
  const { save, remove, runNow } = useFlowsStore();
  const [draft, setDraft] = useState<Flow>(initial);

  const patch = useCallback(<K extends keyof Flow>(key: K, value: Flow[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    const updated: Flow = {
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

  const handleRun = async () => {
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
          {isNew ? "New Flow" : "Edit Flow"}
        </h2>
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

        {/* Node info */}
        <div className="border-border bg-bg-tertiary rounded-md border p-3">
          <div className="flex items-center gap-2">
            <ExternalLink size={12} className="text-text-muted" />
            <span className="text-text-secondary text-xs">
              {String(draft.nodes.length)} node{draft.nodes.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-text-muted mt-1 text-[10px]">
            Open Full Editor for visual node editing (available in Options page)
          </p>
        </div>

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
  const { flows, loading, editingId, load, toggle, runNow, setEditing } = useFlowsStore();
  const [newFlow, setNewFlow] = useState<Flow | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const flowList = useMemo(
    () => Object.values(flows).sort((a, b) => a.name.localeCompare(b.name)),
    [flows],
  );

  // Editor for new flow
  if (newFlow) {
    return (
      <FlowEditor
        initial={newFlow}
        isNew
        onBack={() => {
          setNewFlow(null);
        }}
      />
    );
  }

  // Editor for existing flow
  if (editingId) {
    const flow = flows[editingId];
    if (flow) {
      return (
        <FlowEditor
          key={editingId}
          initial={flow}
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
        <h2 className="text-text-primary text-sm font-semibold">Flows</h2>
        <div className="flex items-center gap-1">
          <SectionExportImport section="flows" />
          <Button
            variant="primary"
            onClick={() => {
              setNewFlow(createNewFlow());
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
          {flowList.map((flow) => (
            <Card
              key={flow.id}
              onClick={() => {
                setEditing(flow.id);
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    flow.enabled ? "bg-active" : "bg-text-muted"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-xs font-medium">
                    {flow.name || "Untitled"}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted text-[10px]">{scopeLabel(flow.scope)}</span>
                    <span className="text-text-muted text-[10px]">
                      {String(flow.nodes.length)} node{flow.nodes.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void runNow(flow.id);
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
                    checked={flow.enabled}
                    onChange={(enabled) => void toggle(flow.id, enabled)}
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
