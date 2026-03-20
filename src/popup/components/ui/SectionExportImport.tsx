import { useState, useRef, useCallback } from "react";
import { Download, Upload, AlertCircle } from "lucide-react";
import type { ImportMergeStrategy } from "@/shared/types/entities";
import {
  exportSection,
  importFromFile,
  type ExportSectionKey,
} from "../../utils/export-import";

interface SectionExportImportProps {
  /** Which section this controls */
  section: ExportSectionKey;
  /** Whether to show the import button (logs = export-only) */
  allowImport?: boolean;
}

/**
 * Compact export/import buttons for a section header.
 * Renders two icon buttons (download + upload) inline.
 */
export function SectionExportImport({
  section,
  allowImport = true,
}: SectionExportImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      await exportSection(section);
    } catch (err) {
      setError(String(err));
    } finally {
      setExporting(false);
    }
  }, [section]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      setError(null);
      setImporting(true);
      try {
        await importFromFile(file, "merge_keep" as ImportMergeStrategy);
      } catch (err) {
        setError(String(err));
      } finally {
        setImporting(false);
      }
    },
    [],
  );

  return (
    <div className="flex items-center gap-0.5">
      {error ? (
        <span title={error}>
          <AlertCircle size={12} className="text-error" />
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting}
        className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors disabled:opacity-50"
        aria-label={`Export ${section}`}
        title={`Export ${section}`}
      >
        <Download size={12} />
      </button>
      {allowImport ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={(e) => void handleFileSelect(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors disabled:opacity-50"
            aria-label={`Import ${section}`}
            title={`Import ${section}`}
          >
            <Upload size={12} />
          </button>
        </>
      ) : null}
    </div>
  );
}
