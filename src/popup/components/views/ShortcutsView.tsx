import { useState, useEffect, useMemo, useCallback } from "react";
import { Keyboard, Plus, ArrowLeft, ArrowRight, Save, Trash2 } from "lucide-react";
import { SectionExportImport } from "../ui/SectionExportImport";
import type { Shortcut, ShortcutAction, KeyCombo, EntityId } from "@/shared/types/entities";
import { generateId, now } from "@/shared/utils";
import { useShortcutsStore } from "../../stores/shortcuts-store";
import { useScriptsStore } from "../../stores/scripts-store";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { CodeEditor } from "../editor/CodeEditor";
import { KeyCaptureInput, formatKeyCombo } from "../editor/KeyCaptureInput";
import { UrlPatternInput } from "../editor/UrlPatternInput";
import { SelectorInput } from "../editor/SelectorInput";
import { jsEditorExtensions } from "@/lib/codemirror/setup";
import { saveEditorDraft, loadEditorDraft } from "../../stores/editor-session";

function createNewShortcut(): Shortcut {
  const timestamp = now();
  return {
    id: generateId(),
    name: "",
    keyCombo: { key: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
    action: { type: "click", selector: "" },
    scope: { type: "global", value: "" },
    enabled: true,
    profileId: null,
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

function actionDescription(action: ShortcutAction): string {
  switch (action.type) {
    case "click":
      return `Click ${action.selector || "..."}`;
    case "script":
      return "Run script";
    case "inline_script":
      return "Run inline code";
    case "focus":
      return `Focus ${action.selector || "..."}`;
    case "navigate":
      return `Go to ${action.url || "..."}`;
    case "flow":
      return "Run flow";
  }
}

function isKeyCombo(combo: Shortcut["keyCombo"]): combo is KeyCombo {
  return "key" in combo && !("sequence" in combo);
}

const ACTION_TYPE_OPTIONS = [
  { value: "click", label: "Click Element" },
  { value: "script", label: "Run Script" },
  { value: "inline_script", label: "Inline Script" },
  { value: "focus", label: "Focus Element" },
  { value: "navigate", label: "Navigate" },
];

function ShortcutEditor({
  initial,
  isNew,
  onBack,
}: {
  initial: Shortcut;
  isNew: boolean;
  onBack: () => void;
}) {
  const { save, remove } = useShortcutsStore();
  const { scripts } = useScriptsStore();
  const [draft, setDraft] = useState<Shortcut>(initial);

  const handlePickStart = useCallback(() => {
    void saveEditorDraft({
      tab: "shortcuts",
      isNew,
      editingId: isNew ? undefined : draft.id,
      draft,
    });
  }, [draft, isNew]);

  const extensions = useMemo(() => jsEditorExtensions(), []);

  const scriptOptions = useMemo(
    () =>
      Object.values(scripts).map((s) => ({
        value: s.id,
        label: s.name || "Untitled",
      })),
    [scripts],
  );

  const patch = useCallback(<K extends keyof Shortcut>(key: K, value: Shortcut[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setActionType = (type: ShortcutAction["type"]) => {
    let action: ShortcutAction;
    switch (type) {
      case "click":
        action = { type: "click", selector: "" };
        break;
      case "script":
        action = {
          type: "script",
          scriptId: (scriptOptions[0]?.value ?? "") as EntityId,
        };
        break;
      case "inline_script":
        action = { type: "inline_script", code: "// Your code here\n" };
        break;
      case "focus":
        action = { type: "focus", selector: "" };
        break;
      case "navigate":
        action = { type: "navigate", url: "" };
        break;
      default:
        return;
    }
    patch("action", action);
  };

  const handleSave = async () => {
    const updated: Shortcut = {
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
          {isNew ? "New Shortcut" : "Edit Shortcut"}
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
          placeholder="My Shortcut"
        />

        <KeyCaptureInput
          label="Key Combo"
          value={isKeyCombo(draft.keyCombo) ? draft.keyCombo : null}
          onChange={(combo) => {
            patch("keyCombo", combo);
          }}
        />

        <Select
          label="Action Type"
          options={ACTION_TYPE_OPTIONS}
          value={draft.action.type}
          onChange={(e) => {
            setActionType(e.target.value as ShortcutAction["type"]);
          }}
        />

        {/* Action-specific inputs */}
        {(draft.action.type === "click" || draft.action.type === "focus") && (
          <SelectorInput
            pickId={`shortcut-${draft.id}-selector`}
            label={draft.action.type === "click" ? "Click Selector" : "Focus Selector"}
            value={draft.action.selector}
            onChange={(selector) => {
              patch("action", { ...draft.action, selector } as ShortcutAction);
            }}
            onPickStart={handlePickStart}
          />
        )}

        {draft.action.type === "script" && (
          <Select
            label="Script"
            options={
              scriptOptions.length > 0
                ? scriptOptions
                : [{ value: "", label: "No scripts available" }]
            }
            value={draft.action.scriptId}
            onChange={(e) => {
              patch("action", {
                type: "script",
                scriptId: e.target.value as EntityId,
              });
            }}
          />
        )}

        {draft.action.type === "inline_script" && (
          <div className="flex flex-col gap-1">
            <span className="text-text-secondary text-xs font-medium">Code</span>
            <CodeEditor
              value={draft.action.code}
              onChange={(code) => {
                patch("action", { type: "inline_script", code });
              }}
              extensions={extensions}
              height="150px"
            />
          </div>
        )}

        {draft.action.type === "navigate" && (
          <Input
            label="URL"
            value={draft.action.url}
            onChange={(e) => {
              patch("action", { type: "navigate", url: e.target.value });
            }}
            placeholder="https://example.com"
          />
        )}

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

export function ShortcutsView() {
  const { shortcuts, loading, editingId, load, toggle, setEditing } = useShortcutsStore();
  const [newShortcut, setNewShortcut] = useState<Shortcut | null>(null);
  // Holds an in-progress draft restored from session (unsaved edits to an existing shortcut)
  const [restoredDraft, setRestoredDraft] = useState<Shortcut | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Also load scripts so the editor can show script options
  const scriptsLoad = useScriptsStore((s) => s.load);
  useEffect(() => {
    void scriptsLoad();
  }, [scriptsLoad]);

  // Restore editor draft from session (e.g. after element picking closed the popup)
  useEffect(() => {
    void loadEditorDraft().then((ctx) => {
      if (ctx?.tab !== "shortcuts") return;
      const draft = ctx.draft as Shortcut;
      if (ctx.isNew) {
        setNewShortcut(draft);
      } else if (ctx.editingId) {
        setEditing(ctx.editingId as EntityId);
        setRestoredDraft(draft);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shortcutList = useMemo(() => Object.values(shortcuts), [shortcuts]);

  // Group by scope domain
  const grouped = useMemo(() => {
    const groups: Record<string, typeof shortcutList> = {};
    for (const s of shortcutList) {
      const key = s.scope.type === "global" ? "Global" : s.scope.value || "Other";
      (groups[key] ??= []).push(s);
    }
    return groups;
  }, [shortcutList]);

  // Editor for new shortcut
  if (newShortcut) {
    return (
      <ShortcutEditor
        initial={newShortcut}
        isNew
        onBack={() => {
          setNewShortcut(null);
        }}
      />
    );
  }

  // Editor for existing shortcut
  if (editingId) {
    const shortcut = shortcuts[editingId];
    if (shortcut) {
      // Use restored draft (unsaved edits) if available, otherwise the saved version
      const initial = restoredDraft?.id === editingId ? restoredDraft : shortcut;
      return (
        <ShortcutEditor
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
        <h2 className="text-text-primary text-sm font-semibold">Shortcuts</h2>
        <div className="flex items-center gap-1">
          <SectionExportImport section="shortcuts" />
          <Button
            variant="primary"
            onClick={() => {
              setNewShortcut(createNewShortcut());
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
      ) : shortcutList.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Keyboard size={32} className="text-text-muted" />
          <p className="text-text-muted text-xs">No shortcuts yet</p>
          <p className="text-text-muted text-[10px]">Bind keyboard combos to actions on any page</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="flex flex-col gap-1">
              <span className="text-text-muted text-[10px] font-medium tracking-wider uppercase">
                {group}
              </span>
              {items.map((shortcut) => (
                <Card
                  key={shortcut.id}
                  onClick={() => {
                    setEditing(shortcut.id);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-active font-mono font-medium">
                          {isKeyCombo(shortcut.keyCombo) && shortcut.keyCombo.key
                            ? formatKeyCombo(shortcut.keyCombo)
                            : "No key set"}
                        </span>
                        <ArrowRight size={10} className="text-text-muted" />
                        <span className="text-text-secondary truncate">
                          {actionDescription(shortcut.action)}
                        </span>
                      </div>
                      {shortcut.name && (
                        <p className="text-text-muted truncate text-[10px]">{shortcut.name}</p>
                      )}
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
                        checked={shortcut.enabled}
                        onChange={(enabled) => void toggle(shortcut.id, enabled)}
                        size="sm"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
