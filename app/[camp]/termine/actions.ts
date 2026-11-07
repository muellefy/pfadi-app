"use server";
import { revalidatePath } from "next/cache";
import { getCamp } from "@/lib/config";
import { download, getItemFresh, uploadNewRevision } from "@/lib/drive";
import { serialize } from "@/lib/lock";
import { parseTermine, setErledigt, toGrid } from "@/lib/tables";

const CHANGED = "Die Datei hat sich geändert – bitte Seite neu laden.";

/**
 * Ticks a Termin off directly in Lagerdaten.xlsx on the Drive.
 * We re-read the file first and check the row still holds the same task,
 * so a sheet edited in the meantime is never overwritten in the wrong place.
 * Toggles of one file run one after another, and we refuse to upload if the
 * file changed in Drive while we edited it — otherwise a parallel tick or a
 * manual edit would be lost.
 */
export async function toggleTermin(slug: string, row: number, was: string, done: boolean) {
  const camp = await getCamp(slug);
  if (!camp?.writeBack || !camp.drive.termineFileId) return { ok: false, error: "Zurückschreiben ist für dieses Lager deaktiviert." };
  const fileId = camp.drive.termineFileId;
  try {
    return await serialize(fileId, async () => {
      const item = await getItemFresh(fileId);
      if (item.mimeType !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        return { ok: false, error: "Nur .xlsx-Dateien können direkt bearbeitet werden." };
      }
      const file = await download(item);
      const sheet = parseTermine(await toGrid(file));
      const current = sheet.termine.find((t) => t.row === row);
      if (!current || current.was !== was) return { ok: false, error: CHANGED };
      if (sheet.erledigtCol < 1) return { ok: false, error: "Keine Spalte «Erledigt» gefunden." };
      const updated = await setErledigt(file.buffer, row, sheet.erledigtCol, done);
      // shortcut: Drive v3 has no conditional upload, so a tiny window between this check and the upload remains
      if ((await getItemFresh(fileId)).modifiedTime !== item.modifiedTime) return { ok: false, error: CHANGED };
      await uploadNewRevision(fileId, updated);
      revalidatePath(`/${slug}`, "layout");
      return { ok: true };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }
}
