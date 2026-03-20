import type { Settings } from "@/shared/types/settings";

import darkSolidUrl from "@/assets/icon/png/Dark.png";
import whiteSolidUrl from "@/assets/icon/png/White.png";
import darkTransparentUrl from "@/assets/icon/png/transparent/Dark.png";
import whiteTransparentUrl from "@/assets/icon/png/transparent/White.png";

const ICON_URLS = {
  "dark-solid": darkSolidUrl,
  "dark-transparent": darkTransparentUrl,
  "white-solid": whiteSolidUrl,
  "white-transparent": whiteTransparentUrl,
} as const;

const ICON_SIZES = [16, 32, 48, 128] as const;

/**
 * Resolve the effective icon color when "system" is selected.
 * "system" follows the theme: dark theme → white icon, light theme → dark icon.
 * When theme is also "system", default to white (matches the dark default).
 */
function resolveIconColor(
  iconColor: Settings["ui"]["iconColor"],
  theme: Settings["ui"]["theme"],
): "dark" | "white" {
  if (iconColor !== "system") return iconColor;
  if (theme === "light") return "dark";
  return "white";
}

function getIconUrl(color: "dark" | "white", transparent: boolean): string {
  const key = `${color}-${transparent ? "transparent" : "solid"}` as const;
  return ICON_URLS[key];
}

/**
 * Fetch an icon image and render it to ImageData at the given size.
 * Uses OffscreenCanvas (available in service workers) to avoid file-path
 * resolution issues with chrome.action.setIcon({ path }).
 */
async function renderIconImageData(url: string, size: number): Promise<ImageData> {
  const response = await fetch(url);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: size,
    resizeHeight: size,
    resizeQuality: "high",
  });
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get OffscreenCanvas 2d context");
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  return ctx.getImageData(0, 0, size, size);
}

/** Apply the extension toolbar icon based on current settings */
export async function applyExtensionIcon(settings: Settings): Promise<void> {
  const resolved = resolveIconColor(settings.ui.iconColor, settings.ui.theme);
  const url = getIconUrl(resolved, settings.ui.iconTransparent);

  const rendered = await Promise.all(
    ICON_SIZES.map(async (size) => [size, await renderIconImageData(url, size)] as const),
  );

  const imageData: Record<number, ImageData> = {};
  for (const [size, data] of rendered) {
    imageData[size] = data;
  }

  await chrome.action.setIcon({ imageData });
}
