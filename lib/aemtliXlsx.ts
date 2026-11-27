import ExcelJS from "exceljs";
import type { AemtliPlan } from "./aemtli.ts";

const WEEKDAY = new Intl.DateTimeFormat("de-CH", { weekday: "short", timeZone: "UTC" });

/** The Ämtliplan as an xlsx: «Datum | Tag | <one column per Ämtli>», printable on one landscape page. */
export async function buildAemtliXlsx(title: string, plan: AemtliPlan): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Lagerplaner";
  const ws = wb.addWorksheet("Ämtliplan", { views: [{ state: "frozen", ySplit: 4, xSplit: 2 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 12 }, { width: 6 }, ...plan.chores.map(() => ({ width: 22 }))];
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 16 };
  ws.getCell("A2").value = "Erstellt mit dem Lagerplaner. Tauschen geht direkt hier in der Tabelle.";
  ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF5D6F66" } };
  const head = ws.getRow(4);
  head.values = ["Datum", "Tag", ...plan.chores];
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EEDB" } }; c.border = { bottom: { style: "thin" } }; });
  plan.days.forEach((d, i) => {
    const date = new Date(`${d.date}T00:00:00Z`);
    const row = ws.getRow(5 + i);
    row.values = [date, WEEKDAY.format(date), ...d.groups];
    row.getCell(1).numFmt = "dd.mm.yyyy";
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
