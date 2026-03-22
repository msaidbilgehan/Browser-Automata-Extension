import { memo } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}

export const Toggle = memo(function Toggle({ checked, onChange, label, size = "md", disabled = false }: ToggleProps) {
  const trackSize = size === "sm" ? "h-4 w-7" : "h-5 w-9";
  const thumbSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const thumbTranslate = size === "sm" ? "translate-x-3" : "translate-x-4";

  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className={`relative inline-flex shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active ${trackSize} ${checked ? "bg-active" : "bg-bg-tertiary"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} `}
      >
        <span
          className={`inline-block rounded-full bg-white shadow transition-transform duration-200 ${thumbSize} ${checked ? thumbTranslate : "translate-x-0.5"} mt-0.5`}
        />
      </button>
      {label ? <span className="text-text-secondary text-xs">{label}</span> : null}
    </label>
  );
});
