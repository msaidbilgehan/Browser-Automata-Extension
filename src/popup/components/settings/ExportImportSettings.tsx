import { useState, useRef, useCallback, memo } from "react";
import { Download, Upload, AlertCircle } from "lucide-react";
import type { BrowserAutomataExport, ImportMergeStrategy } from "@/shared/types/entities";
import { sendToBackground } from "@/shared/messaging";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Select } from "../ui/Select";
import { SettingsSection } from "./SettingsSection";
import {
  EXPORT_SECTIONS,
  type ExportSectionKey,
  exportSections,
  readJsonFile,
  isValidExport,
  summarizeExport,
} from "../../utils/export-import";

const ALL_SECTION_KEYS = Object.keys(EXPORT_SECTIONS) as ExportSectionKey[];

const MERGE_STRATEGY_OPTIONS = [
  { value: "merge_keep", label: "Merge (Keep Existing)" },
  { value: "merge_overwrite", label: "Merge (Overwrite)" },
  { value: "replace_all", label: "Replace All" },
];

export const ExportImportSettings = memo(function ExportImportSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSections, setSelectedSections] = useState<Set<ExportSectionKey>>(
    () => new Set(ALL_SECTION_KEYS),
  );
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<BrowserAutomataExport | null>(null);
  const [importStrategy, setImportStrategy] = useState<ImportMergeStrategy>("merge_keep");
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

  const handleExport = useCallback(async () => {
    if (selectedSections.size === 0) {
      setError("Select at least one section to export.");
      return;
    }
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const msg = await exportSections(selectedSections);
      setSuccess(msg);
    } catch (err) {
      setError(`Export failed: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  }, [selectedSections]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);
    setSuccess(null);
    setImportPreview(null);
    try {
      const parsed = await readJsonFile<unknown>(file);
      if (!isValidExport(parsed)) {
        setError(
          'Invalid file format. Expected a Browser Automata export with "_format": "browser-automata-export".',
        );
        return;
      }
      setImportPreview(parsed);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!importPreview) return;
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      await sendToBackground({
        type: "IMPORT_CONFIG",
        data: importPreview,
        strategy: importStrategy,
      });
      setSuccess("Configuration imported successfully.");
      setImportPreview(null);
    } catch (err) {
      setError(`Import failed: ${String(err)}`);
    } finally {
      setImporting(false);
    }
  }, [importPreview, importStrategy]);

  const importSummary = importPreview ? summarizeExport(importPreview) : [];

  return (
    <SettingsSection title="Export / Import">
      {/* Status messages */}
      {error ? (
        <div className="border-error-dim bg-error-dim/10 flex items-start gap-2 rounded-md border p-2" role="alert">
          <AlertCircle size={14} className="text-error mt-0.5 shrink-0" />
          <p className="text-error text-xs">{error}</p>
        </div>
      ) : null}

      {success ? (
        <div className="border-active-dim bg-active-dim/10 rounded-md border p-2" role="status">
          <p className="text-active text-xs">{success}</p>
        </div>
      ) : null}

      {/* Section checkboxes */}
      <Card>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-xs font-medium">Sections to Export</span>
            <button
              type="button"
              onClick={toggleAllSections}
              className="text-active text-[10px] font-medium hover:underline"
            >
              {selectedSections.size === ALL_SECTION_KEYS.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {ALL_SECTION_KEYS.map((key) => (
              <label
                key={key}
                className="hover:bg-bg-tertiary flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 transition-colors"
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
      </Card>

      {/* Export button */}
      <Button
        variant="primary"
        onClick={() => void handleExport()}
        disabled={exporting || selectedSections.size === 0}
        className="gap-1 self-start"
      >
        <Download size={12} />
        {exporting ? "Exporting..." : "Export Selected"}
      </Button>

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
            aria-label="Select import file"
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1 self-start"
          >
            <Upload size={12} />
            Choose File
          </Button>

          {importPreview ? (
            <div className="border-border bg-bg-tertiary flex flex-col gap-2 rounded-md border p-2">
              <p className="text-text-primary text-xs font-medium">
                File loaded ({importSummary.join(", ")})
              </p>
              <Select
                label="Merge Strategy"
                options={MERGE_STRATEGY_OPTIONS}
                value={importStrategy}
                onChange={(e) => {
                  setImportStrategy(e.target.value as ImportMergeStrategy);
                }}
              />
              <Button
                variant="primary"
                onClick={() => void handleImport()}
                disabled={importing}
                className="gap-1 self-start"
              >
                <Upload size={12} />
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    </SettingsSection>
  );
});
