import { memo, useCallback } from "react";
import type { Settings } from "@/shared/types";
import { Input } from "../ui/Input";
import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";

interface QuickTipSettingsProps {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

export const QuickTipSettings = memo(function QuickTipSettings({
  settings,
  updateSettings,
}: QuickTipSettingsProps) {
  const handleEnabled = useCallback(
    (checked: boolean) =>
      void updateSettings({
        quickTip: { ...settings.quickTip, enabled: checked },
      }),
    [updateSettings, settings.quickTip],
  );
  const handleTimeout = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      void updateSettings({
        quickTip: {
          ...settings.quickTip,
          timeoutMs: Number(e.target.value),
        },
      }),
    [updateSettings, settings.quickTip],
  );

  return (
    <SettingsSection title="Quick Tip">
      <SettingsToggleRow
        label="Show Shortcuts on Page Load"
        checked={settings.quickTip.enabled}
        onChange={handleEnabled}
      />
      <Input
        label="Display Timeout (ms)"
        type="number"
        value={settings.quickTip.timeoutMs}
        onChange={handleTimeout}
      />
      <p className="text-text-muted text-[10px]">
        Briefly shows active keyboard shortcuts when you navigate to a page. Set to 0 to disable auto-dismiss.
      </p>
    </SettingsSection>
  );
});
