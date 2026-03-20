import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { SelectorAlternative, SelectorStrategy } from "@/shared/types/entities";

interface SelectorAlternativesPopoverProps {
  alternatives: SelectorAlternative[];
  currentSelector: string;
  onSelect: (selector: string) => void;
  onClose: () => void;
}

const STRATEGY_LABELS: Record<SelectorStrategy, string> = {
  "id": "ID",
  "data-attr": "Data",
  "aria": "Aria",
  "attribute": "Attr",
  "class": "Class",
  "ancestor": "Path",
  "nth-child": "Nth",
  "xpath-text": "XPath",
  "xpath-attr": "XPath",
};

const STRATEGY_COLORS: Record<SelectorStrategy, string> = {
  "id": "bg-emerald-500/20 text-emerald-400",
  "data-attr": "bg-blue-500/20 text-blue-400",
  "aria": "bg-violet-500/20 text-violet-400",
  "attribute": "bg-amber-500/20 text-amber-400",
  "class": "bg-sky-500/20 text-sky-400",
  "ancestor": "bg-slate-500/20 text-slate-400",
  "nth-child": "bg-slate-500/20 text-slate-400",
  "xpath-text": "bg-rose-500/20 text-rose-400",
  "xpath-attr": "bg-rose-500/20 text-rose-400",
};

export function SelectorAlternativesPopover({
  alternatives,
  currentSelector,
  onSelect,
  onClose,
}: SelectorAlternativesPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (alternatives.length === 0) return null;

  return (
    <div
      ref={ref}
      className="border-border bg-bg-secondary absolute top-full right-0 z-50 mt-1 max-h-52 w-full min-w-64 overflow-y-auto rounded-lg border shadow-lg"
    >
      <div className="p-1">
        <p className="text-text-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wider">
          Selector Alternatives
        </p>
        {alternatives.map((alt, i) => {
          const isSelected = alt.selector === currentSelector;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                onSelect(alt.selector);
              }}
              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                isSelected
                  ? "bg-active/10 text-text-primary"
                  : "text-text-secondary hover:bg-bg-tertiary"
              }`}
            >
              {/* Checkmark or spacer */}
              <span className="flex w-3.5 shrink-0 items-center justify-center">
                {isSelected ? <Check size={10} className="text-active" /> : null}
              </span>

              {/* Strategy badge */}
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${STRATEGY_COLORS[alt.strategy]}`}
              >
                {STRATEGY_LABELS[alt.strategy]}
              </span>

              {/* Selector text */}
              <span className="min-w-0 flex-1 truncate font-mono text-[10px]">
                {alt.selector}
              </span>

              {/* Match count */}
              <span
                className={`shrink-0 text-[9px] font-medium ${
                  alt.matchCount === 1
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                {alt.matchCount === 1 ? "1 match" : `${String(alt.matchCount)} matches`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
