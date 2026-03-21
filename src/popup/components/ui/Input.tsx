import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, className = "", ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-text-secondary text-xs font-medium">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={`border-border bg-bg-tertiary text-text-primary placeholder-text-muted focus:border-border-active focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-active rounded-md border px-2.5 py-1.5 text-xs transition-colors outline-none ${className} `}
        {...props}
      />
    </div>
  );
}
