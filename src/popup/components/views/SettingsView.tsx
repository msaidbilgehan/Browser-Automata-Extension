import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { GeneralSettings } from "../settings/GeneralSettings";
import { ExecutionSettings } from "../settings/ExecutionSettings";
import { LoggingSettings } from "../settings/LoggingSettings";
import { FeedbackSettings } from "../settings/FeedbackSettings";
import { QuickRunSettings } from "../settings/QuickRunSettings";
import { QuickTipSettings } from "../settings/QuickTipSettings";
import { NotificationSettings } from "../settings/NotificationSettings";
import { ExportImportSettings } from "../settings/ExportImportSettings";

export function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("scripts");
          }}
          className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors"
          aria-label="Back to scripts"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-text-primary text-sm font-semibold">Settings</h2>
      </div>

      <GeneralSettings settings={settings} updateSettings={updateSettings} />
      <ExecutionSettings settings={settings} updateSettings={updateSettings} />
      <LoggingSettings settings={settings} updateSettings={updateSettings} />
      <FeedbackSettings settings={settings} updateSettings={updateSettings} />
      <QuickRunSettings settings={settings} updateSettings={updateSettings} />
      <QuickTipSettings settings={settings} updateSettings={updateSettings} />
      <NotificationSettings settings={settings} updateSettings={updateSettings} />
      <ExportImportSettings />

      <div className="border-border border-t pt-4">
        <button
          type="button"
          onClick={() => { setActiveTab("privacy-policy"); }}
          className="text-text-muted hover:text-active flex items-center gap-1.5 text-xs transition-colors"
        >
          <ShieldCheck size={14} />
          Privacy Policy
        </button>
      </div>
    </div>
  );
}
