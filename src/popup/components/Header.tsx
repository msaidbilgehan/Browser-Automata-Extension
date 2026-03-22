import { Settings } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import { Toggle } from "./ui/Toggle";
import { AppIcon } from "./ui/AppIcon";

export function Header() {
  const globalEnabled = useAppStore((s) => s.settings.globalEnabled);
  const viewMode = useAppStore((s) => s.settings.ui.viewMode);
  const toggleGlobalEnabled = useAppStore((s) => s.toggleGlobalEnabled);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const settings = useAppStore((s) => s.settings);

  const toggleViewMode = () => {
    const next = viewMode === "basic" ? "advanced" : "basic";
    void updateSettings({ ui: { ...settings.ui, viewMode: next } });
  };

  return (
    <header className="border-border flex h-10 shrink-0 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2">
        <AppIcon size={20} className="text-text-primary" />
        <span className="text-text-primary text-sm font-semibold">Browser Automata</span>
      </div>
      <div className="flex items-center gap-2">
        {/* View mode toggle pill */}
        <button
          type="button"
          onClick={toggleViewMode}
          className="border-border bg-bg-secondary hover:bg-bg-tertiary flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors"
          aria-label={`Switch to ${viewMode === "basic" ? "advanced" : "basic"} mode`}
          title={`Switch to ${viewMode === "basic" ? "Advanced" : "Basic"} mode`}
        >
          <span className={viewMode === "basic" ? "text-active" : "text-text-muted"}>Basic</span>
          <span className="text-border mx-1">|</span>
          <span className={viewMode === "advanced" ? "text-active" : "text-text-muted"}>
            Adv
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("settings");
          }}
          className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>
        <Toggle
          checked={globalEnabled}
          onChange={() => void toggleGlobalEnabled()}
          size="sm"
          label="Global toggle"
        />
      </div>
    </header>
  );
}
