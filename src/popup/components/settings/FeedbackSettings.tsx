import { memo, useCallback } from "react";
import type { Settings } from "@/shared/types";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";

interface FeedbackSettingsProps {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

export const FeedbackSettings = memo(function FeedbackSettings({
  settings,
  updateSettings,
}: FeedbackSettingsProps) {
  const handleToastEnabled = useCallback(
    (checked: boolean) =>
      void updateSettings({
        feedback: { ...settings.feedback, toastEnabled: checked },
      }),
    [updateSettings, settings.feedback],
  );
  const handleToastDismissMode = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      void updateSettings({
        feedback: {
          ...settings.feedback,
          toastDismissMode: e.target.value as "delay" | "key_release",
        },
      }),
    [updateSettings, settings.feedback],
  );
  const handleToastDuration = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      void updateSettings({
        feedback: {
          ...settings.feedback,
          toastDurationMs: Number(e.target.value),
        },
      }),
    [updateSettings, settings.feedback],
  );
  const handleHighlightEnabled = useCallback(
    (checked: boolean) =>
      void updateSettings({
        feedback: { ...settings.feedback, highlightEnabled: checked },
      }),
    [updateSettings, settings.feedback],
  );

  return (
    <SettingsSection title="Feedback">
      <SettingsToggleRow
        label="Show Toast on Shortcut"
        checked={settings.feedback.toastEnabled}
        onChange={handleToastEnabled}
      />
      <Select
        label="Toast Dismiss Mode"
        value={settings.feedback.toastDismissMode}
        onChange={handleToastDismissMode}
        options={[
          { value: "key_release", label: "Until Key Release" },
          { value: "delay", label: "After Delay" },
        ]}
      />
      {settings.feedback.toastDismissMode === "delay" ? (
        <Input
          label="Toast Duration (ms)"
          type="number"
          value={settings.feedback.toastDurationMs}
          onChange={handleToastDuration}
        />
      ) : null}
      <SettingsToggleRow
        label="Highlight Target Element"
        checked={settings.feedback.highlightEnabled}
        onChange={handleHighlightEnabled}
      />
    </SettingsSection>
  );
});
