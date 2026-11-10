import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTermine } from "./termine.ts";
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
