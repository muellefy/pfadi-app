/** "Beleg 2027-07-20 Einkauf Landi.jpg": the Drive name of a receipt uploaded with a booking. */
export function receiptName(date: string, text: string, fileName: string): string {
  const clean = text.replace(/[\\/\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const ext = fileName.match(/\.([a-z0-9]{1,5})$/i)?.[1].toLowerCase();
  return `Beleg ${date} ${clean}`.trim() + (ext ? `.${ext}` : "");
}

/**
 * Uploads a receipt into a Drive folder through the app's upload route.
 * Returns an error text or null; never throws, so a bad connection can't take the page down.
 */
export async function uploadReceipt(folderId: string, name: string, file: Blob, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(`/api/drive/upload?folder=${encodeURIComponent(folderId)}`, {
      method: "POST", body: file, headers: { "x-file-name": encodeURIComponent(name), "content-type": file.type || "application/octet-stream" },
    });
    return res.ok ? null : `Beleg nicht hochgeladen: ${await res.text()}`;
  } catch {
    return "Beleg nicht hochgeladen: keine Verbindung. Bitte nochmals versuchen.";
  }
}
