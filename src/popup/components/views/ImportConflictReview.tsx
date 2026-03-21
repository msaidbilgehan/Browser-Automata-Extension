import { useState, useCallback, useMemo } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Pencil, Plus, Minus } from "lucide-react";
import type { EntityId, KeyCombo } from "@/shared/types/entities";
import type {
  ImportConflictReport,
  ImportConflict,
  ImportConflictItem,
  ImportEntityOverride,
} from "@/shared/types/import-export";
import { Button } from "../ui/Button";
import { KeyCaptureInput } from "../editor/KeyCaptureInput";

interface ImportConflictReviewProps {
  report: ImportConflictReport;
  onImport: (selectedIds: EntityId[], overrides: Record<string, ImportEntityOverride>) => void;
  onCancel: () => void;
  importing: boolean;
}

/** Section display labels */
const SECTION_LABELS: Record<string, string> = {
  scripts: "Scripts",
  shortcuts: "Shortcuts",
  flows: "Flows",
  cssRules: "CSS Rules",
  extractionRules: "Extraction Rules",
  networkRules: "Network Rules",
  profiles: "Profiles",
  variables: "Variables",
  sharedLibraries: "Shared Libraries",
  formFillProfiles: "Form Fill Profiles",
  notificationRules: "Notification Rules",
  siteAdapters: "Site Adapters",
};

function sectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? key;
}

/**
 * Group items by entityType for display.
 */
function groupByType<T extends { entityType: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.entityType) ?? [];
    list.push(item);
    groups.set(item.entityType, list);
  }
  return groups;
}

