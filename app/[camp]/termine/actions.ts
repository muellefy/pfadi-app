"use server";
import { revalidatePath } from "next/cache";
import { getCamp } from "@/lib/config";
import { download, getItem, uploadNewRevision } from "@/lib/drive";
import { parseTermine, setErledigt, toGrid } from "@/lib/tables";

/**
 * Ticks a Termin off directly in Lagerdaten.xlsx on the Drive.
 * We re-read the file first and check the row still holds the same task,
 * so a sheet edited in the meantime is never overwritten in the wrong place.
 */
export async function toggleTermin(slug: string, row: number, was: string, done: boolean) {
  const camp = await getCamp(slug);
  if (!camp?.writeBack || !camp.drive.termineFileId) return { ok: false, error: "Zurückschreiben ist für dieses Lager deaktiviert." };
  try {
    const item = await getItem(camp.drive.termineFileId);
    if (item.mimeType !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      return { ok: false, error: "Nur .xlsx-Dateien können direkt bearbeitet werden." };
    }
    const file = await download(item);
    const sheet = parseTermine(await toGrid(file));
    const current = sheet.termine.find((t) => t.row === row);
    if (!current || current.was !== was) return { ok: false, error: "Die Datei hat sich geändert – bitte Seite neu laden." };
    if (sheet.erledigtCol < 1) return { ok: false, error: "Keine Spalte «Erledigt» gefunden." };
    await uploadNewRevision(item.id, await setErledigt(file.buffer, row, sheet.erledigtCol, done));
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }
}
