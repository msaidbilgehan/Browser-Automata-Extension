/**
 * Lightweight result viewer page.
 *
 * Reads the structured extraction result from chrome.storage.session, builds the
 * page markup via the shared builder, writes it, then wires the Copy/Download
 * buttons. The buttons are wired here — in this bundled module script, which the
 * extension page's MV3 CSP (`script-src 'self'`) permits — rather than via an
 * inline `<script>`, which the same CSP would block. Opened by openResultTab()
 * in the extraction engine.
 */
import { buildResultPageHtml } from "@/shared/result-display";

interface ResultPayload {
  formatted: string;
  format: string;
  rowCount: number;
  name: string;
  timestamp: number;
}

const DOWNLOAD_EXTENSIONS: Record<string, string> = {
  json: "json",
  csv: "csv",
  markdown: "md",
  html: "html",
  text: "txt",
  xml: "xml",
};

const DOWNLOAD_MIME_TYPES: Record<string, string> = {
  json: "application/json",
  csv: "text/csv",
  markdown: "text/markdown",
  html: "text/html",
  text: "text/plain",
  xml: "application/xml",
};

async function render(): Promise<void> {
  try {
    const stored = await chrome.storage.session.get("_resultPageData");
    const payload = stored["_resultPageData"] as ResultPayload | undefined;

    if (!payload || typeof payload.formatted !== "string") {
      document.body.textContent = "No extraction result data found.";
      return;
    }

    // Clear the payload so it doesn't persist across future tabs.
    await chrome.storage.session.remove("_resultPageData");

    const { formatted, format, rowCount, name } = payload;

    // Build and write the (script-free) result page, then wire the buttons.
    document.open();
    document.write(buildResultPageHtml(formatted, format, rowCount, name));
    document.close();

    wireActions(formatted, format, name);
  } catch (err) {
    document.body.textContent = `Failed to load result: ${
      err instanceof Error ? err.message : String(err)
    }`;
  }
}

/** Wire the Copy and Download buttons rendered by buildResultPageHtml. */
function wireActions(formatted: string, format: string, name: string): void {
  const copyBtn = document.getElementById("copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      void navigator.clipboard.writeText(formatted).then(() => {
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = "Copy to Clipboard";
          copyBtn.classList.remove("copied");
        }, 2000);
      });
    });
  }

  const downloadBtn = document.getElementById("download-btn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const safeName = (name || "extraction").replace(/[^a-zA-Z0-9_-]/g, "_");
      const mime = DOWNLOAD_MIME_TYPES[format] ?? "text/plain";
      const ext = DOWNLOAD_EXTENSIONS[format] ?? "txt";
      const blob = new Blob([formatted], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

void render();
