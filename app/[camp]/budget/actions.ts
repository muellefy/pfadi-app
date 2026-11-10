"use server";
import { revalidatePath } from "next/cache";
import { getCamp } from "@/lib/data/config";
import { parseBudget, type Budget } from "@/lib/budget";
import { BUDGET_FILE } from "@/lib/data/loaders";
import { download, getItemFresh, resolveTableFile, uploadNewRevision, XLSX } from "@/lib/data/drive";
import { serialize } from "@/lib/lock";
import { patchCells, type CellWrite } from "@/lib/xlsxpatch";

export type Result = { ok: true } | { ok: false; error: string };
const CHANGED = "Die Datei wurde inzwischen geändert – bitte Seite neu laden und nochmals versuchen.";

/**
 * Shared write path: reads the newest file, lets `plan` decide which cells to write
 * (checked against the freshly parsed workbook, never against what the browser sent),
 * patches only those cells and uploads a new revision. Writes to one file run one
 * after another, and we refuse to upload if the file changed in Drive meanwhile.
 */
async function edit(slug: string, plan: (b: Budget) => { sheet: string; writes: CellWrite[] } | string): Promise<Result> {
  const camp = await getCamp(slug);
  if (!camp?.writeBack) return { ok: false, error: "Zurückschreiben ist für dieses Lager deaktiviert (writeBack)." };
  if (!camp.drive.budgetFileId) return { ok: false, error: "Keine Budget-Datei konfiguriert." };
  try {
    const file = await resolveTableFile(camp.drive.budgetFileId, BUDGET_FILE);
    if (!file) return { ok: false, error: "Keine Budget-Datei gefunden." };
    return await serialize(file.id, async () => {
      const item = await getItemFresh(file.id);
      if (item.mimeType !== XLSX) return { ok: false, error: "Nur .xlsx-Dateien können bearbeitet werden." };
      if (!item.canEdit) return { ok: false, error: "Du hast im Drive keine Schreibrechte auf die Budget-Datei." };
      const { buffer } = await download(item);
      const decided = plan(await parseBudget(buffer));
      if (typeof decided === "string") return { ok: false, error: decided };
      const updated = await patchCells(buffer, decided.sheet, decided.writes);
      // shortcut: Drive v3 has no conditional upload, so a tiny window between this check and the upload remains
      if ((await getItemFresh(file.id)).modifiedTime !== item.modifiedTime) return { ok: false, error: CHANGED };
      await uploadNewRevision(file.id, updated);
      revalidatePath(`/${slug}/budget`);
      return { ok: true as const };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." };
  }
}

const amount = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e9 ? Math.round(n * 100) / 100 : null);

/** Sets one of the coloured input cells (budget or Abrechnung) of the budget sheet. */
export async function setBudgetValue(slug: string, ref: string, value: number | null): Promise<Result> {
  if (value !== null && amount(value) === null) return { ok: false, error: "Ungültige Zahl." };
  return edit(slug, (b) => {
    const cell = b.rows.flatMap((r) => [r.rate, r.plan, r.actual]).find((c) => c?.ref === ref);
    if (!cell?.input) return "Diese Zelle ist kein Eingabefeld.";
    return { sheet: b.sheet, writes: [{ ref, value: value === null ? null : amount(value) }] };
  });
}

export type BookingInput = { date: string; text: string; category: string; amount: number };

function bookingWrites(b: Budget, row: number, input: BookingInput): CellWrite[] | string {
  const { cols, sheet } = b.journal;
  if (!sheet) return "Die Datei hat kein Finanzjournal.";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? new Date(`${input.date}T00:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime())) return "Ungültiges Datum.";
  const text = String(input.text ?? "").trim().slice(0, 200);
  if (!text) return "Der Text fehlt.";
  if (!b.categories.includes(input.category)) return "Unbekannte Kategorie.";
  const value = amount(input.amount);
  if (value === null || value <= 0) return "Der Betrag muss grösser als 0 sein.";
  const income = /^einnahme/i.test(input.category);
  return [
    { ref: `${cols.date}${row}`, value: d },
    { ref: `${cols.text}${row}`, value: text },
    { ref: `${cols.category}${row}`, value: input.category },
    { ref: `${cols.income}${row}`, value: income ? value : null },
    { ref: `${cols.expense}${row}`, value: income ? null : value },
  ];
}

/** Adds a booking in the first free journal row, or replaces booking `row` if it still holds `expectText`. */
export async function saveBooking(slug: string, input: BookingInput, existing?: { row: number; text: string }): Promise<Result> {
  return edit(slug, (b) => {
    let row: number;
    if (existing) {
      const current = b.journal.bookings.find((x) => x.row === existing.row);
      if (!current || current.text !== existing.text) return CHANGED;
      row = existing.row;
    } else {
      if (!b.journal.freeRows.length) return "Das Finanzjournal ist voll – bitte in Excel weitere Zeilen ergänzen.";
      row = b.journal.freeRows[0];
    }
    const writes = bookingWrites(b, row, input);
    return typeof writes === "string" ? writes : { sheet: b.journal.sheet, writes };
  });
}

/** Empties a booking's cells (the number in "Nr." stays), if the row still holds `expectText`. */
export async function deleteBooking(slug: string, row: number, expectText: string): Promise<Result> {
  return edit(slug, (b) => {
    const current = b.journal.bookings.find((x) => x.row === row);
    if (!current || current.text !== expectText) return CHANGED;
    const { cols } = b.journal;
    return { sheet: b.journal.sheet, writes: [cols.date, cols.text, cols.category, cols.income, cols.expense].map((c) => ({ ref: `${c}${row}`, value: null })) };
  });
}
