import type { ExtractionOutputAction } from "@/shared/types/entities";

const OUTPUT_ACTION_OPTIONS: { value: ExtractionOutputAction; label: string }[] = [
  { value: "show", label: "Show in Logs" },
  { value: "show_page", label: "Show on Page" },
  { value: "show_tab", label: "Show in New Tab" },
  { value: "clipboard", label: "Copy to Clipboard" },
  { value: "download", label: "Download File" },
];

export function OutputActionCheckboxes({
  value,
  onChange,
}: {
  value: ExtractionOutputAction[];
  onChange: (actions: ExtractionOutputAction[]) => void;
}) {
  const toggle = (action: ExtractionOutputAction) => {
    if (value.includes(action)) {
      if (value.length <= 1) return;
      onChange(value.filter((a) => a !== action));
    } else {
      onChange([...value, action]);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-secondary text-xs font-medium">After Extraction</span>
      <div className="flex flex-wrap gap-1.5">
        {OUTPUT_ACTION_OPTIONS.map((opt) => {
          const checked = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { toggle(opt.value); }}
              className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
                checked
                  ? "border-active bg-active/10 text-active"
                  : "border-border bg-bg-tertiary text-text-muted hover:border-border-active hover:text-text-secondary"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
