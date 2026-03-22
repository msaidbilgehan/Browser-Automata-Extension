import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Plus,
  ArrowLeft,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { create } from "zustand";
import type {
  QuickRunAction,
  QuickRunTarget,
  QuickRunTargetType,
  EntityId,
  UrlPattern,
  ScopeMode,
  Script,
  Flow,
  ExtractionRule,
  FormFillProfile,
} from "@/shared/types/entities";
import { localStore, onStorageChange } from "@/shared/storage";
import { sendToBackground } from "@/shared/messaging";
import { generateId, now } from "@/shared/utils";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { UrlPatternInput } from "../editor/UrlPatternInput";

// ─── Inline Quick Run Store ─────────────────────────────────────────────────

interface QuickRunState {
  actions: Record<string, QuickRunAction>;
  loading: boolean;

  load: () => Promise<void>;
  save: (action: QuickRunAction) => Promise<void>;
  remove: (id: EntityId) => Promise<void>;
  reorder: (orderedIds: EntityId[]) => Promise<void>;
}

const useQuickRunStore = create<QuickRunState>((set) => {
  onStorageChange("quickRunActions", (newValue) => {
    if (newValue) set({ actions: newValue });
  });

  return {
    actions: {},
    loading: false,

    load: async () => {
      set({ loading: true });
      const actions = (await localStore.get("quickRunActions")) ?? {};
      set({ actions, loading: false });
    },

    save: async (action) => {
      await sendToBackground({ type: "QUICK_RUN_SAVE", action });
      set((s) => ({
        actions: { ...s.actions, [action.id]: action },
      }));
    },

    remove: async (id) => {
      await sendToBackground({ type: "QUICK_RUN_DELETE", actionId: id });
      set((s) => {
        const next = { ...s.actions };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[id];
        return { actions: next };
      });
    },

    reorder: async (orderedIds) => {
      await sendToBackground({ type: "QUICK_RUN_REORDER", orderedIds });
    },
  };
});

// ─── Entity loading for target selection ────────────────────────────────────

interface EntityOption {
  value: string;
  label: string;
}

