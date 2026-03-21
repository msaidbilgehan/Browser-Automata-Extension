/**
 * Self-contained functions for displaying extraction results on-page or in a new tab.
 * These are passed to `chrome.scripting.executeScript` and must NOT use closures.
 */

/**
 * Inject a floating result widget into the current page using Shadow DOM.
 * Called via `chrome.scripting.executeScript({ func: injectResultWidget, args: [...] })`.
 */
export function injectResultWidget(
  formatted: string,
  format: string,
  rowCount: number,
  name: string,
): void {
  const WIDGET_ID = "ba-extraction-result-widget";

  // Remove existing widget
  const existing = document.getElementById(WIDGET_ID);
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = WIDGET_ID;
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;bottom:16px;right:16px;font-family:system-ui,-apple-system,sans-serif;";

  const shadow = host.attachShadow({ mode: "closed" });

  const escaped = formatted
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .widget {
        background: #1a1a2e;
        border: 1px solid #2a2a4a;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        color: #e0e0e0;
        width: 420px;
        max-height: 480px;
        display: flex;
        flex-direction: column;
        font-size: 12px;
        overflow: hidden;
        animation: slideIn 0.2s ease-out;
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-bottom: 1px solid #2a2a4a;
        background: #16162a;
        border-radius: 12px 12px 0 0;
        cursor: move;
      }
      .header-title {
        flex: 1;
        font-weight: 600;
        font-size: 12px;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .badge {
        background: #2a2a4a;
        color: #9090b0;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 10px;
        white-space: nowrap;
      }
      .close-btn {
        background: none;
        border: none;
        color: #9090b0;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 16px;
        line-height: 1;
        transition: background 0.15s, color 0.15s;
      }
      .close-btn:hover {
        background: #2a2a4a;
        color: #fff;
      }
      .content {
        flex: 1;
        overflow: auto;
        padding: 10px 14px;
        margin: 0;
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 10px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        color: #c0c0d0;
        max-height: 320px;
      }
      .actions {
        display: flex;
        gap: 6px;
        padding: 8px 14px;
        border-top: 1px solid #2a2a4a;
      }
      .action-btn {
        background: #2a2a4a;
        border: 1px solid #3a3a5a;
        color: #c0c0d0;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 10px;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }
      .action-btn:hover {
        background: #3a3a5a;
        color: #fff;
      }
      .action-btn.copied {
        color: #4ade80;
      }
    </style>
    <div class="widget">
      <div class="header">
        <span class="header-title">Extraction: ${name.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "Result"}</span>
        <span class="badge">${String(rowCount)} row${rowCount !== 1 ? "s" : ""}</span>
        <span class="badge">${format.toUpperCase()}</span>
        <button class="close-btn" aria-label="Close">&times;</button>
      </div>
      <pre class="content">${escaped}</pre>
      <div class="actions">
        <button class="action-btn" data-action="copy">Copy</button>
        <button class="action-btn" data-action="download">Download</button>
      </div>
    </div>
  `;

  const closeBtn = shadow.querySelector(".close-btn") as HTMLButtonElement;
  const copyBtn = shadow.querySelector('[data-action="copy"]') as HTMLButtonElement;
  const downloadBtn = shadow.querySelector('[data-action="download"]') as HTMLButtonElement;
  const header = shadow.querySelector(".header") as HTMLElement;

  closeBtn.addEventListener("click", () => { host.remove(); });

  copyBtn.addEventListener("click", () => {
    void navigator.clipboard.writeText(formatted).then(() => {
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 2000);
    });
  });

  downloadBtn.addEventListener("click", () => {
    const ext: Record<string, string> = { json: "json", csv: "csv", markdown: "md", html: "html", text: "txt", xml: "xml" };
    const mime: Record<string, string> = { json: "application/json", csv: "text/csv", markdown: "text/markdown", html: "text/html", text: "text/plain", xml: "application/xml" };
    const safeName = (name || "extraction").replace(/[^a-zA-Z0-9_-]/g, "_");
    const blob = new Blob([formatted], { type: mime[format] ?? "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.${ext[format] ?? "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Drag support
  let dragX = 0;
  let dragY = 0;
  let isDragging = false;

  header.addEventListener("mousedown", (e: MouseEvent) => {
    isDragging = true;
    dragX = e.clientX - host.getBoundingClientRect().left;
    dragY = e.clientY - host.getBoundingClientRect().top;
    host.style.transition = "none";
  });

  document.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isDragging) return;
    host.style.left = `${String(e.clientX - dragX)}px`;
    host.style.top = `${String(e.clientY - dragY)}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  document.body.appendChild(host);
}

/**
 * Write extraction results into the current document (for about:blank tabs).
 * Called via `chrome.scripting.executeScript({ func: writeResultPage, args: [...] })`.
 */
export function writeResultPage(
  formatted: string,
  format: string,
  rowCount: number,
  name: string,
): void {
  const escaped = formatted
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Extraction Result: ${name.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "Untitled"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0f0f1a;
      color: #e0e0e0;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 32px;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    h1 {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }
    .badge {
      background: #2a2a4a;
      color: #9090b0;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .btn {
      background: #2a2a4a;
      border: 1px solid #3a3a5a;
      color: #c0c0d0;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .btn:hover { background: #3a3a5a; color: #fff; }
    .btn.copied { color: #4ade80; }
    .result {
      background: #1a1a2e;
      border: 1px solid #2a2a4a;
      border-radius: 12px;
      overflow: auto;
    }
    pre {
      padding: 20px;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      color: #c0c0d0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Extraction: ${name.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "Result"}</h1>
      <span class="badge">${String(rowCount)} row${rowCount !== 1 ? "s" : ""}</span>
      <span class="badge">${format.toUpperCase()}</span>
    </div>
    <div class="actions">
      <button class="btn" id="copy-btn">Copy to Clipboard</button>
      <button class="btn" id="download-btn">Download</button>
    </div>
    <div class="result">
      <pre>${escaped}</pre>
    </div>
  </div>
  <script>
    const formatted = ${JSON.stringify(formatted)};
    const format = ${JSON.stringify(format)};
    const name = ${JSON.stringify(name)};

    document.getElementById('copy-btn').addEventListener('click', function() {
      const btn = this;
      navigator.clipboard.writeText(formatted).then(function() {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function() {
          btn.textContent = 'Copy to Clipboard';
          btn.classList.remove('copied');
        }, 2000);
      });
    });

    document.getElementById('download-btn').addEventListener('click', function() {
      var ext = { json: 'json', csv: 'csv', markdown: 'md', html: 'html', text: 'txt', xml: 'xml' };
      var mime = { json: 'application/json', csv: 'text/csv', markdown: 'text/markdown', html: 'text/html', text: 'text/plain', xml: 'application/xml' };
      var safeName = (name || 'extraction').replace(/[^a-zA-Z0-9_-]/g, '_');
      var blob = new Blob([formatted], { type: mime[format] || 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = safeName + '.' + (ext[format] || 'txt');
      a.click();
      URL.revokeObjectURL(url);
    });
  </script>
</body>
</html>`;

  document.open();
  document.write(html);
  document.close();
}
