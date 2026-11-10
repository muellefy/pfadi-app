import ExcelJS from "exceljs";
import { colLetters } from "./xlsxpatch.ts";
import { parseSwissDate } from "./dates.ts";
import type { Grid } from "./grid.ts";

/**
 * The Menüplan: one row per camp day, one column per meal, in an xlsx in the
 * Küche folder. The app creates it (buildMenuPlan) and edits single cells;
 * extra columns or sheets added in Excel are kept and shown.
 */
export const MEALS = ["Zmorge", "Zmittag", "Zvieri", "Znacht"];
export const MENU_FILE = /men(ü|ue|u)[\s_-]*plan/i;

export type MenuCell = { ref: string; text: string };
export type MenuDay = { row: number; date: string; meals: MenuCell[]; notes?: MenuCell };
export type MenuPlan = { columns: string[]; hasNotes: boolean; days: MenuDay[] };

const WEEKDAY = new Intl.DateTimeFormat("de-CH", { weekday: "short", timeZone: "UTC" });

function* days(start: string, end: string) {
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) yield new Date(t);
}

export async function buildMenuPlan(title: string, start: string, end: string): Promise<Buffer> {
  const count = [...days(start, end)].length;
  if (!count || count > 60) throw new Error("Lagerbeginn und -ende ergeben keinen sinnvollen Zeitraum.");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Lagerplaner";
  const ws = wb.addWorksheet("Menüplan", { views: [{ state: "frozen", ySplit: 4, xSplit: 2 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const header = ["Datum", "Tag", ...MEALS, "Bemerkungen"];
  ws.columns = header.map((h, i) => ({ width: i === 0 ? 12 : i === 1 ? 6 : i === header.length - 1 ? 30 : 28 }));
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 16 };
  ws.getCell("A2").value = "Erstellt mit dem Lagerplaner. Weitere Spalten (z. B. Dessert) einfach rechts ergänzen.";
  ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF5D6F66" } };
  const head = ws.getRow(4);
  head.values = header;
  head.font = { bold: true };
  head.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EEDB" } };
    c.border = { bottom: { style: "thin" } };
  });
  let r = 5;
  for (const d of days(start, end)) {
    const row = ws.getRow(r++);
    row.getCell(1).value = d;
    row.getCell(1).numFmt = "dd.mm.yyyy";
    row.getCell(2).value = WEEKDAY.format(d);
    for (let c = 3; c <= header.length; c++) {
      // styled empty cells, so cells written later keep wrapping and borders
      row.getCell(c).alignment = { wrapText: true, vertical: "top" };
      row.getCell(c).border = { bottom: { style: "hair" } };
      row.getCell(c).value = null;
    }
    row.getCell(1).alignment = { vertical: "top" };
    row.getCell(2).alignment = { vertical: "top" };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Reads a menu grid: header row with "Datum", then one row per day. */
export function parseMenu(grid: Grid): MenuPlan {
  const headerIdx = grid.findIndex((row) => row.some((c) => /^datum$/i.test(c)));
  if (headerIdx < 0) throw new Error("Kein Menüplan gefunden (Spalte «Datum» fehlt).");
  const head = grid[headerIdx];
  const dateCol = head.findIndex((c) => /^datum$/i.test(c));
  const dayCol = head.findIndex((c) => /^tag$/i.test(c));
  const notesCol = head.findIndex((c) => /bemerk|notiz/i.test(c));
  const mealCols = head.map((c, i) => [c, i] as const).filter(([c, i]) => c && i !== dateCol && i !== dayCol && i !== notesCol && i > dateCol);
  const ref = (rowIdx: number, col: number) => `${colLetters(col + 1)}${rowIdx + 1}`;
  const out: MenuDay[] = [];
  grid.forEach((row, i) => {
    if (i <= headerIdx) return;
    const d = parseSwissDate(row[dateCol] ?? "");
    if (!d) return;
    out.push({
      row: i + 1,
      date: d.toISOString().slice(0, 10),
      meals: mealCols.map(([, c]) => ({ ref: ref(i, c), text: row[c] ?? "" })),
      notes: notesCol >= 0 ? { ref: ref(i, notesCol), text: row[notesCol] ?? "" } : undefined,
    });
  });
  return { columns: mealCols.map(([c]) => c), hasNotes: notesCol >= 0, days: out };
}
