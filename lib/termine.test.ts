import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTermine, relativeDate } from "./termine.ts";
import type { Grid } from "./grid.ts";

// Lagerdaten.xlsx layout: meta rows, a blank row, the header, then sections and Termine.
const LAGERDATEN: Grid = [
  ["Lagerleitung", "Kenai"], //               sheet row 1
  ["Erster Lagertag", "19.7.27"], //          row 2
  [], //                                      row 3
  ["Wann", "Was", "Wer", "An wen", "Erledigt"], // row 4
  ["Vor dem Lager"], //                        row 5 (section)
  ["01.03.2027", "Lagerplatz buchen", "Kenai", "Gemeinde", "x"], // row 6
  ["10.03.2027", "Budget", "Pfiff", "", ""], //  row 7
  [], //                                       row 8
  ["", "Material bestellen", "Kenai", "", ""], // row 9
];

test("parseTermine: row is the 1-based sheet row that write-back changes", () => {
  const { termine, erledigtCol } = parseTermine(LAGERDATEN, new Date(2027, 2, 5));
  assert.deepEqual(
    termine.map((t) => [t.row, t.was]),
    [[6, "Lagerplatz buchen"], [7, "Budget"], [9, "Material bestellen"]],
  );
  assert.equal(erledigtCol, 5);
});

test("parseTermine: section, status and meta", () => {
  const { termine, meta } = parseTermine(LAGERDATEN, new Date(2027, 2, 5));
  assert.equal(meta["Lagerleitung"], "Kenai");
  assert.deepEqual(
    termine.map((t) => [t.section, t.status]),
    [["Vor dem Lager", "erledigt"], ["Vor dem Lager", "bald"], ["Vor dem Lager", "ohne-datum"]],
  );
  const later = parseTermine(LAGERDATEN, new Date(2027, 2, 11)).termine;
  assert.equal(later[1].status, "ueberfaellig");
});

test("relativeDate: weeks and days before the camp start", () => {
  assert.equal(relativeDate("7 Wochen vorher", { start: "2027-07-19" }), "2027-05-31");
  assert.equal(relativeDate("10 Tage vorher", { start: "2027-07-19" }), "2027-07-09");
  assert.equal(relativeDate("1 Woche vorher", { start: "2027-07-19" }), "2027-07-12");
});

test("relativeDate: 'nachher' counts from the camp end", () => {
  assert.equal(relativeDate("2 Wochen nachher", { start: "2027-07-19", end: "2027-07-31" }), "2027-08-14");
});

test("relativeDate: no camp date or no match gives null", () => {
  assert.equal(relativeDate("7 Wochen vorher", {}), null);
  assert.equal(relativeDate("Mitte Mai", { start: "2027-07-19" }), null);
});

test("parseTermine: a relative 'Wann' falls back to the sheet's Erster Lagertag", () => {
  const sheet = parseTermine([["Erster Lagertag", "19.07.2027"], ["Wann", "Was"], ["7 Wochen vorher", "Lagermeldung"]]);
  assert.equal(sheet.termine[0].date, "2027-05-31");
  assert.equal(sheet.termine[0].dateLabel, "7 Wochen vorher");
});

test("parseTermine: camp dates passed in win over the sheet", () => {
  const sheet = parseTermine([["Erster Lagertag", "19.07.2027"], ["Wann", "Was"], ["1 Woche vorher", "Packliste"]], new Date(), { start: "2027-08-02" });
  assert.equal(sheet.termine[0].date, "2027-07-26");
});
