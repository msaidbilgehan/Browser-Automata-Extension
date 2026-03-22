import { useState, useEffect } from "react";
import { FileCode, GitBranch, Download, FileEdit, Settings2 } from "lucide-react";
import type { QuickRunAction, QuickRunTargetType } from "@/shared/types/entities";
import { sendToBackground } from "@/shared/messaging";
import { useAppStore } from "../stores/app-store";
import type { TabId } from "../stores/app-store";

// ─── Icon map for target types ──────────────────────────────────────────────

const TARGET_ICONS: Record<QuickRunTargetType, React.ReactNode> = {
  script: <FileCode size={13} />,
  flow: <GitBranch size={13} />,
  extraction: <Download size={13} />,
  form_fill: <FileEdit size={13} />,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function QuickRunBar() {
  const [actions, setActions] = useState<QuickRunAction[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  useEffect(() => {
    let cancelled = false;

    async function loadMatchingActions(): Promise<void> {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tab?.url ?? "";
        if (!url) {
          setActions([]);
          return;
        }

        const response = await sendToBackground({ type: "QUICK_RUN_GET_MATCHING", url });
        if (!cancelled) {
          const result = response as { actions: QuickRunAction[] };
          setActions(result.actions);
        }
      } catch {
        if (!cancelled) setActions([]);
      }
    }

    void loadMatchingActions();
    return () => { cancelled = true; };
  }, []);

  const handleExecute = async (actionId: string) => {
    setExecuting(actionId);
    try {
      await sendToBackground({ type: "QUICK_RUN_EXECUTE", actionId: actionId as QuickRunAction["id"] });
    } catch {
      // ignore
    } finally {
      setTimeout(() => { setExecuting(null); }, 300);
    }
  };

  const handleConfigure = () => {
    setActiveTab("quick-run" as TabId);
  };

  if (actions.length === 0) return null;

  return (
    <div className="border-border bg-bg-secondary flex items-center gap-1 border-t px-2 py-1" role="toolbar" aria-label="Quick run actions">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          title={action.name}
          aria-label={`Run ${action.name}`}
          onClick={() => void handleExecute(action.id)}
          className={`flex items-center justify-center rounded-md px-1.5 py-1 transition-colors ${
            executing === action.id
              ? "text-active bg-bg-tertiary"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          style={action.color ? { color: action.color } : undefined}
        >
          {TARGET_ICONS[action.target.type]}
          <span className="ml-1 text-[10px] max-w-[60px] truncate">{action.name}</span>
        </button>
      ))}

      {/* Configure link */}
      <button
        type="button"
        title="Configure Quick Run"
        onClick={handleConfigure}
        className="text-text-muted hover:text-text-secondary ml-auto flex items-center transition-colors"
      >
        <Settings2 size={11} />
      </button>
    </div>
  );
}
