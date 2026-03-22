import { lazy, Suspense } from "react";
import type { TabId } from "../stores/app-store";

// Eager-loaded views (small bundle size)
import { FlowsView } from "./views/FlowsView";
import { LogView } from "./views/LogView";
import { SettingsView } from "./views/SettingsView";
import { ProfilesView } from "./views/ProfilesView";
import { TemplatesView } from "./views/TemplatesView";
import { ImportExportView } from "./views/ImportExportView";
import { HealthView } from "./views/HealthView";
import { DomainsView } from "./views/DomainsView";
import { QuickRunView } from "./views/QuickRunView";

// Lazy-load CodeMirror-heavy views to reduce initial chunk size
const ScriptsView = lazy(() =>
  import("./views/ScriptsView").then((m) => ({ default: m.ScriptsView })),
);
const ShortcutsView = lazy(() =>
  import("./views/ShortcutsView").then((m) => ({ default: m.ShortcutsView })),
);
const CSSRulesView = lazy(() =>
  import("./views/CSSRulesView").then((m) => ({ default: m.CSSRulesView })),
);
const NetworkRulesView = lazy(() =>
  import("./views/NetworkRulesView").then((m) => ({
    default: m.NetworkRulesView,
  })),
);
const ExtractionView = lazy(() =>
  import("./views/ExtractionView").then((m) => ({ default: m.ExtractionView })),
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
    case "quick-run":
      return <QuickRunView />;
  }
}

const SUSPENSE_FALLBACK = (
  <div className="flex items-center justify-center p-4">
    <p className="text-text-muted text-xs">Loading...</p>
  </div>
);

interface ViewRouterProps {
  activeTab: TabId;
}

export function ViewRouter({ activeTab }: ViewRouterProps) {
  return (
    <Suspense fallback={SUSPENSE_FALLBACK}>
      <ActiveView tab={activeTab} />
    </Suspense>
  );
}
