import { memo, useCallback } from "react";
import type { Settings } from "@/shared/types";
import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";

interface NotificationSettingsProps {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

export const NotificationSettings = memo(function NotificationSettings({
  settings,
  updateSettings,
}: NotificationSettingsProps) {
  const handleEnabled = useCallback(
    (checked: boolean) =>
      void updateSettings({
        notifications: { ...settings.notifications, enabled: checked },
      }),
    [updateSettings, settings.notifications],
  );

  return (
    <SettingsSection title="Notifications">
      <SettingsToggleRow
        label="Enable Chrome Notifications"
        checked={settings.notifications.enabled}
        onChange={handleEnabled}
      />
      {!settings.notifications.enabled && (
        <p className="text-text-muted text-[10px] leading-tight">
          When off, no desktop notifications are sent — even for scripts or flows with notifications enabled.
        </p>
      )}
    </SettingsSection>
  );
});
