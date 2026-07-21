import { DEEP_QUERY_SNIPPET } from "@/shared/deep-query-snippet";

/** Delay (ms) to let a newly-activated tab paint before capture. */
const ACTIVATION_PAINT_MS = 150;
/** Delay (ms) to let a scroll settle and the page repaint before capture. */
const SCROLL_SETTLE_MS = 200;

/**
 * Make the target tab the active tab of its window and wait for it to paint.
 *
 * `chrome.tabs.captureVisibleTab` only ever captures a window's *active* tab —
 * passing a background `tabId` would otherwise screenshot whatever tab happens
 * to be in front. Returns the (refreshed) tab so callers have its `windowId`.
 */
async function activateTabForCapture(tabId: number): Promise<chrome.tabs.Tab> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active) {
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((resolve) => setTimeout(resolve, ACTIVATION_PAINT_MS));
    return chrome.tabs.get(tabId);
  }
  return tab;
}

/**
 * Capture the visible area of a tab as a PNG data URL.
 */
export async function captureFullPage(tabId: number): Promise<string> {
  const tab = await activateTabForCapture(tabId);
  return chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
}

/**
 * Capture a specific element on the page by selector.
 * Captures the visible tab, then injects a script to find the element bounds,
 * and crops the screenshot via an OffscreenCanvas in the injected script.
 */
export async function captureElement(tabId: number, selector: string): Promise<string> {
  const tab = await activateTabForCapture(tabId);

  // Scroll the element into the viewport first — captureVisibleTab only sees the
  // visible region, so an off-screen element would otherwise crop to garbage.
  const scrollResults = await chrome.scripting.executeScript({
    target: { tabId },
    func: scrollElementIntoView,
    args: [selector, DEEP_QUERY_SNIPPET],
  });
  if (scrollResults[0]?.result !== true) {
    throw new Error(`Element not found: ${selector}`);
  }
  // Let the scroll settle and the page repaint before capturing.
  await new Promise((resolve) => setTimeout(resolve, SCROLL_SETTLE_MS));

  const fullDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });

  // Inject a script to get element bounds and crop the image
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: cropElementFromScreenshot,
    args: [fullDataUrl, selector, DEEP_QUERY_SNIPPET],
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
 * Injected into the page. Scrolls the element matching `selector` into the
 * viewport so it falls within the captured region. Returns false if no element
 * matches.
 *
 * Self-contained per `chrome.scripting.executeScript`'s `func` requirement —
 * it cannot reference an imported helper directly, so `snippet`
 * (DEEP_QUERY_SNIPPET) is passed in and eval'd to define `__qsDeep` in the page.
 */
function scrollElementIntoView(selector: string, snippet: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
  new Function(snippet)();
  let element: Element | null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    element = (globalThis as any).__qsDeep(selector);
  } catch {
    element = null;
  }
  if (!element) return false;
  element.scrollIntoView({ block: "center", inline: "center" });
  return true;
}

/**
 * Injected into the page. Finds the element by selector, reads its bounding
 * rect, loads the full screenshot into an Image, crops it via canvas, and
 * returns the cropped data URL.
 *
 * Self-contained per `chrome.scripting.executeScript`'s `func` requirement —
 * see `scrollElementIntoView` above for why `snippet` is eval'd here too.
 */
function cropElementFromScreenshot(
  dataUrl: string,
  selector: string,
  snippet: string,
): Promise<string | { error: string }> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
    new Function(snippet)();
    let element: Element | null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      element = (globalThis as any).__qsDeep(selector);
    } catch {
      element = null;
    }
    if (!element) {
      resolve({ error: `Element not found: ${selector}` });
      return;
    }

    const rect = element.getBoundingClientRect();
    // The screenshot only covers the visible viewport, so clamp the crop region
    // to the intersection of the element and the viewport. An element entirely
    // off-screen (empty intersection) is rejected rather than cropped to garbage.
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    if (right <= left || bottom <= top) {
      resolve({ error: `Element is not visible in the viewport: ${selector}` });
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const x = Math.round(left * dpr);
      const y = Math.round(top * dpr);
      const w = Math.round((right - left) * dpr);
      const h = Math.round((bottom - top) * dpr);

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
