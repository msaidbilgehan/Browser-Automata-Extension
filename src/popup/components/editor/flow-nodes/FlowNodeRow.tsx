import {
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react";
import type { FlowNode } from "@/shared/types/entities";
import { getNodeIcon, getNodeLabel, getNodeSummary } from "./constants";
import { NodeConfigForm } from "./NodeConfigForm";

export interface FlowNodeRowProps {
  node: FlowNode;
  index: number;
  totalCount: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (node: FlowNode) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
  onPickStart?: (() => void) | undefined;
}

export function FlowNodeRow({
  node,
  index,
  totalCount,
  expanded,
  onToggle,
  onUpdate,
  onMove,
  onDelete,
  onPickStart,
}: FlowNodeRowProps) {
  return (
    <div className="border-border bg-bg-secondary rounded-md border">
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="hover:bg-bg-tertiary flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-text-muted shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-text-muted shrink-0" />
        )}
        <span className="text-text-muted shrink-0 font-mono text-[10px]">
          {String(index + 1)}.
        </span>
        <span className="text-active shrink-0">{getNodeIcon(node.config.type)}</span>
        <span className="text-text-primary min-w-0 flex-1 truncate text-xs font-medium">
          {getNodeLabel(node.config.type)}
        </span>
        {!expanded ? (
          <span className="text-text-muted min-w-0 truncate text-[10px]">
            {getNodeSummary(node.config)}
          </span>
        ) : null}
      </button>

      {/* Expanded config */}
      {expanded ? (
        <div className="border-border flex flex-col gap-2 border-t px-2.5 py-2">
          <NodeConfigForm
            config={node.config}
            onChange={(config) => { onUpdate({ ...node, config }); }}
            nodeId={node.id}
            onPickStart={onPickStart}
          />

          {/* Actions row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => { onMove("up"); }}
                disabled={index === 0}
                className="text-text-muted hover:text-text-primary disabled:opacity-30 rounded p-0.5 transition-colors"
                aria-label="Move up"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => { onMove("down"); }}
                disabled={index === totalCount - 1}
                className="text-text-muted hover:text-text-primary disabled:opacity-30 rounded p-0.5 transition-colors"
                aria-label="Move down"
              >
                <ArrowDown size={12} />
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="text-text-muted hover:text-error flex items-center gap-1 rounded p-0.5 text-[10px] transition-colors"
              aria-label="Delete node"
            >
              <Trash2 size={11} />
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
