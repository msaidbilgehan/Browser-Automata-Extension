import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-active text-bg-primary hover:bg-active-dim",
  secondary: "bg-bg-tertiary text-text-primary hover:bg-bg-hover",
  danger: "bg-error-dim text-white hover:bg-error",
  ghost: "bg-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
};

export function Button({
  variant = "secondary",
  size = "sm",
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";

  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 ${sizeClass} ${VARIANT_CLASSES[variant]} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className} `}
      {...props}
    >
      {children}
    </button>
  );
}
