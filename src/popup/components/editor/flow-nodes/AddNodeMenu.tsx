import { X } from "lucide-react";
import { NODE_CONFIG_TYPES, getNodeIcon } from "./constants";
import type { ConfigType } from "./constants";

export function AddNodeMenu({
  onAdd,
  onClose,
}: {
  onAdd: (configType: ConfigType) => void;
  onClose: () => void;
}) {
  const groups = [
    { label: "Actions", types: NODE_CONFIG_TYPES.filter((t) => t.group === "action") },
    { label: "Wait", types: NODE_CONFIG_TYPES.filter((t) => t.group === "wait") },
    { label: "Control Flow", types: NODE_CONFIG_TYPES.filter((t) => t.group === "condition" || t.group === "loop") },
    { label: "Tabs", types: NODE_CONFIG_TYPES.filter((t) => t.group === "open_tab" || t.group === "close_tab") },
  ];

  return (
    <div className="border-border bg-bg-secondary rounded-md border p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-text-secondary text-[10px] font-semibold uppercase tracking-wide">
          Add Node
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-primary rounded p-0.5 transition-colors"
          aria-label="Close menu"
        >
          <X size={12} />
        </button>
      </div>
      {groups.map((group) => (
        <div key={group.label} className="mb-1.5">
          <span className="text-text-muted mb-0.5 block text-[9px] font-medium uppercase tracking-wider">
            {group.label}
          </span>
          <div className="flex flex-wrap gap-1">
            {group.types.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => { onAdd(t.value); }}
                className="border-border bg-bg-tertiary text-text-primary hover:border-active hover:text-active flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors"
              >
                {getNodeIcon(t.value)}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
