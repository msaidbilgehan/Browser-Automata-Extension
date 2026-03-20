import { useState, useRef, useCallback } from "react";
import { ArrowLeft, Download, Upload, AlertCircle } from "lucide-react";
import type { BrowserAutomataExport, ImportMergeStrategy } from "@/shared/types/entities";
import { sendToBackground } from "@/shared/messaging";
import { useAppStore } from "../../stores/app-store";
import { Toggle } from "../ui/Toggle";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
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

export function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  // Export/Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSections, setSelectedSections] = useState<Set<ExportSectionKey>>(
    () => new Set(ALL_SECTION_KEYS),
  );
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<BrowserAutomataExport | null>(null);
  const [importStrategy, setImportStrategy] = useState<ImportMergeStrategy>("merge_keep");
  const [exportImportError, setExportImportError] = useState<string | null>(null);
  const [exportImportSuccess, setExportImportSuccess] = useState<string | null>(null);

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
      setExportImportError("Select at least one section to export.");
      return;
    }
    setExporting(true);
    setExportImportError(null);
    setExportImportSuccess(null);
    try {
      const msg = await exportSections(selectedSections);
      setExportImportSuccess(msg);
    } catch (err) {
      setExportImportError(`Export failed: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  }, [selectedSections]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setExportImportError(null);
    setExportImportSuccess(null);
    setImportPreview(null);
    try {
      const parsed = await readJsonFile<unknown>(file);
      if (!isValidExport(parsed)) {
        setExportImportError(
          'Invalid file format. Expected a Browser Automata export with "_format": "browser-automata-export".',
        );
        return;
      }
      setImportPreview(parsed);
    } catch (err) {
      setExportImportError(String(err));
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!importPreview) return;
    setImporting(true);
    setExportImportError(null);
    setExportImportSuccess(null);
    try {
      await sendToBackground({
        type: "IMPORT_CONFIG",
        data: importPreview,
        strategy: importStrategy,
      });
      setExportImportSuccess("Configuration imported successfully.");
      setImportPreview(null);
    } catch (err) {
      setExportImportError(`Import failed: ${String(err)}`);
    } finally {
      setImporting(false);
    }
  }, [importPreview, importStrategy]);

  const importSummary = importPreview ? summarizeExport(importPreview) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("scripts");
          }}
          className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-1 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-text-primary text-sm font-semibold">Settings</h2>
      </div>

      {/* General */}
      <section className="flex flex-col gap-2">
        <h3 className="text-text-muted text-xs font-medium tracking-wider uppercase">General</h3>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs">Global Enable</span>
          <Toggle
            checked={settings.globalEnabled}
            onChange={(checked) => void updateSettings({ globalEnabled: checked })}
            size="sm"
          />
        </div>
        <Select
          label="Theme"
          value={settings.ui.theme}
          onChange={(e) =>
            void updateSettings({
              ui: { ...settings.ui, theme: e.target.value as "system" | "light" | "dark" },
            })
          }
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "system", label: "System" },
          ]}
        />
        <Select
          label="Icon Color"
          value={settings.ui.iconColor}
          onChange={(e) =>
            void updateSettings({
              ui: { ...settings.ui, iconColor: e.target.value as "dark" | "white" | "system" },
            })
          }
          options={[
            { value: "system", label: "System (follow theme)" },
            { value: "dark", label: "Dark" },
            { value: "white", label: "White" },
          ]}
        />
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs">Transparent Icon</span>
          <Toggle
            checked={settings.ui.iconTransparent}
            onChange={(checked) =>
              void updateSettings({ ui: { ...settings.ui, iconTransparent: checked } })
            }
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs">Confirm Before Run</span>
          <Toggle
            checked={settings.ui.confirmBeforeRun}
            onChange={(checked) =>
              void updateSettings({ ui: { ...settings.ui, confirmBeforeRun: checked } })
            }
            size="sm"
          />
        </div>
      </section>

      {/* Execution */}
      <section className="flex flex-col gap-2">
        <h3 className="text-text-muted text-xs font-medium tracking-wider uppercase">Execution</h3>
        <Input
          label="Timeout (ms)"
          type="number"
          value={settings.execution.scriptTimeoutMs}
          onChange={(e) =>
            void updateSettings({
              execution: {
                ...settings.execution,
                scriptTimeoutMs: Number(e.target.value),
              },
            })
          }
        />
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs">Inject in iframes</span>
          <Toggle
            checked={settings.execution.injectIntoIframes}
            onChange={(checked) =>
              void updateSettings({
                execution: { ...settings.execution, injectIntoIframes: checked },
              })
            }
            size="sm"
          />
        </div>
      </section>

      {/* Logging */}
      <section className="flex flex-col gap-2">
        <h3 className="text-text-muted text-xs font-medium tracking-wider uppercase">Logging</h3>
        <Select
          label="Level"
          value={settings.logging.level}
          onChange={(e) =>
            void updateSettings({
              logging: {
                ...settings.logging,
                level: e.target.value as "debug" | "info" | "warn" | "error" | "off",
              },
            })
          }
          options={[
            { value: "debug", label: "Debug" },
            { value: "info", label: "Info" },
            { value: "warn", label: "Warn" },
            { value: "error", label: "Error" },
            { value: "off", label: "Off" },
          ]}
        />
        <Input
          label="Max Entries"
          type="number"
          value={settings.logging.maxEntries}
          onChange={(e) =>
            void updateSettings({
              logging: { ...settings.logging, maxEntries: Number(e.target.value) },
            })
          }
        />
      </section>

      {/* Feedback */}
      <section className="flex flex-col gap-2">
        <h3 className="text-text-muted text-xs font-medium tracking-wider uppercase">Feedback</h3>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs">Show Toast on Shortcut</span>
          <Toggle
            checked={settings.feedback.toastEnabled}
            onChange={(checked) =>
              void updateSettings({
                feedback: { ...settings.feedback, toastEnabled: checked },
              })
            }
            size="sm"
          />
        </div>
        <Select
          label="Toast Dismiss Mode"
          value={settings.feedback.toastDismissMode}
          onChange={(e) =>
            void updateSettings({
              feedback: {
                ...settings.feedback,
                toastDismissMode: e.target.value as "delay" | "key_release",
              },
            })
          }
          options={[
            { value: "key_release", label: "Until Key Release" },
            { value: "delay", label: "After Delay" },
          ]}
        />
        {settings.feedback.toastDismissMode === "delay" ? (
          <Input
            label="Toast Duration (ms)"
            type="number"
            value={settings.feedback.toastDurationMs}
            onChange={(e) =>
              void updateSettings({
                feedback: {
                  ...settings.feedback,
                  toastDurationMs: Number(e.target.value),
                },
              })
            }
          />
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs">Highlight Target Element</span>
          <Toggle
            checked={settings.feedback.highlightEnabled}
            onChange={(checked) =>
              void updateSettings({
                feedback: { ...settings.feedback, highlightEnabled: checked },
              })
            }
            size="sm"
          />
        </div>
      </section>

      {/* Export / Import */}
      <section className="flex flex-col gap-2">
        <h3 className="text-text-muted text-xs font-medium tracking-wider uppercase">
          Export / Import
        </h3>

        {/* Status messages */}
        {exportImportError ? (
          <div className="border-error-dim bg-error-dim/10 flex items-start gap-2 rounded-md border p-2">
            <AlertCircle size={14} className="text-error mt-0.5 shrink-0" />
            <p className="text-error text-xs">{exportImportError}</p>
          </div>
        ) : null}

        {exportImportSuccess ? (
          <div className="border-active-dim bg-active-dim/10 rounded-md border p-2">
            <p className="text-active text-xs">{exportImportSuccess}</p>
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
      </section>
    </div>
  );
}
