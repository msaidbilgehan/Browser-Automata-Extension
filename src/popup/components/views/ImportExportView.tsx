import { useState, useRef, useCallback } from "react";
import { Download, Upload, AlertCircle, Loader2 } from "lucide-react";
import type { BrowserAutomataExport, EntityId } from "@/shared/types/entities";
import type { ImportConflictReport, ImportEntityOverride } from "@/shared/types/import-export";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Toggle } from "../ui/Toggle";
import { ImportConflictReview } from "./ImportConflictReview";
import {
  EXPORT_SECTIONS,
  type ExportSectionKey,
  exportSections,
  exportSectionsWithDeps,
  readJsonFile,
  isValidExport,
  summarizeExport,
  detectConflicts,
  importSelective,
} from "../../utils/export-import";

const ALL_SECTION_KEYS = Object.keys(EXPORT_SECTIONS) as ExportSectionKey[];

export function ImportExportView() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [selectedSections, setSelectedSections] = useState<Set<ExportSectionKey>>(
    () => new Set(ALL_SECTION_KEYS),
  );
  const [exporting, setExporting] = useState(false);
  const [includeDeps, setIncludeDeps] = useState(true);

  // Import state
  const [importData, setImportData] = useState<BrowserAutomataExport | null>(null);
  const [conflictReport, setConflictReport] = useState<ImportConflictReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleSection = useCallback((section: ExportSectionKey) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const toggleAllSections = useCallback(() => {
    setSelectedSections((prev) => {
      if (prev.size === ALL_SECTION_KEYS.length) {
        return new Set<ExportSectionKey>();
      }
      return new Set(ALL_SECTION_KEYS);
    });
  }, []);

  const handleExport = async () => {
    if (selectedSections.size === 0) {
      setError("Select at least one section to export.");
      return;
    }
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      if (includeDeps) {
        const result = await exportSectionsWithDeps(selectedSections);
        setSuccess(result.message);
      } else {
        const msg = await exportSections(selectedSections);
        setSuccess(msg);
      }
    } catch (err) {
      setError(`Export failed: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    setImportData(null);
    setConflictReport(null);

    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const parsed = await readJsonFile<unknown>(file);
      if (!isValidExport(parsed)) {
        setError(
          'Invalid file format. Expected a Browser Automata export with "_format": "browser-automata-export".',
        );
        return;
      }
      setImportData(parsed);

      // Analyze conflicts
      setAnalyzing(true);
      const report = await detectConflicts(parsed);
      setConflictReport(report);
    } catch (err) {
      setError(String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectiveImport = async (
    selectedIds: EntityId[],
    overrides: Record<string, ImportEntityOverride>,
  ) => {
    if (!importData) return;
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      await importSelective(importData, selectedIds, overrides);
      setSuccess(`Successfully imported ${String(selectedIds.length)} item(s).`);
      setImportData(null);
      setConflictReport(null);
    } catch (err) {
      setError(`Import failed: ${String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setImportData(null);
    setConflictReport(null);
  };

  const importSummary = importData ? summarizeExport(importData) : [];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-text-primary text-sm font-semibold">Import / Export</h2>

      {/* Status messages */}
      {error ? (
        <div className="border-error-dim bg-error-dim/10 flex items-start gap-2 rounded-md border p-2">
          <AlertCircle size={14} className="text-error mt-0.5 shrink-0" />
          <p className="text-error text-xs">{error}</p>
        </div>
      ) : null}

      {success ? (
        <div className="border-active-dim bg-active-dim/10 rounded-md border p-2">
          <p className="text-active text-xs">{success}</p>
        </div>
      ) : null}

      {/* Export */}
      <Card>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Download size={14} className="text-text-secondary" />
            <span className="text-text-primary text-xs font-medium">Export</span>
          </div>
          <p className="text-text-muted text-[10px]">
            Select which sections to include in the export file.
          </p>

          {/* Section checkboxes */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-[10px] font-medium">Sections</span>
              <button
                type="button"
                onClick={toggleAllSections}
                className="text-active text-[10px] font-medium hover:underline"
              >
                {selectedSections.size === ALL_SECTION_KEYS.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-0.5">
              {ALL_SECTION_KEYS.map((key) => (
                <label
                  key={key}
                  className="hover:bg-bg-tertiary flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedSections.has(key)}
                    onChange={() => {
                      toggleSection(key);
                    }}
                    className="accent-active"
                  />
                  <span className="text-text-primary text-[11px]">{EXPORT_SECTIONS[key]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Include dependencies toggle */}
          <div className="flex flex-col gap-0.5">
            <Toggle
              checked={includeDeps}
              onChange={setIncludeDeps}
              label="Include referenced entities"
              size="sm"
            />
            <p className="text-text-muted pl-9 text-[10px]">
              Auto-include flows, scripts, and profiles that selected items depend on.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => void handleExport()}
            disabled={exporting || selectedSections.size === 0}
            className="gap-1 self-start"
          >
            <Download size={12} />
            {exporting ? "Exporting..." : "Export Selected"}
          </Button>
        </div>
      </Card>

      {/* Import */}
      <Card>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Upload size={14} className="text-text-secondary" />
            <span className="text-text-primary text-xs font-medium">Import</span>
          </div>
          <p className="text-text-muted text-[10px]">
            Load a previously exported Browser Automata configuration file.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={(e) => void handleFileSelect(e)}
            className="hidden"
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            className="gap-1 self-start"
          >
            <Upload size={12} />
            Choose File
          </Button>

          {/* Analyzing spinner */}
          {analyzing ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={14} className="text-active animate-spin" />
              <span className="text-text-secondary text-xs">Analyzing file for conflicts...</span>
            </div>
          ) : null}

          {/* Conflict review */}
          {importData && conflictReport && !analyzing ? (
            <div className="border-border bg-bg-tertiary flex flex-col gap-2 rounded-md border p-2">
              <p className="text-text-primary text-xs font-medium">
                File loaded ({importSummary.join(", ")})
              </p>

              <ImportConflictReview
                report={conflictReport}
                onImport={(ids, overrides) => void handleSelectiveImport(ids, overrides)}
                onCancel={handleCancelImport}
                importing={importing}
              />
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