function ConflictRow({
  conflict,
  checked,
  onToggle,
  onKeyComboChange,
  keyComboOverride,
}: {
  conflict: ImportConflict;
  checked: boolean;
  onToggle: () => void;
  onKeyComboChange?: ((combo: KeyCombo) => void) | undefined;
  keyComboOverride?: KeyCombo | null | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingKeyCombo, setEditingKeyCombo] = useState(false);
  const isShortcut = conflict.entityType === "shortcuts";
  const keyComboConflict = conflict.differences.find((d) => d.field === "keyCombo");

  return (
    <div className="border-border-dim rounded border">
      <div className="flex items-start gap-1.5 p-1.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="accent-active mt-0.5 shrink-0"
        />
        <button
          type="button"
          onClick={() => { setExpanded(!expanded); }}
          className="flex flex-1 items-start gap-1 text-left"
        >
          {expanded ? (
            <ChevronDown size={12} className="text-text-muted mt-0.5 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-text-muted mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-text-primary text-[11px] font-medium">{conflict.entityName}</p>
            <p className="text-text-muted text-[10px]">
              {String(conflict.differences.length)} field(s) differ
            </p>
          </div>
        </button>
        {isShortcut && keyComboConflict ? (
          <button
            type="button"
            onClick={() => { setEditingKeyCombo(!editingKeyCombo); }}
            className="text-active hover:bg-bg-tertiary rounded p-0.5"
            title="Edit key combo before import"
          >
            <Pencil size={10} />
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-border-dim flex flex-col gap-0.5 border-t px-2 py-1">
          {conflict.differences.map((diff) => (
            <div key={diff.field} className="text-[10px]">
              <span className="text-text-secondary font-medium">{diff.field}: </span>
              <span className="text-error-dim line-through">{diff.existingValue}</span>
              <span className="text-text-muted"> → </span>
              <span className="text-active">{diff.importedValue}</span>
            </div>
          ))}
        </div>
      ) : null}

      {editingKeyCombo && isShortcut && onKeyComboChange ? (
        <div className="border-border-dim border-t px-2 py-1.5">
          <KeyCaptureInput
            value={keyComboOverride ?? null}
            onChange={(combo) => {
              onKeyComboChange(combo);
              setEditingKeyCombo(false);
            }}
            label="New key combo"
          />
        </div>
      ) : null}
    </div>
  );
}

function NewItemRow({
  item,
  checked,
  onToggle,
}: {
  item: ImportConflictItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="hover:bg-bg-tertiary flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-active shrink-0"
      />
      <span className="text-text-primary text-[11px]">{item.entityName}</span>
    </label>
  );
}

export function ImportConflictReview({
  report,
  onImport,
  onCancel,
  importing,
}: ImportConflictReviewProps) {
  // New items: selected by default
  const [selectedNew, setSelectedNew] = useState<Set<string>>(
    () => new Set(report.newItems.map((i) => i.entityId)),
  );
  // Conflicts: unselected by default
  const [selectedConflicts, setSelectedConflicts] = useState<Set<string>>(() => new Set());
  // Key combo overrides for shortcuts
  const [keyComboOverrides, setKeyComboOverrides] = useState<Record<string, KeyCombo>>({});

  const toggleNew = useCallback((id: string) => {
    setSelectedNew((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleConflict = useCallback((id: string) => {
    setSelectedConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllNew = useCallback(() => {
    setSelectedNew((prev) => {
      if (prev.size === report.newItems.length) return new Set();
      return new Set(report.newItems.map((i) => i.entityId));
    });
  }, [report.newItems]);

  const selectAllConflicts = useCallback(() => {
    setSelectedConflicts((prev) => {
      if (prev.size === report.conflicts.length) return new Set();
      return new Set(report.conflicts.map((i) => i.entityId));
    });
  }, [report.conflicts]);

  const handleKeyComboChange = useCallback((entityId: string, combo: KeyCombo) => {
    setKeyComboOverrides((prev) => ({ ...prev, [entityId]: combo }));
  }, []);

  const totalSelected = selectedNew.size + selectedConflicts.size;

  const handleImport = useCallback(() => {
    const allIds = [...selectedNew, ...selectedConflicts] as EntityId[];
    const overrides: Record<string, ImportEntityOverride> = {};
    for (const [id, combo] of Object.entries(keyComboOverrides)) {
      if (selectedConflicts.has(id)) {
        overrides[id] = { keyCombo: combo };
      }
    }
    onImport(allIds, overrides);
  }, [selectedNew, selectedConflicts, keyComboOverrides, onImport]);

  const groupedNew = useMemo(() => groupByType(report.newItems), [report.newItems]);
  const groupedConflicts = useMemo(() => groupByType(report.conflicts), [report.conflicts]);
  const groupedUnchanged = useMemo(() => groupByType(report.unchangedItems), [report.unchangedItems]);

  const hasNew = report.newItems.length > 0;
  const hasConflicts = report.conflicts.length > 0;
  const hasUnchanged = report.unchangedItems.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={14} className="text-warning shrink-0" />
        <span className="text-text-primary text-xs font-medium">Review Import</span>
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        <div className="flex flex-col gap-2">
          {/* New items */}
          {hasNew ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-active text-[10px] font-semibold uppercase tracking-wide">
                  <Plus size={10} className="mr-0.5 inline" />
                  New ({String(report.newItems.length)})
                </span>
                <button
                  type="button"
                  onClick={selectAllNew}
                  className="text-active text-[10px] font-medium hover:underline"
                >
                  {selectedNew.size === report.newItems.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              {[...groupedNew.entries()].map(([type, items]) => (
                <div key={type} className="flex flex-col gap-0.5">
                  <span className="text-text-muted text-[10px] font-medium">
                    {sectionLabel(type)}
                  </span>
                  {items.map((item) => (
                    <NewItemRow
                      key={item.entityId}
                      item={item}
                      checked={selectedNew.has(item.entityId)}
                      onToggle={() => { toggleNew(item.entityId); }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {/* Conflicts */}
          {hasConflicts ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-warning text-[10px] font-semibold uppercase tracking-wide">
                  <AlertTriangle size={10} className="mr-0.5 inline" />
                  Conflicts ({String(report.conflicts.length)})
                </span>
                <button
                  type="button"
                  onClick={selectAllConflicts}
                  className="text-active text-[10px] font-medium hover:underline"
                >
                  {selectedConflicts.size === report.conflicts.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              {[...groupedConflicts.entries()].map(([type, items]) => (
                <div key={type} className="flex flex-col gap-1">
                  <span className="text-text-muted text-[10px] font-medium">
                    {sectionLabel(type)}
                  </span>
                  {items.map((conflict) => (
                    <ConflictRow
                      key={conflict.entityId}
                      conflict={conflict}
                      checked={selectedConflicts.has(conflict.entityId)}
                      onToggle={() => { toggleConflict(conflict.entityId); }}
                      onKeyComboChange={
                        conflict.entityType === "shortcuts"
                          ? (combo) => { handleKeyComboChange(conflict.entityId, combo); }
                          : undefined
                      }
                      keyComboOverride={keyComboOverrides[conflict.entityId] ?? null}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {/* Unchanged */}
          {hasUnchanged ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">
                <Minus size={10} className="mr-0.5 inline" />
                Unchanged ({String(report.unchangedItems.length)}) — will skip
              </span>
              {[...groupedUnchanged.entries()].map(([type, items]) => (
                <div key={type} className="flex flex-col gap-0.5">
                  <span className="text-text-muted text-[10px] font-medium">
                    {sectionLabel(type)}
                  </span>
                  {items.map((item) => (
                    <span
                      key={item.entityId}
                      className="text-text-muted px-1.5 py-0.5 text-[11px]"
                    >
                      {item.entityName}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={importing || totalSelected === 0}
          className="gap-1"
        >
          {importing
            ? "Importing..."
            : `Import ${String(totalSelected)} item${totalSelected !== 1 ? "s" : ""}`}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={importing}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
