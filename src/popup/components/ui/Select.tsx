import { memo } from "react";
import type { SelectHTMLAttributes } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
}

export const Select = memo(function Select({ label, id, options, className = "", ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={selectId} className="text-text-secondary text-xs font-medium">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={`border-border bg-bg-tertiary text-text-primary focus:border-border-active focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-active rounded-md border px-2.5 py-1.5 text-xs transition-colors outline-none ${className} `}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
});
