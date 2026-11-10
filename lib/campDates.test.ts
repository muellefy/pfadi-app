import { test } from "node:test";
import assert from "node:assert/strict";
import { campDates } from "./campDates.ts";
import { parseTermine } from "./termine.ts";
import type { Grid } from "./grid.ts";
import type { CampConfig } from "./data/config.ts";

const LAGERDATEN: Grid = [["Erster Lagertag", "19.7.27"], [], ["Wann", "Was"]];

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