function useEntityOptions(targetType: QuickRunTargetType): EntityOption[] {
  const [options, setOptions] = useState<EntityOption[]>([]);

  useEffect(() => {
    void (async () => {
      switch (targetType) {
        case "script": {
          const scripts = (await localStore.get("scripts")) ?? {};
          setOptions(
            Object.values(scripts).map((s: Script) => ({ value: s.id, label: s.name || s.id })),
          );
          break;
        }
        case "flow": {
          const flows = (await localStore.get("flows")) ?? {};
          setOptions(
            Object.values(flows).map((f: Flow) => ({ value: f.id, label: f.name || f.id })),
          );
          break;
        }
        case "extraction": {
          const rules = (await localStore.get("extractionRules")) ?? {};
          setOptions(
            Object.values(rules).map((r: ExtractionRule) => ({ value: r.id, label: r.name || r.id })),
          );
          break;
        }
        case "form_fill": {
          const profiles = (await localStore.get("formFillProfiles")) ?? {};
          setOptions(
            Object.values(profiles).map((p: FormFillProfile) => ({ value: p.id, label: p.name || p.id })),
          );
          break;
        }
      }
    })();
  }, [targetType]);

  return options;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TARGET_TYPE_OPTIONS: EntityOption[] = [
  { value: "script", label: "Script" },
  { value: "flow", label: "Flow" },
  { value: "extraction", label: "Extraction" },
  { value: "form_fill", label: "Form Fill" },
];

const TARGET_TYPE_LABELS: Record<QuickRunTargetType, string> = {
  script: "Script",
  flow: "Flow",
  extraction: "Extraction",
  form_fill: "Form Fill",
};

function createNewAction(order: number): QuickRunAction {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    target: { type: "script", scriptId: "" as EntityId },
    scope: { type: "global", value: "" },
    order,
    enabled: true,
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

function getTargetEntityId(target: QuickRunTarget): string {
  switch (target.type) {
    case "script":
      return target.scriptId;
    case "flow":
      return target.flowId;
    case "extraction":
      return target.extractionRuleId;
    case "form_fill":
      return target.formFillProfileId;
  }
}

function buildTarget(type: QuickRunTargetType, entityId: string): QuickRunTarget {
  const id = entityId as EntityId;
  switch (type) {
    case "script":
      return { type: "script", scriptId: id };
    case "flow":
      return { type: "flow", flowId: id };
    case "extraction":
      return { type: "extraction", extractionRuleId: id };
    case "form_fill":
      return { type: "form_fill", formFillProfileId: id };
  }
}

function scopeLabel(scope: UrlPattern, scopeMode?: ScopeMode): string {
  if (scopeMode === "follow") return "Follows action rule";
  if (scopeMode === "override") {
    const base = scope.type === "global" ? "Global" : scope.value || scope.type;
    return `${base} + action rule`;
  }
  return scope.type === "global" ? "Global" : scope.value || scope.type;
}

const SCOPE_MODE_OPTIONS: EntityOption[] = [
  { value: "custom", label: "Custom Domain Rule" },
  { value: "follow", label: "Follow Action Rule" },
  { value: "override", label: "Add Domain Rule over Action Rule" },
];

/** Load the target entity's scope for preview purposes */
function useTargetScope(targetType: QuickRunTargetType, entityId: string): UrlPattern | null {
  const [targetScope, setTargetScope] = useState<UrlPattern | null>(null);

  useEffect(() => {
    if (!entityId) {
      setTargetScope(null);
      return;
    }
    void (async () => {
      switch (targetType) {
        case "script": {
          const scripts = (await localStore.get("scripts")) ?? {};
          setTargetScope(scripts[entityId]?.scope ?? null);
          break;
        }
        case "flow": {
          const flows = (await localStore.get("flows")) ?? {};
          setTargetScope(flows[entityId]?.scope ?? null);
          break;
        }
        case "extraction": {
          const rules = (await localStore.get("extractionRules")) ?? {};
          setTargetScope(rules[entityId]?.scope ?? null);
          break;
        }
        case "form_fill": {
          const profiles = (await localStore.get("formFillProfiles")) ?? {};
          setTargetScope(profiles[entityId]?.scope ?? null);
          break;
        }
      }
    })();
  }, [targetType, entityId]);

  return targetScope;
}

// ─── Editor Mode ────────────────────────────────────────────────────────────

type EditorMode =
  | { type: "list" }
  | { type: "new"; action: QuickRunAction }
  | { type: "edit"; action: QuickRunAction };

// ─── Quick Run Editor ───────────────────────────────────────────────────────

function QuickRunEditor({
  initial,
  isNew,
  onBack,
}: {
  initial: QuickRunAction;
  isNew: boolean;
  onBack: () => void;
}) {
  const { save, remove } = useQuickRunStore();
  const [draft, setDraft] = useState<QuickRunAction>(initial);
  const [targetType, setTargetType] = useState<QuickRunTargetType>(initial.target.type);
  const [entityId, setEntityId] = useState<string>(getTargetEntityId(initial.target));
  const entityOptions = useEntityOptions(targetType);
  const [scopeMode, setScopeMode] = useState<ScopeMode>(initial.scopeMode ?? "custom");
  const targetScope = useTargetScope(targetType, entityId);

  const handleSave = async () => {
    const updated: QuickRunAction = {
      ...draft,
      target: buildTarget(targetType, entityId),
      scopeMode,
      meta: { ...draft.meta, updatedAt: now() },
    };
    await save(updated);
    onBack();
  };

  const handleDelete = async () => {
    await remove(draft.id);
    onBack();
  };

  const handleScopeChange = useCallback(
    (scope: UrlPattern) => {
      setDraft((prev) => ({ ...prev, scope }));
    },
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-text-muted hover:text-text-primary transition-colors"
          aria-label="Back to list"
        >
          <ArrowLeft size={16} />
        </button>
        <Zap size={16} className="text-active" />
        <span className="text-text-primary text-sm font-medium">
          {isNew ? "New Quick Action" : "Edit Quick Action"}
        </span>
      </div>

      {/* Name */}
      <Input
        label="Name"
        value={draft.name}
        onChange={(e) => {
          setDraft((prev) => ({ ...prev, name: e.target.value }));
        }}
        placeholder="e.g. Run my scraper"
      />

      {/* Target type */}
      <Select
        label="Action Type"
        options={TARGET_TYPE_OPTIONS}
        value={targetType}
        onChange={(e) => {
          const newType = e.target.value as QuickRunTargetType;
          setTargetType(newType);
          setEntityId("");
        }}
      />

      {/* Target entity */}
      <Select
        label="Target"
        options={[{ value: "", label: "Select..." }, ...entityOptions]}
        value={entityId}
        onChange={(e) => {
          setEntityId(e.target.value);
        }}
      />

      {/* Scope Mode */}
      <Select
        label="Domain Rule"
        options={SCOPE_MODE_OPTIONS}
        value={scopeMode}
        onChange={(e) => {
          setScopeMode(e.target.value as ScopeMode);
        }}
      />

      {/* Target scope preview */}
      {scopeMode !== "custom" && targetScope ? (
        <div className="bg-bg-tertiary border-border rounded-md border px-2.5 py-1.5">
          <span className="text-text-muted text-[10px]">Action scope: </span>
          <span className="text-text-secondary text-[10px] font-medium">
            {targetScope.type === "global" ? "All sites" : targetScope.value || targetScope.type}
          </span>
        </div>
      ) : null}
      {scopeMode !== "custom" && !targetScope && entityId ? (
        <p className="text-warning text-[10px]">Target entity not found — will fall back to custom scope.</p>
      ) : null}

      {/* URL Scope — hidden when following action rule */}
      {scopeMode !== "follow" ? (
        <UrlPatternInput
          {...(scopeMode === "override" ? { label: "Additional Scope" } : {})}
          value={draft.scope}
          onChange={handleScopeChange}
        />
      ) : null}

      {/* Enabled toggle */}
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs">Enabled</span>
        <Toggle
          checked={draft.enabled}
          onChange={(enabled) => {
            setDraft((prev) => ({ ...prev, enabled }));
          }}
          size="sm"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => void handleSave()} disabled={!draft.name || !entityId}>
          <Save size={12} className="mr-1" />
          Save
        </Button>
        {!isNew ? (
          <Button variant="danger" onClick={() => void handleDelete()}>
            <Trash2 size={12} className="mr-1" />
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Quick Run List ─────────────────────────────────────────────────────────

function QuickRunList({
  onEdit,
  onNew,
}: {
  onEdit: (action: QuickRunAction) => void;
  onNew: () => void;
}) {
  const { actions, reorder } = useQuickRunStore();

  const sorted = Object.values(actions).sort((a, b) => a.order - b.order);

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const ids = sorted.map((a) => a.id);
    const prev = ids[idx - 1];
    const curr = ids[idx];
    if (prev !== undefined && curr !== undefined) {
      ids[idx - 1] = curr;
      ids[idx] = prev;
      await reorder(ids);
    }
  };

  const handleMoveDown = async (idx: number) => {
    if (idx >= sorted.length - 1) return;
    const ids = sorted.map((a) => a.id);
    const next = ids[idx + 1];
    const curr = ids[idx];
    if (next !== undefined && curr !== undefined) {
      ids[idx + 1] = curr;
      ids[idx] = next;
      await reorder(ids);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-active" />
          <span className="text-text-primary text-sm font-medium">Quick Run</span>
          <span className="text-text-muted text-xs">({sorted.length})</span>
        </div>
        <Button variant="ghost" onClick={onNew}>
          <Plus size={12} className="mr-1" />
          Add
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-text-muted text-xs py-4 text-center">
          No quick actions configured yet. Add one to get started.
        </p>
      ) : null}

      {/* Action cards */}
      {sorted.map((action, idx) => (
        <Card key={action.id} onClick={() => { onEdit(action); }}>
          <div className="flex items-center gap-2">
            {/* Reorder buttons */}
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                className="text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                disabled={idx === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleMoveUp(idx);
                }}
                aria-label="Move up"
              >
                <ArrowUp size={10} />
              </button>
              <button
                type="button"
                className="text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                disabled={idx === sorted.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleMoveDown(idx);
                }}
                aria-label="Move down"
              >
                <ArrowDown size={10} />
              </button>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-text-primary text-xs font-medium truncate">
                  {action.name || "Untitled"}
                </span>
                <span className="text-text-muted bg-bg-tertiary rounded px-1 py-0.5 text-[9px] shrink-0">
                  {TARGET_TYPE_LABELS[action.target.type]}
                </span>
              </div>
              <span className="text-text-muted text-[10px] truncate block">
                {scopeLabel(action.scope, action.scopeMode)}
              </span>
            </div>

            {/* Enabled toggle */}
            <div onClick={(e) => { e.stopPropagation(); }}>
              <Toggle
                checked={action.enabled}
                onChange={(enabled) => {
                  const updated: QuickRunAction = {
                    ...action,
                    enabled,
                    meta: { ...action.meta, updatedAt: now() },
                  };
                  void useQuickRunStore.getState().save(updated);
                }}
                size="sm"
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Main View ──────────────────────────────────────────────────────────────

export function QuickRunView() {
  const { load } = useQuickRunStore();
  const actions = useQuickRunStore((s) => s.actions);
  const [mode, setMode] = useState<EditorMode>({ type: "list" });

  useEffect(() => {
    void load();
  }, [load]);

  const handleNew = useCallback(() => {
    const order = Object.keys(actions).length;
    setMode({ type: "new", action: createNewAction(order) });
  }, [actions]);

  const handleEdit = useCallback((action: QuickRunAction) => {
    setMode({ type: "edit", action });
  }, []);

  const handleBack = useCallback(() => {
    setMode({ type: "list" });
  }, []);

  switch (mode.type) {
    case "list":
      return <QuickRunList onEdit={handleEdit} onNew={handleNew} />;
    case "new":
      return <QuickRunEditor initial={mode.action} isNew onBack={handleBack} />;
    case "edit":
      return <QuickRunEditor initial={mode.action} isNew={false} onBack={handleBack} />;
  }
}
