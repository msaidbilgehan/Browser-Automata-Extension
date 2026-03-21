import { useState } from "react";
import { X, Copy, Download, Check, AlertCircle } from "lucide-react";
import { Button } from "./ui/Button";
import type { ExtractionRule } from "@/shared/types/entities";

interface ExtractionResultPanelProps {
  formatted: string;
  rowCount: number;
  rule: ExtractionRule;
  onClose: () => void;
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const FORMAT_EXTENSIONS: Record<ExtractionRule["outputFormat"], string> = {
  json: "json",
  csv: "csv",
  markdown: "md",
  html: "html",
  text: "txt",
  xml: "xml",
};

const FORMAT_MIME: Record<ExtractionRule["outputFormat"], string> = {
  json: "application/json",
  csv: "text/csv",
  markdown: "text/markdown",
  html: "text/html",
  text: "text/plain",
  xml: "application/xml",
};

export function ExtractionResultPanel({
  formatted,
  rowCount,
  rule,
  onClose,
}: ExtractionResultPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(formatted);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleDownload = () => {
    const safeName = (rule.name || "extraction").replace(/[^a-zA-Z0-9_-]/g, "_");
    const ext = FORMAT_EXTENSIONS[rule.outputFormat];
    const mime = FORMAT_MIME[rule.outputFormat];
    downloadFile(formatted, `${safeName}.${ext}`, mime);
  };

  return (
    <div className="border-border bg-bg-secondary flex flex-col gap-2 rounded-lg border p-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-text-primary flex-1 text-xs font-semibold">
          Extraction Result
        </h3>
        <span className="bg-bg-tertiary text-text-muted rounded px-1.5 py-0.5 text-[10px]">
          {rowCount} row{rowCount !== 1 ? "s" : ""}
        </span>
        <span className="bg-bg-tertiary text-text-muted rounded px-1.5 py-0.5 text-[10px] uppercase">
          {rule.outputFormat}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:bg-bg-tertiary hover:text-text-primary rounded p-0.5 transition-colors"
          aria-label="Close results"
        >
          <X size={14} />
        </button>
      </div>

      {/* Data preview */}
      <div className="border-border bg-bg-primary max-h-48 overflow-auto rounded-md border">
        <pre className="text-text-secondary whitespace-pre-wrap p-2 text-[10px] leading-relaxed">
          {formatted}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          onClick={() => void handleCopy()}
          className="gap-1"
        >
          {copied ? <Check size={12} className="text-active" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          variant="secondary"
          onClick={handleDownload}
          className="gap-1"
        >
          <Download size={12} />
          Download
        </Button>
      </div>
    </div>
  );
}

export function ExtractionErrorPanel({
  error,
  onClose,
}: {
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="border-error/30 bg-error/5 flex items-start gap-2 rounded-lg border p-2">
      <AlertCircle size={14} className="text-error mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-text-primary text-xs font-medium">Extraction Failed</p>
        <p className="text-text-muted mt-0.5 text-[10px]">{error}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-text-muted hover:text-text-primary shrink-0 rounded p-0.5"
        aria-label="Dismiss error"
      >
        <X size={12} />
      </button>
    </div>
  );
}
