import { memo } from "react";
import { ArrowLeft, Save, Undo2 } from "lucide-react";
import { Button } from "./Button";

interface EditorHeaderProps {
  title: string;
  isDirty: boolean;
  onBack: () => void;
  onSave: () => void;
  onDiscard: () => void;
  /** Extra buttons to render between discard and save */
  actions?: React.ReactNode;
}

/**
 * Shared editor header with back button, title, dirty indicator,
 * discard and save buttons. Used across all entity editors.
 */
export const EditorHeader = memo(function EditorHeader({
  title,
  isDirty,
  onBack,
  onSave,
  onDiscard,
  actions,
}: EditorHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors"
        aria-label="Go back to list"
      >
        <ArrowLeft size={16} />
      </button>
      <h2 className="text-text-primary flex-1 text-sm font-semibold">
        {title}
      </h2>
      {isDirty && (
        <span className="text-warning text-[10px] font-medium" role="status">
          Unsaved
        </span>
      )}
      {isDirty && (
        <Button variant="ghost" onClick={onDiscard} className="gap-1" aria-label="Discard changes">
          <Undo2 size={12} />
          Discard
        </Button>
      )}
      {actions}
      <Button variant="primary" onClick={onSave} className="gap-1" aria-label="Save changes">
        <Save size={12} />
        Save
      </Button>
    </div>
  );
});
