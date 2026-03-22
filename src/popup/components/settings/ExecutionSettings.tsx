import { memo, useCallback } from "react";
import type { Settings } from "@/shared/types";
import { Input } from "../ui/Input";
import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";

interface ExecutionSettingsProps {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

export const ExecutionSettings = memo(function ExecutionSettings({
  settings,
  updateSettings,
}: ExecutionSettingsProps) {
  const handleTimeout = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      void updateSettings({
        execution: { ...settings.execution, scriptTimeoutMs: Number(e.target.value) },
      }),
    [updateSettings, settings.execution],
  );
  const handleIframes = useCallback(
    (checked: boolean) =>
      void updateSettings({
        execution: { ...settings.execution, injectIntoIframes: checked },
      }),
    [updateSettings, settings.execution],
  );

  return (
    <SettingsSection title="Execution">
      <Input
        label="Timeout (ms)"
        type="number"
        value={settings.execution.scriptTimeoutMs}
        onChange={handleTimeout}
      />
      <SettingsToggleRow
        label="Inject in iframes"
        checked={settings.execution.injectIntoIframes}
        onChange={handleIframes}
      />
    </SettingsSection>
  );
});
