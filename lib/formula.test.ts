import { test } from "node:test";
import assert from "node:assert/strict";
import { Evaluator, FormulaError, type Sheets } from "./formula.ts";

const sheets = (cells: Record<string, Record<string, string | number | null>>): Sheets =>
  new Map(Object.entries(cells).map(([name, c]) => [name, new Map(Object.entries(c).map(([ref, v]) =>
    [ref, typeof v === "string" && v.startsWith("=") ? { value: null, formula: v.slice(1) } : { value: v }]))]));

test("evaluates the budget template's formulas", () => {
  const ev = new Evaluator(sheets({
    Budget: {
      C48: 9.5, D16: 20, D17: 40, D18: 15, D21: 8, D22: 13, D23: 13,
      D19: "=SUM(D16:D18)", D49: "=C48*(D16*D21+D17*D22+D18*D23)", D53: "=15*D19",
      D88: "=SUM(D49+D53)", D91: "=MROUND(0.05*D88, 0.05)", F27: "=Referenzen!C2",
    },
    Referenzen: { A2: "Ausgaben - Höcks", C2: "=SUMIF(Finanzjournal!$D$4:$D$6,Referenzen!A2,Finanzjournal!$F$4:$F$6)" },
    Finanzjournal: { D4: "Ausgaben - Höcks", F4: 12.5, D5: "Ausgaben - Essen", F5: 100, D6: "ausgaben - höcks", F6: 7.5 },
  }));
  assert.equal(ev.cell("Budget", "D19"), 75);
  assert.equal(ev.cell("Budget", "D49"), 9.5 * (160 + 520 + 195));
  assert.equal(ev.cell("Budget", "D91"), 471.9); // 5% of 9437.5 = 471.875, to 5 Rappen
  assert.equal(ev.cell("Budget", "F27"), 20); // SUMIF is case-insensitive like Excel
});

test("operators, IF, comparisons, percent and strings", () => {
  const ev = new Evaluator(sheets({ S: { A1: 3, A2: "=2^3-A1*2/3+10%", A3: '=IF(A1>2,"ja","nein")&"!"', A4: "=-A1+ROUND(2.345,2)", A5: "=-2^2" } }));
  assert.equal(ev.cell("S", "A2"), 6.1);
  assert.equal(ev.cell("S", "A3"), "ja!");
  assert.ok(Math.abs((ev.cell("S", "A4") as number) - -0.65) < 1e-9);
  assert.equal(ev.cell("S", "A5"), 4);
});

test("unsupported functions and cycles throw", () => {
  const ev = new Evaluator(sheets({ S: { A1: "=VLOOKUP(1,B1:B2,1)", B1: "=B2", B2: "=B1" } }));
  assert.throws(() => ev.cell("S", "A1"), FormulaError);
  assert.throws(() => ev.cell("S", "B1"), FormulaError);
});

test("whole-column ranges (SUMIF(Finanzjournal!$F:$F, …))", () => {
  const ev = new Evaluator(sheets({
    J: { F4: "Kategorie", F5: "Miete", H5: 100, F6: "Essen", H6: 20, F7: "Miete", H7: 5 },
    B: { A1: "Miete", B1: "=SUMIF(J!$F:$F,A1,J!H:H)", B2: "=SUM(J!H:H)" },
  }));
  assert.equal(ev.cell("B", "B1"), 105);
  assert.equal(ev.cell("B", "B2"), 125);
});
