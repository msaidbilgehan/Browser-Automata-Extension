import { memo } from "react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
}

/**
 * Consistent empty state display for list views.
 */
export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center" role="status">
      <div className="text-text-muted">{icon}</div>
      <p className="text-text-muted text-xs">{title}</p>
      {description && (
        <p className="text-text-muted text-[10px]">{description}</p>
      )}
    </div>
  );
});
