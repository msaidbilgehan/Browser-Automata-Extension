import { memo } from "react";
import { Toggle } from "../ui/Toggle";

interface SettingsToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * A single row with a label and toggle switch, used throughout the settings view.
 */
export const SettingsToggleRow = memo(function SettingsToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: SettingsToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-secondary text-xs">{label}</span>
      <Toggle
        checked={checked}
        onChange={onChange}
        size="sm"
        disabled={disabled ?? false}
      />
    </div>
  );
});
