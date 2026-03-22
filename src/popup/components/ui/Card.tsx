import { memo } from "react";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const Card = memo(function Card({ children, onClick, className = "", disabled = false }: CardProps) {
  const interactive = onClick !== undefined;

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive && !disabled ? onClick : undefined}
      onKeyDown={
        interactive && !disabled
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`border-border bg-bg-secondary rounded-lg border p-3 ${interactive ? "hover:border-border-active focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-active cursor-pointer transition-colors" : ""} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className} `}
    >
      {children}
    </div>
  );
});
