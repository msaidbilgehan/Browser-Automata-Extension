import { useState, useEffect, useMemo } from "react";
import type { EntityId, ExtractionRule } from "@/shared/types/entities";
import { localStore } from "@/shared/storage";

export function ExtractionRuleSelect({
  value,
  onChange,
}: {
  value: EntityId;
  onChange: (id: EntityId) => void;
}) {
  const [rules, setRules] = useState<ExtractionRule[]>([]);

  useEffect(() => {
    void localStore.get("extractionRules").then((data) => {
      const map = data ?? {};
      setRules(
        Object.values(map)
          .filter((r): r is ExtractionRule => typeof r.name === "string")
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    });
  }, []);

  const selected = useMemo(() => rules.find((r) => r.id === value), [rules, value]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-secondary text-xs font-medium">Extraction Rule</span>
      {rules.length === 0 ? (
        <p className="text-text-muted text-[10px]">
          No extraction rules found. Create one in the Extraction Rules tab first.
        </p>
      ) : (
        <>
          <select
            value={value}
            onChange={(e) => { onChange(e.target.value as EntityId); }}
            className="border-border bg-bg-primary text-text-primary focus:border-border-active rounded-md border px-2 py-1.5 text-xs outline-none"
          >
            <option value="">Select a rule...</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name || "Untitled"} ({String(r.fields.length)} field{r.fields.length !== 1 ? "s" : ""}, {r.outputFormat})
              </option>
            ))}
          </select>
          {selected && (
            <div className="text-text-muted flex flex-wrap gap-1 text-[9px]">
              <span>Format: {selected.outputFormat.toUpperCase()}</span>
              <span>·</span>
              <span>Fields: {selected.fields.map((f) => f.name || "?").join(", ")}</span>
              {selected.outputActions.length > 0 && (
                <>
                  <span>·</span>
                  <span>Actions: {selected.outputActions.join(", ")}</span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
