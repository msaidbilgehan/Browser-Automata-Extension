import { lazy, Suspense } from "react";
import { useInitialize } from "./hooks/use-initialize";
import { useTheme } from "./hooks/use-theme";
import { useAppStore } from "./stores/app-store";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { FlowsView } from "./components/views/FlowsView";
import { LogView } from "./components/views/LogView";
import { SettingsView } from "./components/views/SettingsView";
import { ProfilesView } from "./components/views/ProfilesView";
import { TemplatesView } from "./components/views/TemplatesView";
import { ImportExportView } from "./components/views/ImportExportView";
import { HealthView } from "./components/views/HealthView";
import { DomainsView } from "./components/views/DomainsView";
import type { TabId } from "./stores/app-store";

// Lazy-load CodeMirror-heavy views to reduce initial popup chunk size
const ScriptsView = lazy(() =>
  import("./components/views/ScriptsView").then((m) => ({ default: m.ScriptsView })),
);
const ShortcutsView = lazy(() =>
  import("./components/views/ShortcutsView").then((m) => ({ default: m.ShortcutsView })),
);
const CSSRulesView = lazy(() =>
  import("./components/views/CSSRulesView").then((m) => ({ default: m.CSSRulesView })),
);
const NetworkRulesView = lazy(() =>
  import("./components/views/NetworkRulesView").then((m) => ({
    default: m.NetworkRulesView,
  })),
);
const ExtractionView = lazy(() =>
  import("./components/views/ExtractionView").then((m) => ({ default: m.ExtractionView })),
);

function ActiveView({ tab }: { tab: TabId }) {
  switch (tab) {
    case "scripts":
      return <ScriptsView />;
    case "shortcuts":
      return <ShortcutsView />;
    case "flows":
      return <FlowsView />;
    case "log":
      return <LogView />;
    case "settings":
      return <SettingsView />;
    case "css-rules":
      return <CSSRulesView />;
    case "network-rules":
      return <NetworkRulesView />;
    case "extraction":
      return <ExtractionView />;
    case "domains":
      return <DomainsView />;
    case "profiles":
      return <ProfilesView />;
    case "templates":
      return <TemplatesView />;
    case "import-export":
      return <ImportExportView />;
    case "health":
      return <HealthView />;
  }
}

export function App() {
  useInitialize();
  useTheme();

  const activeTab = useAppStore((s) => s.activeTab);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);

  if (!initialized && loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <p className="text-text-muted text-xs">Loading...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-4">
              <p className="text-text-muted text-xs">Loading...</p>
            </div>
          }
        >
          <ActiveView tab={activeTab} />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
