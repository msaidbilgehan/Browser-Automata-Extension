import { Settings } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import { Toggle } from "./ui/Toggle";
import { AppIcon } from "./ui/AppIcon";

export function Header() {
  const globalEnabled = useAppStore((s) => s.settings.globalEnabled);
  const toggleGlobalEnabled = useAppStore((s) => s.toggleGlobalEnabled);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <header className="border-border flex h-10 shrink-0 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2">
        <AppIcon size={20} className="text-text-primary" />
        <span className="text-text-primary text-sm font-semibold">Browser Automata</span>
      </div>
      <div className="flex items-center gap-2">
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
