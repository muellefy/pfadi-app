import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseBudget } from "./budget.ts";

const BLUE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCEDBE6" } } as const;

/** A cut-down copy of the Google-Sheets budget (Chlausweekend): labels in D, journal via "Berechnung". */
async function googleSheetsBudget() {
  const wb = new ExcelJS.Workbook();
  const b = wb.addWorksheet("Lagerbudget");
  const j = wb.addWorksheet("Finanzjournal");
  const k = wb.addWorksheet("Berechnung");
  b.getCell("D4").value = "Lager:"; b.getCell("E4").value = "Chlausweekend";
  b.getCell("H4").value = "Lagertage:"; b.getCell("I4").value = 3; b.getCell("I4").fill = BLUE;
  b.getCell("D10").value = "Anzahl Teilnehmer"; b.getCell("G10").value = 28; b.getCell("G10").fill = BLUE;
  b.getCell("D15").value = "Ausgaben";
  b.getCell("D21").value = "Unterkunft"; b.getCell("G16").value = "Budget"; b.getCell("I16").value = "Abrechnung";
  b.getCell("C22").value = "Unterkunft"; b.getCell("D22").value = "Miete";
  b.getCell("B22").value = { formula: 'IF(C22="","",C22&": "&D22)' };
  b.getCell("G22").value = 1386; b.getCell("G22").fill = BLUE;
  b.getCell("I22").value = { formula: "Berechnung!F2" };
  b.getCell("D27").value = "Zwischentotal Kosten für Unterkunft"; b.getCell("G27").value = { formula: "SUM(G22:G26)" }; b.getCell("I27").value = { formula: "SUM(I22:I26)" };
  b.getCell("D76").value = "Total Ausgaben"; b.getCell("G76").value = { formula: "G27" }; b.getCell("I76").value = { formula: "I27" };
  k.getCell("A2").value = { formula: "Lagerbudget!B22" };
  k.getCell("F2").value = { formula: "SUMIF(Finanzjournal!$F:$F,Berechnung!$A2,Finanzjournal!H:H)" };
  ["Datum", "Beleg Nr.", "Bemerkung", "Leiter", "Kategorie", "Eingang", "Ausgang"].forEach((h, i) => { j.getCell(4, i + 2).value = h; });
  j.getCell("B5").value = new Date(Date.UTC(2026, 11, 5)); j.getCell("D5").value = "Hausmiete"; j.getCell("F5").value = "Unterkunft: Miete"; j.getCell("H5").value = 1300;
  for (let r = 5; r <= 8; r++) {
    j.getCell(`F${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ["Berechnung!$A$2:$A$2"] };
    j.getCell(`I${r}`).value = { formula: `IF(F${r}="","",1)` }; // the template's helper columns keep rows "used"
  }
  b.getCell("I101").value = { formula: "I76-SUM(Finanzjournal!H5:H8)" };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test("parses the Google-Sheets budget layout (labels in D, journal via Berechnung)", async () => {
  const b = await parseBudget(await googleSheetsBudget());
  assert.deepEqual(b.meta, [{ label: "Lager", value: "Chlausweekend" }, { label: "Lagertage", value: "3" }]);
  const miete = b.rows.find((r) => r.label === "Miete")!;
  assert.equal(miete.plan?.value, 1386);
  assert.equal(miete.plan?.input, "plan");
  assert.equal(miete.actual?.value, 1300); // Berechnung!F2 → SUMIF over the whole journal column
  assert.deepEqual(b.sections, [{ title: "Unterkunft", plan: 1386, actual: 1300 }]);
  assert.equal(b.summary.expensesActual, 1300);
  assert.deepEqual(b.journal.cols, { date: "B", text: "D", category: "F", income: "G", expense: "H" });
  assert.deepEqual(b.journal.bookings.map((x) => [x.row, x.text, x.expense, x.date]), [[5, "Hausmiete", 1300, "2026-12-05"]]);
  assert.deepEqual(b.journal.freeRows, [6, 7, 8]);
  assert.deepEqual(b.categories, ["Unterkunft: Miete"]);
});
