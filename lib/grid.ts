import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { Downloaded } from "./data/drive";
import { fmtDate } from "./dates.ts";

/** A sheet as rows of trimmed strings. */
export type Grid = string[][];

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
