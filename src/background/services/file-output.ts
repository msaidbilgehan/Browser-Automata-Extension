/**
 * Save a string as a downloadable file using chrome.downloads.
 */
export async function saveToFile(
  content: string,
  filename: string,
  mimeType = "text/plain",
): Promise<void> {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    await chrome.downloads.download({ url, filename, saveAs: true });
  } finally {
    // Revoke after a short delay to let the download start
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 5_000);
  }
}

/**
 * Export data as a JSON file download.
 */
export async function exportAsJSON(data: unknown, filename: string): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await saveToFile(content, filename, "application/json");
}

/**
 * Export CSV string as a file download.
 */
export async function exportAsCSV(data: string, filename: string): Promise<void> {
  await saveToFile(data, filename, "text/csv");
}
