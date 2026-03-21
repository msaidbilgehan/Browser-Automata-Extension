import { ArrowUp, ArrowDown, X, Plus } from "lucide-react";
import { SelectorInput } from "./SelectorInput";

interface SelectorSourceListProps {
  /** The primary selector (first source) */
  selector: string;
  /** Additional fallback selectors in priority order */
  fallbackSelectors: string[];
  /** Called with the new primary selector and fallback list */
  onChange: (selector: string, fallbackSelectors: string[]) => void;
  /** Stable pick ID prefix for element picker integration */
  pickIdPrefix: string;
  /** Called before element picker activates (persist draft) */
  onPickStart?: (() => void) | undefined;
}

/**
 * Renders an ordered list of CSS selector sources.
 * The first non-empty match at extraction time wins.
 * Sources can be reordered, added, and removed.
 */
export function SelectorSourceList({
  selector,
  fallbackSelectors,
  onChange,
  pickIdPrefix,
  onPickStart,
}: SelectorSourceListProps) {
  // Build a flat ordered array for display
  const allSelectors = [selector, ...fallbackSelectors];
  const hasMultiple = allSelectors.length > 1;

  const updateAll = (next: string[]) => {
    const [primary, ...rest] = next;
    onChange(primary ?? "", rest);
  };

  const updateAt = (index: number, value: string) => {
    const next = [...allSelectors];
    next[index] = value;
    updateAll(next);
  };

  const addSource = () => {
    updateAll([...allSelectors, ""]);
  };

  const removeAt = (index: number) => {
    if (allSelectors.length <= 1) return;
    const next = allSelectors.filter((_, i) => i !== index);
    updateAll(next);
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...allSelectors];
    const temp = next[index - 1]!;
    next[index - 1] = next[index]!;
    next[index] = temp;
    updateAll(next);
  };

  const moveDown = (index: number) => {
    if (index >= allSelectors.length - 1) return;
    const next = [...allSelectors];
    const temp = next[index + 1]!;
    next[index + 1] = next[index]!;
    next[index] = temp;
    updateAll(next);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs font-medium">
          Selector{hasMultiple ? "s" : ""}
          {hasMultiple && (
            <span className="text-text-muted font-normal"> (first match wins)</span>
          )}
        </span>
        <button
          type="button"
          onClick={addSource}
          className="text-active hover:bg-bg-tertiary rounded px-1.5 py-0.5 text-[10px]"
        >
          <Plus size={10} className="mr-0.5 inline" />
          Source
        </button>
      </div>
      {allSelectors.map((sel, i) => (
        <div key={i} className="flex items-center gap-0.5">
          {hasMultiple && (
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => { moveUp(i); }}
                disabled={i === 0}
                className="text-text-muted hover:text-text-primary disabled:opacity-20 rounded p-0.5"
                aria-label="Move up"
              >
                <ArrowUp size={9} />
              </button>
              <button
                type="button"
                onClick={() => { moveDown(i); }}
                disabled={i === allSelectors.length - 1}
                className="text-text-muted hover:text-text-primary disabled:opacity-20 rounded p-0.5"
                aria-label="Move down"
              >
                <ArrowDown size={9} />
              </button>
            </div>
          )}
          {hasMultiple && (
            <span className="text-text-muted w-3 shrink-0 text-center font-mono text-[9px]">
              {String(i + 1)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <SelectorInput
              pickId={`${pickIdPrefix}-src-${String(i)}`}
              value={sel}
              onChange={(value) => { updateAt(i, value); }}
              onPickStart={onPickStart}
              label=""
              compact
              placeholder={i === 0 ? "CSS selector (primary)" : `Fallback #${String(i)}`}
            />
          </div>
          {hasMultiple && (
            <button
              type="button"
              onClick={() => { removeAt(i); }}
              className="text-text-muted hover:text-error shrink-0 rounded p-0.5"
              aria-label="Remove source"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
