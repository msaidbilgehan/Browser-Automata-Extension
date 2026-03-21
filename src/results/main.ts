/**
 * Lightweight result viewer page.
 * Reads extraction result data from chrome.storage.session and renders it.
 * Opened by openResultTab() in the extraction engine.
 */

interface ResultPayload {
  html: string;
  timestamp: number;
}

async function render(): Promise<void> {
  try {
    const stored = await chrome.storage.session.get("_resultPageData");
    const payload = stored["_resultPageData"] as ResultPayload | undefined;

    if (!payload?.html) {
      document.body.textContent = "No extraction result data found.";
      return;
    }

    // Clear the payload so it doesn't persist across future tabs
    await chrome.storage.session.remove("_resultPageData");

    // Write the full result page HTML
    document.open();
    document.write(payload.html);
    document.close();
  } catch (err) {
    document.body.textContent = `Failed to load result: ${err instanceof Error ? err.message : String(err)}`;
  }
}

void render();
