import { memo, useCallback } from "react";
import type { Settings } from "@/shared/types";
import type { QuickRunBarPosition } from "@/shared/types/settings";
import { Select } from "../ui/Select";
import { KeyCaptureInput, formatKeyCombo } from "../editor/KeyCaptureInput";
import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";
import type { KeyCombo } from "@/shared/types/entities";

interface QuickRunSettingsProps {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

export const QuickRunSettings = memo(function QuickRunSettings({
  settings,
  updateSettings,
}: QuickRunSettingsProps) {
  const handleBarEnabled = useCallback(
    (checked: boolean) =>
      void updateSettings({
        quickRun: { ...settings.quickRun, barEnabled: checked },
      }),
    [updateSettings, settings.quickRun],
  );
  const handleToggleShortcut = useCallback(
    (combo: KeyCombo) =>
      void updateSettings({
        quickRun: { ...settings.quickRun, toggleShortcut: combo },
      }),
    [updateSettings, settings.quickRun],
  );
  const handleBarPosition = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      void updateSettings({
        quickRun: {
          ...settings.quickRun,
          barPosition: e.target.value as QuickRunBarPosition,
        },
      }),
    [updateSettings, settings.quickRun],
  );
  const handleShowInPopup = useCallback(
    (checked: boolean) =>
      void updateSettings({
        quickRun: { ...settings.quickRun, showInPopup: checked },
      }),
    [updateSettings, settings.quickRun],
  );

  return (
    <SettingsSection title="Quick Run Bar">
      <SettingsToggleRow
        label="Show In-Page Bar"
        checked={settings.quickRun.barEnabled}
        onChange={handleBarEnabled}
      />
      <KeyCaptureInput
        label="Toggle Shortcut"
        value={settings.quickRun.toggleShortcut}
        onChange={handleToggleShortcut}
      />
      {settings.quickRun.toggleShortcut ? (
        <p className="text-text-muted text-[10px]">
          Press {formatKeyCombo(settings.quickRun.toggleShortcut)} on any page to toggle the bar.
        </p>
      ) : null}
      <Select
        label="Bar Position"
        value={settings.quickRun.barPosition}
        onChange={handleBarPosition}
        options={[
          { value: "top-right", label: "Top Right" },
          { value: "top-left", label: "Top Left" },
          { value: "bottom-right", label: "Bottom Right" },
          { value: "bottom-left", label: "Bottom Left" },
        ]}
      />
      <SettingsToggleRow
        label="Show In Popup"
        checked={settings.quickRun.showInPopup}
        onChange={handleShowInPopup}
      />
    </SettingsSection>
  );
});
