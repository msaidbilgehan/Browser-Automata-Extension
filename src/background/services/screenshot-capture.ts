import { inlineDeepQuery } from "@/shared/deep-query-snippet";

/**
 * Capture the visible area of a tab as a PNG data URL.
 */
export async function captureFullPage(tabId: number): Promise<string> {
  // Ensure the tab is active before capturing
  const tab = await chrome.tabs.get(tabId);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  return dataUrl;
}

/**
 * Capture a specific element on the page by selector.
 * Captures the visible tab, then injects a script to find the element bounds,
 * and crops the screenshot via an OffscreenCanvas in the injected script.
 */
export async function captureElement(tabId: number, selector: string): Promise<string> {
  // First capture the full visible tab
  const tab = await chrome.tabs.get(tabId);

  const fullDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  // Inject a script to get element bounds and crop the image
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: cropElementFromScreenshot,
    args: [fullDataUrl, selector],
  });

  const first = results[0];
  if (first?.result && typeof first.result === "object" && "error" in first.result) {
    throw new Error((first.result as { error: string }).error);
  }

  if (typeof first?.result !== "string") {
    throw new Error("Failed to crop element screenshot");
  }

  return first.result;
}

/**
 * Download a data URL screenshot as a file.
 */
export async function saveScreenshot(dataUrl: string, filename: string): Promise<void> {
  await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: true,
  });
}

// ─── Injected functions ──────────────────────────────────────────────────

/**
 * Injected into the page. Finds the element by selector, reads its bounding
 * rect, loads the full screenshot into an Image, crops it via canvas, and
 * returns the cropped data URL.
 */
function cropElementFromScreenshot(
  dataUrl: string,
  selector: string,
): Promise<string | { error: string }> {
  return new Promise((resolve) => {
    const element = inlineDeepQuery(selector);
    if (!element) {
      resolve({ error: `Element not found: ${selector}` });
      return;
    }

    const rect = element.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const x = Math.round(rect.left * dpr);
      const y = Math.round(rect.top * dpr);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ error: "Failed to get canvas 2d context" });
        return;
      }

      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      resolve({ error: "Failed to load screenshot image for cropping" });
    };
    img.src = dataUrl;
  });
}
