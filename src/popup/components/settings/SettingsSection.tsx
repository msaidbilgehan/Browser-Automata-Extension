import { memo } from "react";
import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * Section wrapper for settings groups with consistent heading style.
 */
export const SettingsSection = memo(function SettingsSection({
  title,
  children,
}: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby={`settings-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <h3
        id={`settings-${title.toLowerCase().replace(/\s+/g, "-")}`}
        className="text-text-muted text-xs font-medium tracking-wider uppercase"
      >
        {title}
      </h3>
      {children}
    </section>
  );
});
