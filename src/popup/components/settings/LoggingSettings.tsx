import { memo, useCallback } from "react";
import type { Settings } from "@/shared/types";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { SettingsSection } from "./SettingsSection";

interface LoggingSettingsProps {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

export const LoggingSettings = memo(function LoggingSettings({
  settings,
  updateSettings,
}: LoggingSettingsProps) {
  const handleLevel = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      void updateSettings({
        logging: {
          ...settings.logging,
          level: e.target.value as "debug" | "info" | "warn" | "error" | "off",
        },
      }),
    [updateSettings, settings.logging],
  );
  const handleMaxEntries = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      void updateSettings({
        logging: { ...settings.logging, maxEntries: Number(e.target.value) },
      }),
    [updateSettings, settings.logging],
  );

  return (
    <SettingsSection title="Logging">
      <Select
        label="Level"
        value={settings.logging.level}
        onChange={handleLevel}
        options={[
          { value: "debug", label: "Debug" },
          { value: "info", label: "Info" },
          { value: "warn", label: "Warn" },
          { value: "error", label: "Error" },
          { value: "off", label: "Off" },
        ]}
      />
      <Input
        label="Max Entries"
        type="number"
        value={settings.logging.maxEntries}
        onChange={handleMaxEntries}
      />
    </SettingsSection>
  );
});
