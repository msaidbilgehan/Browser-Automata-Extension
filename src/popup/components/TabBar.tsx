import {
  FileCode,
  Keyboard,
  GitBranch,
  ScrollText,
  MoreHorizontal,
  Pickaxe,
} from "lucide-react";
import { useAppStore } from "../stores/app-store";
import type { TabId } from "../stores/app-store";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

/* ── Tab definitions per view mode ── */

const BASIC_PRIMARY: TabItem[] = [
  { id: "shortcuts", label: "Keys", icon: <Keyboard size={16} /> },
  { id: "flows", label: "Flows", icon: <GitBranch size={16} /> },
  { id: "extraction", label: "Extract", icon: <Pickaxe size={16} /> },
  { id: "log", label: "Log", icon: <ScrollText size={16} /> },
];

const BASIC_MORE: TabItem[] = [
  { id: "templates", label: "Templates", icon: null },
  { id: "profiles", label: "Profiles", icon: null },
  { id: "import-export", label: "Import/Export", icon: null },
  { id: "settings", label: "Settings", icon: null },
];

const ADVANCED_PRIMARY: TabItem[] = [
  { id: "scripts", label: "Scripts", icon: <FileCode size={16} /> },
  { id: "shortcuts", label: "Keys", icon: <Keyboard size={16} /> },
  { id: "flows", label: "Flows", icon: <GitBranch size={16} /> },
  { id: "log", label: "Log", icon: <ScrollText size={16} /> },
];

const ADVANCED_MORE: TabItem[] = [
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
  const viewMode = useAppStore((s) => s.settings.ui.viewMode);
  const [moreOpen, setMoreOpen] = useState(false);

  const PRIMARY_TABS = useMemo(
    () => (viewMode === "basic" ? BASIC_PRIMARY : ADVANCED_PRIMARY),
    [viewMode],
  );
  const MORE_TABS = useMemo(
    () => (viewMode === "basic" ? BASIC_MORE : ADVANCED_MORE),
    [viewMode],
  );
  const tabListRef = useRef<HTMLElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const handleTabSelect = useCallback(
    (id: TabId) => {
      setActiveTab(id);
    },
    [setActiveTab],
  );

  const handleMoreToggle = useCallback(() => {
    setMoreOpen((prev) => !prev);
  }, []);

  const handleMoreClose = useCallback(() => {
    setMoreOpen(false);
  }, []);

  const handleMoreItemSelect = useCallback(
    (id: TabId) => {
      setActiveTab(id);
      setMoreOpen(false);
    },
    [setActiveTab],
  );

  // Arrow key navigation within the tab bar
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const tabs = tabListRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
      if (!tabs || tabs.length === 0) return;

      const tabArray = Array.from(tabs);
      const currentIndex = tabArray.indexOf(e.currentTarget);
      if (currentIndex === -1) return;

      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = (currentIndex + 1) % tabArray.length;
          break;
        case "ArrowLeft":
          nextIndex = (currentIndex - 1 + tabArray.length) % tabArray.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = tabArray.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      tabArray[nextIndex]?.focus();
    },
    [],
  );

  // Arrow key navigation within the more menu
  const handleMoreMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const items = moreMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (!items || items.length === 0) return;

      const itemArray = Array.from(items);
      const currentIndex = itemArray.indexOf(e.target as HTMLElement);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = currentIndex < itemArray.length - 1 ? currentIndex + 1 : 0;
          itemArray[next]?.focus();
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = currentIndex > 0 ? currentIndex - 1 : itemArray.length - 1;
          itemArray[prev]?.focus();
          break;
        }
        case "Escape":
          e.preventDefault();
          setMoreOpen(false);
          break;
        case "Home": {
          e.preventDefault();
          itemArray[0]?.focus();
          break;
        }
        case "End": {
          e.preventDefault();
          itemArray[itemArray.length - 1]?.focus();
          break;
        }
      }
    },
    [],
  );

  // Focus first menu item when more menu opens
  useEffect(() => {
    if (moreOpen) {
      const firstItem = moreMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      firstItem?.focus();
    }
  }, [moreOpen]);

  return (
    <nav
      ref={tabListRef}
      className="border-border relative flex h-11 shrink-0 items-center justify-around border-t"
      role="tablist"
      aria-label="Main navigation"
    >
      {PRIMARY_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => {
            handleTabSelect(tab.id);
          }}
          onKeyDown={handleTabKeyDown}
          className={`flex flex-col items-center gap-0.5 rounded px-3 py-1 text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-active ${activeTab === tab.id ? "text-active" : "text-text-muted hover:text-text-secondary"} `}
          aria-label={tab.label}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}

      {/* More menu */}
      <div className="relative">
        <button
          type="button"
          role="tab"
          aria-selected={MORE_TABS.some((t) => t.id === activeTab)}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          tabIndex={MORE_TABS.some((t) => t.id === activeTab) ? 0 : -1}
          onClick={handleMoreToggle}
          onKeyDown={handleTabKeyDown}
          className={`flex flex-col items-center gap-0.5 rounded px-3 py-1 text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-active ${MORE_TABS.some((t) => t.id === activeTab) ? "text-active" : "text-text-muted hover:text-text-secondary"} `}
          aria-label="More options"
        >
          <MoreHorizontal size={16} />
          <span>More</span>
        </button>

        {moreOpen ? (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={handleMoreClose}
              aria-hidden="true"
            />
            <div
              ref={moreMenuRef}
              role="menu"
              aria-label="More navigation options"
              onKeyDown={handleMoreMenuKeyDown}
              className="border-border bg-bg-secondary absolute right-0 bottom-full z-20 mb-1 min-w-[120px] rounded-md border py-1 shadow-lg"
            >
              {MORE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    handleMoreItemSelect(tab.id);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-active ${activeTab === tab.id ? "text-active" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"} `}
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
