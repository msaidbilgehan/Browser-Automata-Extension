import { useState, useCallback } from "react";
import type { KeyCombo } from "@/shared/types/entities";

interface KeyCaptureInputProps {
  value: KeyCombo | null;
  onChange: (combo: KeyCombo) => void;
  label?: string;
}

/** Format a KeyCombo as a human-readable string */
// eslint-disable-next-line react-refresh/only-export-components
export function formatKeyCombo(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.ctrlKey) parts.push("Ctrl");
  if (combo.altKey) parts.push("Alt");
  if (combo.shiftKey) parts.push("Shift");
  if (combo.metaKey) parts.push("Cmd");

  // Normalize key display
  let key = combo.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);

  return parts.join(" + ");
}

export function KeyCaptureInput({ value, onChange, label }: KeyCaptureInputProps) {
  const [capturing, setCapturing] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only presses
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

      const combo: KeyCombo = {
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      };

      onChange(combo);
      setCapturing(false);
    },
    [onChange],
  );

  const displayText = capturing
    ? "Press a key combo..."
    : value
      ? formatKeyCombo(value)
      : "Click to set shortcut";

  return (
    <div className="flex flex-col gap-1">
      {label ? <label className="text-text-secondary text-xs font-medium">{label}</label> : null}
      <button
        type="button"
        onClick={() => {
          setCapturing(true);
        }}
        onKeyDown={capturing ? handleKeyDown : undefined}
        onBlur={() => {
          setCapturing(false);
        }}
        className={`rounded-md border px-2.5 py-1.5 text-left text-xs ${capturing ? "border-border-active bg-bg-primary text-active" : "border-border bg-bg-tertiary text-text-primary"} transition-colors outline-none`}
      >
        {displayText}
      </button>
    </div>
  );
}
