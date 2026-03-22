import { memo, useCallback } from "react";
import type { Settings } from "@/shared/types";
import { Select } from "../ui/Select";
import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";

interface GeneralSettingsProps {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

export const GeneralSettings = memo(function GeneralSettings({
  settings,
  updateSettings,
}: GeneralSettingsProps) {
  const handleGlobalEnabled = useCallback(
    (checked: boolean) => void updateSettings({ globalEnabled: checked }),
    [updateSettings],
  );
  const handleTheme = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      void updateSettings({ ui: { ...settings.ui, theme: e.target.value as "system" | "light" | "dark" } }),
    [updateSettings, settings.ui],
  );
  const handleIconColor = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      void updateSettings({ ui: { ...settings.ui, iconColor: e.target.value as "dark" | "white" | "system" } }),
    [updateSettings, settings.ui],
  );
  const handleIconTransparent = useCallback(
    (checked: boolean) =>
      void updateSettings({ ui: { ...settings.ui, iconTransparent: checked } }),
    [updateSettings, settings.ui],
  );
  const handleConfirmBeforeRun = useCallback(
    (checked: boolean) =>
      void updateSettings({ ui: { ...settings.ui, confirmBeforeRun: checked } }),
    [updateSettings, settings.ui],
  );
  const handleViewMode = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      void updateSettings({ ui: { ...settings.ui, viewMode: e.target.value as "basic" | "advanced" } }),
    [updateSettings, settings.ui],
  );

  return (
    <SettingsSection title="General">
      <SettingsToggleRow
        label="Global Enable"
        checked={settings.globalEnabled}
        onChange={handleGlobalEnabled}
      />
      <Select
        label="Theme"
        value={settings.ui.theme}
        onChange={handleTheme}
        options={[
          { value: "dark", label: "Dark" },
          { value: "light", label: "Light" },
          { value: "system", label: "System" },
        ]}
      />
      <Select
        label="Icon Color"
        value={settings.ui.iconColor}
        onChange={handleIconColor}
        options={[
          { value: "system", label: "System (follow theme)" },
          { value: "dark", label: "Dark" },
          { value: "white", label: "White" },
        ]}
      />
      <SettingsToggleRow
        label="Transparent Icon"
        checked={settings.ui.iconTransparent}
        onChange={handleIconTransparent}
      />
      <SettingsToggleRow
        label="Confirm Before Run"
        checked={settings.ui.confirmBeforeRun}
        onChange={handleConfirmBeforeRun}
      />
      <Select
        label="View Mode"
        value={settings.ui.viewMode}
        onChange={handleViewMode}
        options={[
          { value: "basic", label: "Basic" },
          { value: "advanced", label: "Advanced" },
        ]}
      />
    </SettingsSection>
  );
});
