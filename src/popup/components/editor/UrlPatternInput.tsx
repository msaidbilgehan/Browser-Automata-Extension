import type { UrlPattern } from "@/shared/types/entities";
import { validateUrlPattern } from "@/shared/url-pattern/parser";
import { useState, useEffect } from "react";

interface UrlPatternInputProps {
  value: UrlPattern;
  onChange: (pattern: UrlPattern) => void;
  label?: string;
}

const PATTERN_TYPES: { value: UrlPattern["type"]; label: string }[] = [
  { value: "exact", label: "Exact domain" },
  { value: "glob", label: "Glob pattern" },
  { value: "regex", label: "Regex" },
  { value: "global", label: "All sites" },
];

export function UrlPatternInput({ value, onChange, label }: UrlPatternInputProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const result = validateUrlPattern(value);
    setError(result.valid ? null : (result.error ?? null));
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      {label ? <label className="text-text-secondary text-xs font-medium">{label}</label> : null}
      <div className="flex gap-1.5">
        <select
          value={value.type}
          onChange={(e) => {
            onChange({ type: e.target.value as UrlPattern["type"], value: value.value });
          }}
          className="border-border bg-bg-tertiary text-text-primary rounded-md border px-2 py-1.5 text-xs outline-none"
        >
          {PATTERN_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {value.type !== "global" ? (
          <input
            type="text"
            value={value.value}
            onChange={(e) => {
              onChange({ type: value.type, value: e.target.value });
            }}
            placeholder={
              value.type === "exact"
                ? "github.com"
                : value.type === "glob"
                  ? "*.github.com/*"
                  : "^https://github\\.com/.*"
            }
            className="border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active min-w-0 flex-1 rounded-md border px-2.5 py-1.5 text-xs outline-none"
          />
        ) : null}
      </div>
      {error ? <p className="text-error text-[10px]">{error}</p> : null}
    </div>
  );
}
