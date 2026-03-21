import { useState } from "react";
import { X } from "lucide-react";
import type { ExtractionFieldTransform } from "@/shared/types/entities";

const TRANSFORM_OPTIONS: { value: ExtractionFieldTransform["type"]; label: string }[] = [
  { value: "trim", label: "Trim" },
  { value: "lowercase", label: "Lowercase" },
  { value: "uppercase", label: "Uppercase" },
  { value: "strip_html", label: "Strip HTML" },
  { value: "normalize_url", label: "Normalize URL" },
  { value: "normalize_whitespace", label: "Collapse Whitespace" },
  { value: "replace", label: "Replace" },
  { value: "regex_replace", label: "Regex Replace" },
];

function createTransform(type: ExtractionFieldTransform["type"]): ExtractionFieldTransform {
  switch (type) {
    case "replace":
      return { type: "replace", search: "", replacement: "" };
    case "regex_replace":
      return { type: "regex_replace", pattern: "", flags: "g", replacement: "" };
    default:
      return { type } as ExtractionFieldTransform;
  }
}

export function TransformEditor({
  transforms,
  onChange,
}: {
  transforms: ExtractionFieldTransform[];
  onChange: (transforms: ExtractionFieldTransform[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const addTransform = (type: ExtractionFieldTransform["type"]) => {
    onChange([...transforms, createTransform(type)]);
  };

  const removeTransform = (index: number) => {
    onChange(transforms.filter((_, i) => i !== index));
  };

  const updateTransform = (index: number, patch: Partial<ExtractionFieldTransform>) => {
    onChange(transforms.map((t, i) => (i === index ? { ...t, ...patch } as ExtractionFieldTransform : t)));
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => { setOpen(!open); }}
        className="text-text-muted hover:text-text-secondary flex items-center gap-1 text-[9px]"
      >
        <span>{open ? "▾" : "▸"}</span>
        Transforms{transforms.length > 0 ? ` (${String(transforms.length)})` : ""}
      </button>
      {open && (
        <div className="border-border/50 flex flex-col gap-1 border-l pl-2">
          {transforms.map((t, i) => (
            <div key={i} className="bg-bg-primary flex flex-col gap-0.5 rounded border border-border/30 p-1">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-[9px] font-medium">
                  {TRANSFORM_OPTIONS.find((o) => o.value === t.type)?.label ?? t.type}
                </span>
                <button
                  type="button"
                  onClick={() => { removeTransform(i); }}
                  className="text-text-muted hover:text-error text-[10px] leading-none"
                >
                  <X size={10} />
                </button>
              </div>
              {t.type === "replace" && (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={t.search}
                    onChange={(e) => { updateTransform(i, { search: e.target.value }); }}
                    placeholder="Search"
                    className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[9px] outline-none"
                  />
                  <input
                    type="text"
                    value={t.replacement}
                    onChange={(e) => { updateTransform(i, { replacement: e.target.value }); }}
                    placeholder="Replace"
                    className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[9px] outline-none"
                  />
                </div>
              )}
              {t.type === "regex_replace" && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={t.pattern}
                      onChange={(e) => { updateTransform(i, { pattern: e.target.value }); }}
                      placeholder="Pattern (regex)"
                      className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[9px] outline-none"
                    />
                    <input
                      type="text"
                      value={t.flags}
                      onChange={(e) => { updateTransform(i, { flags: e.target.value }); }}
                      placeholder="Flags"
                      className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active w-10 rounded border px-1.5 py-0.5 text-[9px] outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    value={t.replacement}
                    onChange={(e) => { updateTransform(i, { replacement: e.target.value }); }}
                    placeholder="Replacement"
                    className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active rounded border px-1.5 py-0.5 text-[9px] outline-none"
                  />
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            {TRANSFORM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { addTransform(opt.value); }}
                className="text-active/70 hover:text-active hover:bg-bg-tertiary rounded px-1 py-0.5 text-[8px]"
              >
                + {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
