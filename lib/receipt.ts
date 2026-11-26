/** "Beleg 2027-07-20 Einkauf Landi.jpg": the Drive name of a receipt uploaded with a booking. */
export function receiptName(date: string, text: string, fileName: string): string {
  const clean = text.replace(/[\\/\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const ext = fileName.match(/\.([a-z0-9]{1,5})$/i)?.[1].toLowerCase();
  return `Beleg ${date} ${clean}`.trim() + (ext ? `.${ext}` : "");
}
