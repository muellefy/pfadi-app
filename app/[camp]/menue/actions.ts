"use server";
import { Readable } from "node:stream";
import { revalidatePath } from "next/cache";
import { getCamp } from "@/lib/config";
import { loadMenu, loadProgram, loadTermine } from "@/lib/data";
import { download, getItemFresh, uploadFile, uploadNewRevision, XLSX } from "@/lib/drive";
import { serialize } from "@/lib/lock";
import { buildMenuPlan, parseMenu } from "@/lib/menu";
import { campDates, toGrid } from "@/lib/tables";
import { patchCells } from "@/lib/xlsxpatch";

export type Result = { ok: true } | { ok: false; error: string };
const CHANGED = "Der Menüplan wurde inzwischen geändert – bitte Seite neu laden.";

/** Creates "Menüplan <camp>.xlsx" in the configured Küche folder, one row per camp day. */
export async function createMenuPlan(slug: string): Promise<Result> {
  const camp = await getCamp(slug);
  if (!camp?.writeBack) return { ok: false, error: "Zurückschreiben ist für dieses Lager deaktiviert (writeBack)." };
  try {
    return await serialize(`menu-create:${slug}`, async () => {
      const menu = await loadMenu(camp);
      if (!menu.ok) return { ok: false, error: menu.error };
      if (menu.data.plan) return { ok: true as const }; // someone was faster
      const folder = menu.data.folder && (await getItemFresh(menu.data.folder.id));
      if (!folder?.canAddChildren) return { ok: false, error: "Du darfst im Küche-Ordner keine Dateien anlegen." };
      const [program, termine] = await Promise.all([loadProgram(camp), loadTermine(camp)]);
      const { start, end } = campDates(camp, program.ok ? program.data : null, termine.ok ? termine.data : undefined);
      if (!start || !end) return { ok: false, error: "Lagerbeginn und -ende fehlen (in eCamp oder in der Konfiguration)." };
      const xlsx = await buildMenuPlan(`Menüplan ${camp.name}`, start, end);
      await uploadFile(folder.id, `Menüplan ${camp.name}.xlsx`, XLSX, Readable.from(xlsx));
      revalidatePath(`/${slug}/menue`);
      return { ok: true as const };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Anlegen fehlgeschlagen." };
  }
}

/**
 * Writes one meal (or the day's notes). Checked against the newest file: the cell must
 * still be a meal cell of a day row and hold what the browser saw, so nothing typed in
 * Excel meanwhile is overwritten.
 */
export async function setMeal(slug: string, ref: string, before: string, text: string): Promise<Result> {
  const camp = await getCamp(slug);
  if (!camp?.writeBack) return { ok: false, error: "Zurückschreiben ist für dieses Lager deaktiviert (writeBack)." };
  const value = String(text ?? "").trim().slice(0, 500);
  try {
    const menu = await loadMenu(camp);
    if (!menu.ok) return { ok: false, error: menu.error };
    const fileId = menu.source?.id;
    if (!fileId || !menu.data.plan) return { ok: false, error: "Noch kein Menüplan." };
    return await serialize(fileId, async () => {
      const item = await getItemFresh(fileId);
      if (item.mimeType !== XLSX) return { ok: false, error: "Nur .xlsx-Dateien können hier bearbeitet werden." };
      if (!item.canEdit) return { ok: false, error: "Du hast im Drive keine Schreibrechte auf den Menüplan." };
      const file = await download(item);
      const plan = parseMenu(await toGrid(file));
      const cell = plan.days.flatMap((d) => [...d.meals, ...(d.notes ? [d.notes] : [])]).find((c) => c.ref === ref);
      if (!cell) return { ok: false, error: "Diese Zelle gehört nicht zum Menüplan." };
      if (cell.text !== before.trim()) return { ok: false, error: CHANGED };
      if (cell.text === value) return { ok: true as const };
      const sheet = await firstSheetName(file.buffer);
      const updated = await patchCells(file.buffer, sheet, [{ ref, value: value || null }]);
      if ((await getItemFresh(fileId)).modifiedTime !== item.modifiedTime) return { ok: false, error: CHANGED };
      await uploadNewRevision(fileId, updated);
      revalidatePath(`/${slug}/menue`);
      return { ok: true as const };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }
}

/** toGrid reads the first worksheet, so that's the one to patch. */
async function firstSheetName(xlsx: Buffer) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx as unknown as ArrayBuffer);
  return wb.worksheets[0]?.name ?? "Menüplan";
}
