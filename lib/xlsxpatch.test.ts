import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { excelSerial, patchCells, patchSheetXml } from "./xlsxpatch.ts";

test("patchSheetXml: replaces, keeps the style, inserts cells and rows in order", () => {
  const xml = '<worksheet><sheetData><row r="2" spans="1:3"><c r="A2" s="5"><v>1</v></c><c r="C2" s="7"><f>A2*2</f><v>2</v></c></row><row r="9"><c r="A9"/></row></sheetData></worksheet>';
  const out = patchSheetXml(xml, [
    { ref: "C2", value: 42 },
    { ref: "B2", value: "Zelt & Blachen" },
    { ref: "A5", value: null },
    { ref: "A9", value: new Date(Date.UTC(2027, 6, 19)) },
  ]);
  assert.match(out, /<c r="A2" s="5"><v>1<\/v><\/c><c r="B2" t="inlineStr"><is><t xml:space="preserve">Zelt &amp; Blachen<\/t><\/is><\/c><c r="C2" s="7"><v>42<\/v><\/c>/);
  assert.match(out, /<\/row><row r="5"><c r="A5"\/><\/row><row r="9">/);
  assert.match(out, new RegExp(`<c r="A9"><v>${excelSerial(new Date(Date.UTC(2027, 6, 19)))}</v></c>`));
  assert.equal(excelSerial(new Date(Date.UTC(2027, 6, 19))), 46587);
});

test("patchSheetXml: a new cell gets its column's style", () => {
  const xml = '<worksheet><cols><col min="1" max="2" width="9"/><col min="3" max="5" width="28" style="4" customWidth="1"/></cols><sheetData><row r="5"><c r="A5" s="2"><v>1</v></c></row></sheetData></worksheet>';
  const out = patchSheetXml(xml, [{ ref: "D5", value: "Älplermagronen" }, { ref: "C7", value: "Zopf" }, { ref: "B5", value: 3 }]);
  assert.match(out, /<c r="B5"><v>3<\/v><\/c><c r="D5" s="4" t="inlineStr">/);
  assert.match(out, /<row r="7"><c r="C7" s="4" t="inlineStr">/);
});

test("patchSheetXml: refuses to overwrite the origin of a shared formula", () => {
  const xml = '<worksheet><sheetData><row r="1"><c r="A1"><f t="shared" ref="A1:A3" si="0">B1</f><v>0</v></c></row></sheetData></worksheet>';
  assert.throws(() => patchSheetXml(xml, [{ ref: "A1", value: 1 }]), /geteilten Formel/);
});

test("patchCells: round-trips through exceljs and keeps other parts untouched", async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Budget").getCell("D27").value = 200;
  const journal = wb.addWorksheet("Finanzjournal");
  journal.getCell("A4").value = 1;
  journal.getCell("D4").dataValidation = { type: "list", allowBlank: true, formulae: ['"A,B"'] };
  const src = Buffer.from(await wb.xlsx.writeBuffer());
  const before = await JSZip.loadAsync(src);

  const out = await patchCells(src, "Finanzjournal", [{ ref: "C4", value: "Einkauf Migros" }, { ref: "F4", value: 87.35 }]);
  const after = await JSZip.loadAsync(out);
  assert.equal(await after.file("xl/worksheets/sheet1.xml")!.async("string"), await before.file("xl/worksheets/sheet1.xml")!.async("string"));
  assert.match(await after.file("xl/workbook.xml")!.async("string"), /fullCalcOnLoad="1"/);

  const re = new ExcelJS.Workbook();
  await re.xlsx.load(out as unknown as ArrayBuffer);
  const j = re.getWorksheet("Finanzjournal")!;
  assert.equal(j.getCell("C4").value, "Einkauf Migros");
  assert.equal(j.getCell("F4").value, 87.35);
  assert.equal(j.getCell("D4").dataValidation?.type, "list");
});
