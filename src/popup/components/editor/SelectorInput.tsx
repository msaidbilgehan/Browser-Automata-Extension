import { useState, useEffect, useCallback, useRef } from "react";
import { Crosshair, ChevronDown, Eye, EyeOff } from "lucide-react";
import { sendToBackground } from "@/shared/messaging";
import type { SelectorAlternative } from "@/shared/types/entities";
import { SelectorAlternativesPopover } from "./SelectorAlternativesPopover";

interface PickedElementData {
  pickId: string;
  selector: string;
  alternatives?: SelectorAlternative[];
}

interface SelectorInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Stable identifier so the pick result routes back to this field */
  pickId: string;
  label?: string;
  placeholder?: string;
  /** Called just before the element picker is activated. Use this to persist
   *  editor draft state so it survives the popup closing.
   *  May return a Promise — the picker will wait for it to settle. */
  onPickStart?: (() => void | Promise<void>) | undefined;
  /** Compact layout for inline field rows (e.g. ExtractionView) */
  compact?: boolean;
}

/**
 * CSS selector input with visual element picker and selector alternatives.
 *
 * Clicking the crosshair button activates an adblock-style element picker on
 * the active tab. Because the popup closes when the user switches to the page,
 * the result is relayed through `chrome.storage.session`:
 *
 *   Popup → SW (PICK_ELEMENT_POPUP) → Content (PICK_ELEMENT) → user picks →
 *   Content (ELEMENT_PICKED) → SW writes session._pickedElement → Popup reads on reopen
 *
 * After picking, selector alternatives are available in a popover dropdown,
 * letting the user choose between different selector strategies (ID, class,
 * XPath, etc.).
 */
