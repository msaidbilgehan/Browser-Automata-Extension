import { useState, useCallback, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import type { FlowNode } from "@/shared/types/entities";
import { generateId } from "@/shared/utils";
import { Button } from "../ui/Button";
import { configTypeToNodeType, createDefaultConfig } from "./flow-nodes/constants";
import type { ConfigType } from "./flow-nodes/constants";
import { FlowNodeRow } from "./flow-nodes/FlowNodeRow";
import { AddNodeMenu } from "./flow-nodes/AddNodeMenu";

// ─── Main Editor ─────────────────────────────────────────────────────────────

interface FlowNodeEditorProps {
  nodes: FlowNode[];
  onChange: (nodes: FlowNode[]) => void;
  /** Called before element picker activates (persist draft before popup closes) */
  onPickStart?: (() => void) | undefined;
  /** Restore a previously expanded node (e.g. after draft restore) */
  initialExpandedId?: string | null | undefined;
  /** Notifies parent when the expanded node changes (for draft persistence) */
  onExpandChange?: ((nodeId: string | null) => void) | undefined;
}

export function FlowNodeEditor({ nodes, onChange, onPickStart, initialExpandedId, onExpandChange }: FlowNodeEditorProps) {
  const [expandedId, setExpandedIdRaw] = useState<string | null>(initialExpandedId ?? null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const setExpandedId = useCallback(
    (id: string | null) => {
      setExpandedIdRaw(id);
      onExpandChange?.(id);
    },
    [onExpandChange],
  );

  // Sync expanded state when initialExpandedId prop arrives after initial mount
  // (handles race between zustand and React state updates during draft restoration)
  const lastAppliedInitialRef = useRef<string | null>(initialExpandedId ?? null);
  useEffect(() => {
    if (initialExpandedId != null && initialExpandedId !== lastAppliedInitialRef.current) {
      lastAppliedInitialRef.current = initialExpandedId;
      setExpandedIdRaw(initialExpandedId);
      onExpandChange?.(initialExpandedId);
    }
  }, [initialExpandedId, onExpandChange]);

  const handleAdd = useCallback(
    (configType: ConfigType) => {
      const newNode: FlowNode = {
        id: generateId(),
        type: configTypeToNodeType(configType),
        config: createDefaultConfig(configType),
      };
      onChange([...nodes, newNode]);
      setExpandedId(newNode.id);
      setShowAddMenu(false);
    },
    [nodes, onChange, setExpandedId],
  );

  const handleUpdate = useCallback(
    (index: number, updated: FlowNode) => {
      const next = [...nodes];
      next[index] = updated;
      onChange(next);
    },
    [nodes, onChange],
  );

  const handleMove = useCallback(
    (index: number, direction: "up" | "down") => {
      const next = [...nodes];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return;
      const temp = next[targetIndex];
      if (!temp) return;
      const current = next[index];
      if (!current) return;
      next[targetIndex] = current;
      next[index] = temp;
      onChange(next);
    },
    [nodes, onChange],
  );

  const handleDelete = useCallback(
    (index: number) => {
      const next = nodes.filter((_, i) => i !== index);
      onChange(next);
      if (expandedId === nodes[index]?.id) {
        setExpandedId(null);
      }
    },
    [nodes, onChange, expandedId, setExpandedId],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs font-medium">
          Nodes ({String(nodes.length)})
        </span>
        <Button
          variant="ghost"
          onClick={() => { setShowAddMenu((prev) => !prev); }}
          className="gap-1"
        >
          <Plus size={12} />
          Add
        </Button>
      </div>

      {/* Add menu */}
      {showAddMenu ? (
        <AddNodeMenu
          onAdd={handleAdd}
          onClose={() => { setShowAddMenu(false); }}
        />
      ) : null}

      {/* Node list */}
      {nodes.length === 0 ? (
        <div className="border-border rounded-md border border-dashed p-4 text-center">
          <p className="text-text-muted text-[10px]">
            No nodes yet. Click &quot;Add&quot; to create your first step.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {nodes.map((node, index) => (
            <FlowNodeRow
              key={node.id}
              node={node}
              index={index}
              totalCount={nodes.length}
              expanded={expandedId === node.id}
              onToggle={() => {
                setExpandedId(expandedId === node.id ? null : node.id);
              }}
              onUpdate={(updated) => { handleUpdate(index, updated); }}
              onMove={(direction) => { handleMove(index, direction); }}
              onDelete={() => { handleDelete(index); }}
              onPickStart={onPickStart}
            />
          ))}
        </div>
      )}
    </div>
  );
}
