import { useInitialize } from "./hooks/use-initialize";
import { useTheme } from "./hooks/use-theme";
import { useAppStore } from "./stores/app-store";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { ViewRouter } from "./components/ViewRouter";
import { QuickRunBar } from "./components/QuickRunBar";

export function App() {
  useInitialize();
  useTheme();

  const activeTab = useAppStore((s) => s.activeTab);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const showQuickRunInPopup = useAppStore((s) => s.settings.quickRun.showInPopup);

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
        <ViewRouter activeTab={activeTab} />
      </main>
      {showQuickRunInPopup ? <QuickRunBar /> : null}
      <TabBar />
    </div>
  );
}
