import { FileCode, Keyboard, GitBranch, ScrollText, MoreHorizontal } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import type { TabId } from "../stores/app-store";
import { useState } from "react";

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const PRIMARY_TABS: TabItem[] = [
  { id: "scripts", label: "Scripts", icon: <FileCode size={16} /> },
  { id: "shortcuts", label: "Keys", icon: <Keyboard size={16} /> },
  { id: "flows", label: "Flows", icon: <GitBranch size={16} /> },
  { id: "log", label: "Log", icon: <ScrollText size={16} /> },
];

const MORE_TABS: TabItem[] = [
  { id: "css-rules", label: "CSS Rules", icon: null },
  { id: "network-rules", label: "Network", icon: null },
  { id: "extraction", label: "Extract", icon: null },
  { id: "domains", label: "Domains", icon: null },
  { id: "profiles", label: "Profiles", icon: null },
  { id: "templates", label: "Templates", icon: null },
  { id: "import-export", label: "Import/Export", icon: null },
  { id: "health", label: "Health", icon: null },
  { id: "settings", label: "Settings", icon: null },
];

export function TabBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav className="border-border relative flex h-11 shrink-0 items-center justify-around border-t">
      {PRIMARY_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => {
            setActiveTab(tab.id);
          }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition-colors ${activeTab === tab.id ? "text-active" : "text-text-muted hover:text-text-secondary"} `}
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}

      {/* More menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setMoreOpen(!moreOpen);
          }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition-colors ${MORE_TABS.some((t) => t.id === activeTab) ? "text-active" : "text-text-muted hover:text-text-secondary"} `}
          aria-label="More options"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal size={16} />
          <span>More</span>
        </button>

        {moreOpen ? (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => {
                setMoreOpen(false);
              }}
            />
            <div className="border-border bg-bg-secondary absolute right-0 bottom-full z-20 mb-1 min-w-[120px] rounded-md border py-1 shadow-lg">
              {MORE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMoreOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${activeTab === tab.id ? "text-active" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"} `}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </nav>
  );
}
