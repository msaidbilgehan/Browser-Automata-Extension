import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Shield, Plus, ArrowLeft, Save, Trash2, X, Undo2, Copy } from "lucide-react";
import type {
  NetworkRule,
  HeaderMod,
  NetworkRuleAction,
  UrlPattern,
} from "@/shared/types/entities";
import { generateId, now } from "@/shared/utils";
import { useNetworkRulesStore } from "../../stores/network-rules-store";
import { useEditorDraft } from "../../hooks/use-editor-draft";
import { removeDraft, loadAllDrafts } from "../../stores/editor-session";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { UrlPatternInput } from "../editor/UrlPatternInput";

const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "media",
  "websocket",
  "other",
];

const ACTION_TYPE_OPTIONS = [
  { value: "block", label: "Block" },
  { value: "redirect", label: "Redirect" },
  { value: "modify_headers", label: "Modify Headers" },
];

const HEADER_OPERATION_OPTIONS = [
  { value: "set", label: "Set" },
  { value: "append", label: "Append" },
  { value: "remove", label: "Remove" },
];

function createNewNetworkRule(): NetworkRule {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    scope: { type: "global", value: "" },
    enabled: true,
    profileId: null,
    urlFilter: "",
    resourceTypes: [],
    action: { type: "block" },
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

function scopeLabel(scope: UrlPattern): string {
  return scope.type === "global" ? "Global" : scope.value || scope.type;
}

function actionTypeLabel(action: NetworkRuleAction): string {
  switch (action.type) {
    case "block":
      return "Block";
    case "redirect":
      return "Redirect";
    case "modify_headers":
      return "Headers";
  }
}

const HeaderModTable = memo(function HeaderModTable({
  label,
  headers,
  onChange,
}: {
  label: string;
  headers: HeaderMod[];
  onChange: (headers: HeaderMod[]) => void;
}) {
  const addHeader = () => {
    onChange([...headers, { operation: "set", header: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    onChange(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, patch: Partial<HeaderMod>) => {
    onChange(headers.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs font-medium">{label}</span>
        <button
          type="button"
          onClick={addHeader}
          className="text-active hover:bg-bg-tertiary rounded px-1.5 py-0.5 text-[10px]"
        >
          + Add
        </button>
      </div>
      {headers.map((h, i) => (
        <div key={i} className="flex items-center gap-1">
          <select
            value={h.operation}
            onChange={(e) => {
              updateHeader(i, { operation: e.target.value as HeaderMod["operation"] });
            }}
            className="border-border bg-bg-tertiary text-text-primary rounded-md border px-1.5 py-1 text-[10px] outline-none"
          >
            {HEADER_OPERATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={h.header}
            onChange={(e) => {
              updateHeader(i, { header: e.target.value });
            }}
            placeholder="Header name"
            className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active min-w-0 flex-1 rounded-md border px-2 py-1 text-[10px] outline-none"
          />
          {h.operation !== "remove" ? (
            <input
              type="text"
              value={h.value ?? ""}
              onChange={(e) => {
                updateHeader(i, { value: e.target.value });
              }}
              placeholder="Value"
              className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active min-w-0 flex-1 rounded-md border px-2 py-1 text-[10px] outline-none"
            />
          ) : null}
          <button
            type="button"
            onClick={() => {
              removeHeader(i);
            }}
            className="text-text-muted hover:bg-bg-tertiary hover:text-error rounded p-0.5"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
});

function NetworkRuleEditor({
  initial,
  isNew,
  onBack,
}: {
  initial: NetworkRule;
  isNew: boolean;
  onBack: () => void;
}) {
  const { save, remove } = useNetworkRulesStore();
  const { draft, setDraft, isDirty, commitDraft, discardDraft } = useEditorDraft<NetworkRule>({
    tab: "network-rules",
    entityId: initial.id,
    isNew,
    initial,
    saved: isNew ? null : initial,
  });

  const patch = useCallback(<K extends keyof NetworkRule>(key: K, value: NetworkRule[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, [setDraft]);

  const setAction = useCallback((action: NetworkRuleAction) => {
    setDraft((prev) => ({ ...prev, action }));
  }, [setDraft]);

  const handleActionTypeChange = useCallback(
    (newType: NetworkRuleAction["type"]) => {
      switch (newType) {
        case "block":
          setAction({ type: "block" });
          break;
        case "redirect":
          setAction({ type: "redirect", url: "" });
          break;
        case "modify_headers":
          setAction({ type: "modify_headers", requestHeaders: [], responseHeaders: [] });
          break;
      }
    },
    [setAction],
  );

  const toggleResourceType = useCallback((rt: string) => {
    setDraft((prev) => {
      const current = prev.resourceTypes ?? [];
      const next = current.includes(rt) ? current.filter((t) => t !== rt) : [...current, rt];
      return { ...prev, resourceTypes: next };
    });
  }, [setDraft]);

  const handleRequestHeadersChange = useCallback(
    (requestHeaders: HeaderMod[]) => {
      setDraft((prev) => {
        const responseHeaders =
          prev.action.type === "modify_headers"
            ? (prev.action.responseHeaders ?? [])
            : [];
        return { ...prev, action: { type: "modify_headers", requestHeaders, responseHeaders } };
      });
    },
    [setDraft],
  );

  const handleResponseHeadersChange = useCallback(
    (responseHeaders: HeaderMod[]) => {
      setDraft((prev) => {
        const requestHeaders =
          prev.action.type === "modify_headers"
            ? (prev.action.requestHeaders ?? [])
            : [];
        return { ...prev, action: { type: "modify_headers", requestHeaders, responseHeaders } };
      });
    },
    [setDraft],
  );

  const handleSave = async () => {
    const updated: NetworkRule = {
      ...draft,
      meta: { ...draft.meta, updatedAt: now() },
    };
    await save(updated);
    await commitDraft();
    onBack();
  };

  const handleDelete = async () => {
    await remove(draft.id);
    await removeDraft("network-rules", draft.id);
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
          {isNew ? "New Network Rule" : "Edit Network Rule"}
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
          value={draft.name}
          onChange={(e) => {
            patch("name", e.target.value);
          }}
          placeholder="My Network Rule"
        />

        <UrlPatternInput
          label="Scope"
          value={draft.scope}
          onChange={(scope) => {
            patch("scope", scope);
          }}
        />

        <Input
          label="URL Filter"
          value={draft.urlFilter}
          onChange={(e) => {
            patch("urlFilter", e.target.value);
          }}
          placeholder="||ads.example.com^"
        />

        {/* Resource Types */}
        <div className="flex flex-col gap-1">
          <span className="text-text-secondary text-xs font-medium">Resource Types</span>
          <div className="flex flex-wrap gap-1">
            {RESOURCE_TYPES.map((rt) => {
              const selected = (draft.resourceTypes ?? []).includes(rt);
              return (
                <button
                  key={rt}
                  type="button"
                  onClick={() => {
                    toggleResourceType(rt);
                  }}
                  className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors ${
                    selected
                      ? "border-active bg-active/10 text-active"
                      : "border-border bg-bg-tertiary text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {rt}
                </button>
              );
            })}
          </div>
        </div>

        <Select
          label="Action Type"
          options={ACTION_TYPE_OPTIONS}
          value={draft.action.type}
          onChange={(e) => {
            handleActionTypeChange(e.target.value as NetworkRuleAction["type"]);
          }}
        />

        {/* Conditional fields per action type */}
        {draft.action.type === "redirect" ? (
          <Input
            label="Redirect URL"
            value={draft.action.url}
            onChange={(e) => {
              setAction({ type: "redirect", url: e.target.value });
            }}
            placeholder="https://example.com/replacement"
          />
        ) : null}

        {draft.action.type === "modify_headers" ? (
          <>
            <HeaderModTable
              label="Request Headers"
              headers={draft.action.requestHeaders ?? []}
              onChange={handleRequestHeadersChange}
            />
            <HeaderModTable
              label="Response Headers"
              headers={draft.action.responseHeaders ?? []}
              onChange={handleResponseHeadersChange}
            />
          </>
        ) : null}

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

export function NetworkRulesView() {
  const { networkRules, loading, editingId, load, save, setEditing } = useNetworkRulesStore();
  const [newRule, setNewRule] = useState<NetworkRule | null>(null);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editingId && !newRule) {
      void loadAllDrafts("network-rules").then((map) => { setDraftIds(new Set(Object.keys(map))); });
    }
  }, [editingId, newRule]);

  const ruleList = useMemo(
    () =>
      Object.values(networkRules)
        .filter((s): s is NetworkRule => typeof s.name === "string")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [networkRules],
  );

  const handleToggle = async (rule: NetworkRule, enabled: boolean) => {
    await save({ ...rule, enabled, meta: { ...rule.meta, updatedAt: now() } });
  };

  // Editor for new rule
  if (newRule) {
    return (
      <NetworkRuleEditor
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
    const rule = networkRules[editingId];
    if (rule) {
      return (
        <NetworkRuleEditor
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
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold">Network Rules</h2>
        <Button
          variant="primary"
          onClick={() => {
            setNewRule(createNewNetworkRule());
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
          <Shield size={32} className="text-text-muted" />
          <p className="text-text-muted text-xs">No network rules yet</p>
          <p className="text-text-muted text-[10px]">
            Block, redirect, or modify network requests per domain
          </p>
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
                      {actionTypeLabel(rule.action)}
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
