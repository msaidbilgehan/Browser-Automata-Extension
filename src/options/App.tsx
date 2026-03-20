import {
  FileCode,
  Keyboard,
  GitBranch,
  Paintbrush,
  Shield,
  TableProperties,
  Globe,
  LayoutTemplate,
  Users,
  ScrollText,
  ArrowUpDown,
  Activity,
  Settings,
} from "lucide-react";
import { useInitialize } from "@/popup/hooks/use-initialize";
import { useTheme } from "@/popup/hooks/use-theme";
import { useAppStore } from "@/popup/stores/app-store";
import type { TabId } from "@/popup/stores/app-store";
import { ScriptsView } from "@/popup/components/views/ScriptsView";
import { ShortcutsView } from "@/popup/components/views/ShortcutsView";
import { FlowsView } from "@/popup/components/views/FlowsView";
import { CSSRulesView } from "@/popup/components/views/CSSRulesView";
import { NetworkRulesView } from "@/popup/components/views/NetworkRulesView";
import { ExtractionView } from "@/popup/components/views/ExtractionView";
import { DomainsView } from "@/popup/components/views/DomainsView";
import { TemplatesView } from "@/popup/components/views/TemplatesView";
import { ProfilesView } from "@/popup/components/views/ProfilesView";
import { LogView } from "@/popup/components/views/LogView";
import { ImportExportView } from "@/popup/components/views/ImportExportView";
import { HealthView } from "@/popup/components/views/HealthView";
import { SettingsView } from "@/popup/components/views/SettingsView";

interface SidebarItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "scripts", label: "Scripts", icon: <FileCode size={18} /> },
  { id: "shortcuts", label: "Shortcuts", icon: <Keyboard size={18} /> },
  { id: "flows", label: "Flows", icon: <GitBranch size={18} /> },
  { id: "css-rules", label: "CSS Rules", icon: <Paintbrush size={18} /> },
  { id: "network-rules", label: "Network", icon: <Shield size={18} /> },
  { id: "extraction", label: "Extract", icon: <TableProperties size={18} /> },
  { id: "domains", label: "Domains", icon: <Globe size={18} /> },
  { id: "templates", label: "Templates", icon: <LayoutTemplate size={18} /> },
  { id: "profiles", label: "Profiles", icon: <Users size={18} /> },
  { id: "log", label: "Log", icon: <ScrollText size={18} /> },
  { id: "import-export", label: "Import/Export", icon: <ArrowUpDown size={18} /> },
  { id: "health", label: "Health", icon: <Activity size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

function ActiveView({ tab }: { tab: TabId }) {
  switch (tab) {
    case "scripts":
      return <ScriptsView />;
    case "shortcuts":
      return <ShortcutsView />;
    case "flows":
      return <FlowsView />;
    case "css-rules":
      return <CSSRulesView />;
    case "network-rules":
      return <NetworkRulesView />;
    case "extraction":
      return <ExtractionView />;
    case "domains":
      return <DomainsView />;
    case "templates":
      return <TemplatesView />;
    case "profiles":
      return <ProfilesView />;
    case "log":
      return <LogView />;
    case "import-export":
      return <ImportExportView />;
    case "health":
      return <HealthView />;
    case "settings":
      return <SettingsView />;
  }
}

export function App() {
  useInitialize();
  useTheme();

  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const globalEnabled = useAppStore((s) => s.settings.globalEnabled);
  const toggleGlobalEnabled = useAppStore((s) => s.toggleGlobalEnabled);

  if (!initialized && loading) {
    return (
      <div className="bg-bg-primary flex min-h-screen items-center justify-center">
        <p className="text-text-muted text-xs">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-primary text-text-primary flex min-h-screen">
      <aside className="border-border bg-bg-secondary flex w-56 shrink-0 flex-col border-r">
        <div className="border-border flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <div className="bg-active h-6 w-6 rounded" />
            <span className="text-text-primary text-sm font-semibold">Browser Automata</span>
          </div>
          <button
            type="button"
            onClick={() => void toggleGlobalEnabled()}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              globalEnabled ? "bg-active" : "bg-bg-tertiary"
            }`}
            aria-label={globalEnabled ? "Disable extension" : "Enable extension"}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                globalEnabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
              }}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                activeTab === item.id
                  ? "bg-bg-tertiary text-active"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
              aria-current={activeTab === item.id ? "page" : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl">
            <ActiveView tab={activeTab} />
          </div>
        </main>
      </div>
    </div>
  );
}
