"use server";
import { Readable } from "node:stream";
import { revalidatePath } from "next/cache";
import { getMyCamp } from "@/lib/data/myRoles";
import { NO_ACCESS } from "@/lib/roles";
import { loadAemtli, loadProgram, loadTermine } from "@/lib/data/loaders";
import { getItemFresh, uploadFile, uploadNewRevision, XLSX } from "@/lib/data/drive";
import { serialize } from "@/lib/lock";
import { campDates } from "@/lib/campDates";
import { aemtliFileName, campDays, isOwnAemtliFile, MAX_LINES, rotate, splitLines } from "@/lib/aemtli";
import { buildAemtliXlsx } from "@/lib/aemtliXlsx";

export type Result = { ok: true } | { ok: false; error: string };


/**
 * Builds the rotation for every camp day and saves it as «Ämtliplan <camp>.xlsx» in the camp's
 * main folder: a new version of the app's file if there is one (Drive keeps the old), else a new file.
 */
export async function saveAemtli(slug: string, choresText: string, groupsText: string): Promise<Result> {
  const camp = await getMyCamp(String(slug));
  if (!camp) return { ok: false, error: NO_ACCESS };
  if (!camp.writeBack) return { ok: false, error: "Zurückschreiben ist für dieses Lager deaktiviert (writeBack)." };
  const chores = splitLines(String(choresText ?? "").slice(0, 5000), MAX_LINES);
  const groups = splitLines(String(groupsText ?? "").slice(0, 5000), MAX_LINES);
  if (!chores.length || !groups.length) return { ok: false, error: "Bitte mindestens ein Ämtli und eine Gruppe eingeben." };
  try {
    return await serialize(`aemtli:${camp.slug}`, async () => {
      const [program, termine, current] = await Promise.all([loadProgram(camp), loadTermine(camp), loadAemtli(camp)]);
      if (!current.ok) return { ok: false, error: current.error };
      const { start, end } = campDates(camp, program.ok ? program.data : null, termine.ok ? termine.data : undefined);
      const days = campDays(start, end);
      if (!days.length) return { ok: false, error: "Lagerbeginn und -ende fehlen (in eCamp oder in der Konfiguration)." };
      const xlsx = await buildAemtliXlsx(`Ämtliplan ${camp.name}`, { chores, days: rotate(days, chores, groups) });
      // overwrite only the app's own file, never someone's «Ämtli Ideen.xlsx»
      const own = current.source && current.source.mimeType === XLSX && isOwnAemtliFile(current.source.name, camp.name);
      const existing = own ? await getItemFresh(current.source!.id) : undefined;
      if (existing?.canEdit) {
        await uploadNewRevision(existing.id, xlsx);
      } else {
        const folder = await getItemFresh(current.data.folder.id);
        if (!folder.canAddChildren) return { ok: false, error: "Du darfst im Lager-Ordner keine Dateien anlegen." };
        await uploadFile(folder.id, aemtliFileName(camp.name), XLSX, Readable.from(xlsx));
      }
      revalidatePath(`/${camp.slug}`, "layout");
      return { ok: true as const };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }
}
