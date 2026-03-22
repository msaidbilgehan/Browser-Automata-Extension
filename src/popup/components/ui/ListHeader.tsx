import { memo } from "react";
import type { ReactNode } from "react";

interface ListHeaderProps {
  title: string;
  /** Extra elements (buttons, export/import) rendered on the right */
  actions?: ReactNode;
}

/**
 * Consistent header for list views with title and action buttons.
 */
export const ListHeader = memo(function ListHeader({
  title,
  actions,
}: ListHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-text-primary text-sm font-semibold">{title}</h2>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
});
