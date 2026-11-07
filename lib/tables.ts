import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { CampConfig } from "./config";
import type { Downloaded } from "./drive";
import type { EcampProgram } from "./ecamp";

export type Grid = string[][];

const pad = (n: number) => String(n).padStart(2, "0");
export const fmtDate = (d: Date) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return fmtDate(v);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text ?? "");
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("error" in v) return "";
  }
  return String(v);
}

/** First worksheet (or the named one) as a plain grid of strings. */
export async function toGrid(file: Downloaded, sheetName?: string): Promise<Grid> {
  if (file.format === "csv") {
    const text = file.buffer.toString("utf8").replace(/^﻿/, "");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy", delimiter: "" });
    return parsed.data.map((r) => r.map((c) => (c ?? "").trim()));
  }
  const wb = new ExcelJS.Workbook();
  // exceljs' types predate Node 22's generic Buffer
  await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
  const ws = (sheetName && wb.getWorksheet(sheetName)) || wb.worksheets[0];
  if (!ws) return [];
  const grid: Grid = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNr) => {
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c).value).trim());
    grid[rowNr - 1] = cells;
  });
  return Array.from(grid, (r) => r ?? []);
}

export function parseSwissDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
}

/** Camp dates: eCamp periods win, then config, then "Erster Lagertag" in Lagerdaten.xlsx. */
export function campDates(camp: CampConfig, program?: EcampProgram | null, termine?: TermineSheet) {
  const p = program?.periods ?? [];
  if (p.length) return { start: p[0].start.slice(0, 10), end: p[p.length - 1].end.slice(0, 10) };
  const fromSheet = termine?.meta["Erster Lagertag"];
  // the cell may be text like "Sa 19.07.2027", so skip anything before the date
  const start = camp.start || (fromSheet ? parseSwissDate(fromSheet.replace(/^\D+/, ""))?.toISOString().slice(0, 10) : undefined);
  return { start, end: camp.end };
}

/* ---------------------------------------------------------------- Termine */

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

/** Parses the Lagerdaten.xlsx layout: meta rows, then "Wann | Was | Wer | An wen | Erledigt". */
export function parseTermine(grid: Grid, today = new Date()): TermineSheet {
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

  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const termine: Termin[] = [];
  let section = "";
  grid.slice(headerIdx + 1).forEach((r, i) => {
    const filled = r.filter(Boolean);
    if (!filled.length) return;
    const wann = r[cWann] ?? "";
    const was = r[cWas] ?? "";
    if (!was && filled.length === 1) { section = filled[0]; return; }
    const d = parseSwissDate(wann);
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

/* ---------------------------------------------------------------- Personen */

export type PersonTable = {
  columns: string[];
  rows: Record<string, string>[];
  roles: {
    vorname?: string; nachname?: string; pfadiname?: string; stufe?: string;
    geburtsdatum?: string; hinweise: string[]; telefon?: string; email?: string;
  };
};

const ROLE_PATTERNS: [keyof Omit<PersonTable["roles"], "hinweise">, RegExp][] = [
  ["pfadiname", /pfadi.?name|übername|uebername|vulgo|^v\/o$|nickname|spitzname/i],
  ["vorname", /^vorname|first.?name/i],
  ["nachname", /^(nach)?name$|^nachname|last.?name|familienname/i],
  ["stufe", /stufe|einheit|gruppe|abteilung|^rolle$|^role$/i],
  ["geburtsdatum", /geburt|birth|jahrgang/i],
  ["telefon", /tel|natel|handy|mobile|phone/i],
  ["email", /mail/i],
];
const HINWEIS = /allerg|medi|krank|unverträg|unvertraeg|diät|diaet|vegi|vegan|ernährung|ernaehrung|besonder|bemerk|gesundheit|essen/i;

/** Turns any TN/Leiter export (MiData CSV, Anmeldeformular xlsx, …) into records. */
export function parsePeople(grid: Grid): PersonTable {
  const headerIdx = grid.slice(0, 15).findIndex((r) => r.filter(Boolean).length >= 3);
  if (headerIdx < 0) return { columns: [], rows: [], roles: { hinweise: [] } };
  const seen = new Map<string, number>();
  const columns = grid[headerIdx].map((c, i) => {
    const base = c || `Spalte ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  const rows = grid
    .slice(headerIdx + 1)
    .filter((r) => r.filter(Boolean).length >= 2)
    .map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ""])));

  const roles: PersonTable["roles"] = { hinweise: columns.filter((c) => HINWEIS.test(c)) };
  for (const [role, re] of ROLE_PATTERNS) {
    const hit = columns.find((c) => re.test(c) && !Object.values(roles).includes(c));
    if (hit) roles[role] = hit;
  }
  // keep only columns that actually contain something
  const used = columns.filter((c) => rows.some((r) => r[c]));
  return { columns: used, rows, roles };
}

/* ---------------------------------------------------------------- Ernährung */

const NO_HINT = /^(-|keine?|nein|no|none|n\/a|0)$/i;
const DIET = [
  ["vegetarisch", /vegetar|vegi\b|veggie|kein fleisch/i],
  ["vegan", /vegan/i],
  ["laktosefrei", /laktose|lactose|milch/i],
  ["glutenfrei", /gluten|zöliak|zoeliak|celiac/i],
  ["Nüsse", /nuss|nüsse|nuesse|erdnuss/i],
  ["kein Schwein", /schwein|pork/i],
] as const;

export type DietPerson = { name: string; list: string; hints: string[] };

/** Everyone with a filled-in Hinweis column (allergies, diet …), for the kitchen. */
export function dietHints(table: PersonTable, list: string): DietPerson[] {
  const { roles } = table;
  return table.rows.flatMap((r) => {
    const hints = roles.hinweise.map((c) => r[c]?.trim()).filter((v): v is string => Boolean(v) && !NO_HINT.test(v!));
    if (!hints.length) return [];
    const name = (roles.pfadiname && r[roles.pfadiname]) || [roles.vorname && r[roles.vorname], roles.nachname && r[roles.nachname]].filter(Boolean).join(" ") || "(ohne Namen)";
    return [{ name, list, hints }];
  });
}

/** How many people need each common diet, counted from their hints. */
export function dietCounts(people: DietPerson[]) {
  return DIET.map(([label, re]) => ({ label, count: people.filter((p) => p.hints.some((h) => re.test(h))).length })).filter((d) => d.count);
}
