import "server-only";
import ExcelJS from "exceljs";
import { parseSwissDate } from "./dates.ts";
import type { Grid } from "./grid";

/** The Termine list in Lagerdaten.xlsx: reading it and ticking off "Erledigt". */

export type TerminStatus = "erledigt" | "ueberfaellig" | "bald" | "offen" | "ohne-datum";
export type Termin = {
  row: number; // 1-based row in the sheet, used for write-back
  section: string;
  date: string | null; // ISO
  dateLabel: string;
  was: string;
  wer: string;
  anWen: string;
  erledigt: boolean;
  status: TerminStatus;
};
export type TermineSheet = { meta: Record<string, string>; termine: Termin[]; erledigtCol: number };

export type CampDates = { start?: string; end?: string };

const RELATIVE = /^(\d+)\s*(tag|tage|woche|wochen)\s+(vorher|nachher)$/i;

/** "7 Wochen vorher" (before the camp start) or "2 Wochen nachher" (after the camp end) → ISO date. */
export function relativeDate(text: string, camp: CampDates): string | null {
  const m = text.trim().match(RELATIVE);
  if (!m) return null;
  const before = m[3].toLowerCase() === "vorher";
  const from = before ? camp.start : camp.end ?? camp.start;
  if (!from) return null;
  const days = Number(m[1]) * (m[2].toLowerCase().startsWith("woche") ? 7 : 1);
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (before ? -days : days));
  return d.toISOString().slice(0, 10);
}

/**
 * Parses the Lagerdaten.xlsx layout: meta rows, then "Wann | Was | Wer | An wen | Erledigt".
 * A "Wann" like "7 Wochen vorher" is counted from `camp` (else the sheet's "Erster Lagertag").
 */
export function parseTermine(grid: Grid, today = new Date(), camp?: CampDates): TermineSheet {
  const headerIdx = grid.findIndex((r) => r.some((c) => /^wann$/i.test(c)) && r.some((c) => /^was$/i.test(c)));
  if (headerIdx < 0) throw new Error("Keine Termin-Tabelle gefunden (Spalten «Wann» und «Was» fehlen).");
  const h = grid[headerIdx].map((c) => c.toLowerCase());
  const col = (re: RegExp) => h.findIndex((c) => re.test(c));
  const cWann = col(/^wann$/), cWas = col(/^was$/), cWer = col(/^wer$/), cAn = col(/an wen/), cDone = col(/erledigt/);

  const meta: Record<string, string> = {};
  for (const r of grid.slice(0, headerIdx)) {
    const filled = r.filter(Boolean);
    if (filled.length >= 2 && filled[0].length < 40) meta[filled[0]] = filled[1];
  }

  const sheetStart = meta["Erster Lagertag"] ? parseSwissDate(meta["Erster Lagertag"].replace(/^\D+/, ""))?.toISOString().slice(0, 10) : undefined;
  const dates: CampDates = camp?.start ? camp : { start: sheetStart };

  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const termine: Termin[] = [];
  let section = "";
  grid.slice(headerIdx + 1).forEach((r, i) => {
    const filled = r.filter(Boolean);
    if (!filled.length) return;
    const wann = r[cWann] ?? "";
    const was = r[cWas] ?? "";
    if (!was && filled.length === 1) { section = filled[0]; return; }
    const rel = relativeDate(wann, dates);
    const d = parseSwissDate(wann) ?? (rel ? new Date(`${rel}T00:00:00Z`) : null);
    const erledigt = cDone >= 0 && Boolean(r[cDone]?.trim());
    let status: TerminStatus = "offen";
    if (erledigt) status = "erledigt";
    else if (!d) status = "ohne-datum";
    else if (d.getTime() < startOfToday) status = "ueberfaellig";
    else if (d.getTime() - startOfToday <= 14 * 86_400_000) status = "bald";
    termine.push({
      row: headerIdx + 2 + i,
      section,
      date: d ? d.toISOString().slice(0, 10) : null,
      dateLabel: wann || "?",
      was,
      wer: cWer >= 0 ? r[cWer] ?? "" : "",
      anWen: cAn >= 0 ? r[cAn] ?? "" : "",
      erledigt,
      status,
    });
  });
  return { meta, termine, erledigtCol: cDone + 1 };
}

/** Sets the "Erledigt" cell of one row and returns the new workbook bytes. */
export async function setErledigt(xlsx: Buffer, row: number, col: number, done: boolean): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  ws.getRow(row).getCell(col).value = done ? "x" : null;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
