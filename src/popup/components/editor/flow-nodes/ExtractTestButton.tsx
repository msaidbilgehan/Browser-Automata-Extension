import { useState } from "react";
import { Play, X } from "lucide-react";
import type { EntityId, ExtractionRule } from "@/shared/types/entities";
import type { ExtractionRunResponse } from "@/shared/types/messages";
import type { ExtractionFieldTransform } from "@/shared/types/entities";
import { sendToBackground } from "@/shared/messaging";

// ─── Extraction Test Result Panel ─────────────────────────────────────────────

function TestResultPanel({
  result,
  onClose,
}: {
  result: ExtractionRunResponse;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!result.ok) {
    return (
      <div className="border-error/30 bg-error/5 flex items-start gap-1.5 rounded-md border p-2">
        <p className="text-error min-w-0 flex-1 text-[10px]">{result.error}</p>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary shrink-0">
          <X size={10} />
        </button>
      </div>
    );
  }

  const rowCount = result.data?.length ?? 0;

  return (
    <div className="border-border bg-bg-primary flex flex-col gap-1 rounded-md border">
      <div className="border-border flex items-center gap-1.5 border-b px-2 py-1">
        <span className="text-text-primary flex-1 text-[10px] font-medium">Test Result</span>
        <span className="bg-bg-tertiary text-text-muted rounded px-1 py-0.5 text-[9px]">
          {String(rowCount)} row{rowCount !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            if (result.formatted) {
              void navigator.clipboard.writeText(result.formatted).then(() => {
                setCopied(true);
                setTimeout(() => { setCopied(false); }, 1500);
              });
            }
          }}
          className={`text-[9px] ${copied ? "text-active" : "text-text-muted hover:text-text-primary"}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={10} />
        </button>
      </div>
      <pre className="text-text-secondary max-h-32 overflow-auto px-2 py-1 font-mono text-[9px] leading-relaxed">
        {result.formatted ?? "No data"}
      </pre>
    </div>
  );
}

// ─── Extract Test Button ──────────────────────────────────────────────────────

export function ExtractTestButton({
  fields,
  outputFormat,
  disabled,
}: {
  fields: { name: string; selector: string; attribute?: string; multiple: boolean; transforms?: ExtractionFieldTransform[] }[];
  outputFormat?: ExtractionRule["outputFormat"];
  disabled?: boolean;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ExtractionRunResponse | null>(null);

  const handleTest = async () => {
    setResult(null);
    setTesting(true);
    try {
      const res = await sendToBackground({
        type: "EXTRACTION_TEST",
        fields,
        outputFormat: outputFormat ?? "json",
      });
      setResult(res);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { void handleTest(); }}
        disabled={(disabled === true) || testing}
        className="border-border bg-bg-tertiary text-text-secondary hover:border-active hover:text-active disabled:opacity-40 flex items-center gap-1 self-start rounded-md border px-2 py-1 text-[10px] font-medium transition-colors"
      >
        <Play size={10} />
        {testing ? "Testing..." : "Test Extract"}
      </button>
      {result && (
        <TestResultPanel result={result} onClose={() => { setResult(null); }} />
      )}
    </>
  );
}

// ─── Run Extraction Test Button ───────────────────────────────────────────────

export function RunExtractionTestButton({ ruleId }: { ruleId: EntityId }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ExtractionRunResponse | null>(null);

  const handleTest = async () => {
    if (!ruleId) return;
    setResult(null);
    setTesting(true);
    try {
      const res = await sendToBackground({ type: "EXTRACTION_RUN_NOW", ruleId });
      setResult(res);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { void handleTest(); }}
        disabled={!ruleId || testing}
        className="border-border bg-bg-tertiary text-text-secondary hover:border-active hover:text-active disabled:opacity-40 flex items-center gap-1 self-start rounded-md border px-2 py-1 text-[10px] font-medium transition-colors"
      >
        <Play size={10} />
        {testing ? "Testing..." : "Test Extract"}
      </button>
      {result && (
        <TestResultPanel result={result} onClose={() => { setResult(null); }} />
      )}
    </>
  );
}