export function SelectorInput({
  value,
  onChange,
  pickId,
  label = "CSS Selector",
  placeholder = "#my-element, .my-class",
  onPickStart,
  compact = false,
}: SelectorInputProps) {
  const [picking, setPicking] = useState(false);
  const [alternatives, setAlternatives] = useState<SelectorAlternative[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const [testing, setTesting] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Holds the most recently picked selector so we can re-apply it if
  // useEditorDraft hydration overwrites the value after we first set it.
  const pendingPickRef = useRef<PickedElementData | null>(null);

  /** Process a picked element result */
  const handlePickResult = useCallback(
    (picked: PickedElementData) => {
      pendingPickRef.current = picked;
      onChange(picked.selector);
      setAlternatives(picked.alternatives ?? []);
      setPicking(false);
    },
    [onChange],
  );

  // On mount (popup reopen), check if there's a pending pick result for this field
  useEffect(() => {
    void chrome.storage.session.get("_pickedElement").then((result: Record<string, unknown>) => {
      const picked = result["_pickedElement"] as PickedElementData | undefined;
      if (picked?.pickId === pickId) {
        handlePickResult(picked);
        void chrome.storage.session.remove("_pickedElement");
      }
    });
  }, [pickId, handlePickResult]);

  // Guard against draft-hydration overwriting the picked value.
  // useEditorDraft restores the draft asynchronously, which can overwrite the
  // selector we just set from the pick result. When that happens, re-apply
  // the pending pick so the new value sticks.
  useEffect(() => {
    const pending = pendingPickRef.current;
    if (pending === null) return;
    if (value !== pending.selector) {
      onChange(pending.selector);
    } else {
      // Value matches — pick was successfully applied, clear the pending ref
      pendingPickRef.current = null;
    }
  }, [value, onChange]);

  // Listen for storage changes while the popup is open (covers the edge case
  // where the user picks without the popup closing, e.g. on a secondary monitor)
  useEffect(() => {
    function listener(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) {
      if (areaName !== "session" || !("_pickedElement" in changes)) return;
      const picked = changes["_pickedElement"].newValue as PickedElementData | undefined;
      if (picked?.pickId === pickId) {
        handlePickResult(picked);
        void chrome.storage.session.remove("_pickedElement");
      }
    }
    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [pickId, handlePickResult]);

  /** Send selector to the active tab for live highlighting */
  const testSelector = useCallback(
    (selector: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!selector.trim()) {
          setMatchCount(0);
          void sendToBackground({ type: "CLEAR_TEST_HIGHLIGHT_POPUP" });
          return;
        }
        void sendToBackground({ type: "TEST_SELECTOR_POPUP", selector }).then(
          (res) => {
            setMatchCount(res.matchCount);
          },
          () => {
            setMatchCount(null);
          },
        );
      }, 250);
    },
    [],
  );

  /** Toggle live testing mode on/off */
  const toggleTesting = useCallback(() => {
    setTesting((prev) => {
      const next = !prev;
      if (next) {
        // Activate: immediately test the current value
        testSelector(value);
      } else {
        // Deactivate: clear highlights on the page
        setMatchCount(null);
        void sendToBackground({ type: "CLEAR_TEST_HIGHLIGHT_POPUP" });
      }
      return next;
    });
  }, [value, testSelector]);

  // Re-test whenever the selector value changes while testing is active
  useEffect(() => {
    if (testing) {
      testSelector(value);
    }
  }, [value, testing, testSelector]);

  // Clean up highlights when the component unmounts (popup closes)
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void sendToBackground({ type: "CLEAR_TEST_HIGHLIGHT_POPUP" }).catch(() => {
        // Popup closing — service worker may not respond
      });
    };
  }, []);

  const handlePick = useCallback(async () => {
    if (picking) return;
    // Await the draft save so it completes before the popup can close.
    if (onPickStart) {
      await onPickStart();
    }
    setPicking(true);
    try {
      await sendToBackground({ type: "PICK_ELEMENT_POPUP", pickId });
    } catch {
      setPicking(false);
    }
  }, [picking, pickId, onPickStart]);

  const inputClass = compact
    ? "border-border bg-bg-primary text-text-primary placeholder-text-muted focus:border-border-active min-w-0 flex-1 rounded-md border px-2 py-1 font-mono text-[10px] outline-none"
    : "border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active min-w-0 flex-1 rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors outline-none";

  const buttonClass = compact
    ? "flex shrink-0 items-center justify-center rounded-md border p-0.5 transition-colors"
    : "flex shrink-0 items-center justify-center rounded-md border p-1.5 transition-colors";

  const iconSize = compact ? 12 : 14;

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label className="text-text-secondary text-xs font-medium">{label}</label>
      ) : null}
      <div className="relative flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={toggleTesting}
          title={testing ? "Stop live testing" : "Live-test selector on page"}
          aria-label={testing ? "Stop live testing" : "Live-test selector on page"}
          className={`${buttonClass} ${
            testing
              ? "border-amber-500 bg-amber-500/10 text-amber-500"
              : "border-border bg-bg-tertiary text-text-muted hover:border-amber-500 hover:text-amber-500"
          }`}
        >
          {testing ? <EyeOff size={iconSize} /> : <Eye size={iconSize} />}
        </button>
        {testing && matchCount !== null ? (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
              matchCount === 0
                ? "bg-rose-500/15 text-rose-400"
                : matchCount === 1
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
            }`}
            title={`${String(matchCount)} element${matchCount === 1 ? "" : "s"} matched`}
          >
            {matchCount}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void handlePick()}
          disabled={picking}
          title="Pick element from page"
          aria-label="Pick element from page"
          className={`${buttonClass} ${
            picking
              ? "border-active bg-active/10 text-active cursor-wait"
              : "border-border bg-bg-tertiary text-text-muted hover:border-active hover:text-active"
          }`}
        >
          <Crosshair size={iconSize} />
        </button>
        {alternatives.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setShowPopover((prev) => !prev);
            }}
            title="Show selector alternatives"
            aria-label="Show selector alternatives"
            className={`${buttonClass} border-border bg-bg-tertiary text-text-muted hover:border-active hover:text-active`}
          >
            <ChevronDown size={iconSize} />
          </button>
        ) : null}
        {showPopover && alternatives.length > 0 ? (
          <SelectorAlternativesPopover
            alternatives={alternatives}
            currentSelector={value}
            onSelect={(sel) => {
              onChange(sel);
              setShowPopover(false);
            }}
            onClose={() => {
              setShowPopover(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
