import { test } from "node:test";
import assert from "node:assert/strict";
import { campDates, parsePeople, parseTermine, type Grid } from "./tables.ts";
import type { CampConfig } from "./config.ts";

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

test("parsePeople: detects name, stufe and Hinweis columns", () => {
  const { rows, roles } = parsePeople([
    ["Vorname", "Nachname", "Pfadiname", "Stufe", "Allergien", "Telefon"],
    ["Mia", "Muster", "Kiwi", "Wölfli", "Nüsse", "079 123 45 67"],
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    [roles.vorname, roles.nachname, roles.pfadiname, roles.stufe, roles.telefon, roles.hinweise],
    ["Vorname", "Nachname", "Pfadiname", "Stufe", "Telefon", ["Allergien"]],
  );
});

const camp = { slug: "sola", name: "Sola", kind: "Lager", drive: { rootFolderId: "r" }, writeBack: false } as CampConfig;

test("campDates: reads 'Erster Lagertag' with a two-digit year", () => {
  const termine = parseTermine(LAGERDATEN);
  assert.equal(campDates(camp, null, termine).start, "2027-07-19");
});

test("campDates: finds the date inside text like 'Sa 19.07.2027'", () => {
  const termine = parseTermine([["Erster Lagertag", "Sa 19.07.2027"], ["Wann", "Was"]]);
  assert.equal(campDates(camp, null, termine).start, "2027-07-19");
});

test("campDates: an empty config start falls back to the sheet", () => {
  const termine = parseTermine(LAGERDATEN);
  assert.equal(campDates({ ...camp, start: "" }, null, termine).start, "2027-07-19");
});

test("campDates: config start wins over the sheet", () => {
  const termine = parseTermine(LAGERDATEN);
  assert.equal(campDates({ ...camp, start: "2027-07-20" }, null, termine).start, "2027-07-20");
});
