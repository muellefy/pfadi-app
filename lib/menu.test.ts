import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMenuPlan, parseMenu } from "./menu.ts";
import { patchCells } from "./xlsxpatch.ts";
import { toGrid } from "./tables.ts";

test("buildMenuPlan → parseMenu: one row per day with the four meals", async () => {
  const xlsx = await buildMenuPlan("Menüplan Sola 27", "2027-07-19", "2027-07-31");
  const plan = parseMenu(await toGrid({ buffer: xlsx, format: "xlsx" }));
  assert.deepEqual(plan.columns, ["Zmorge", "Zmittag", "Zvieri", "Znacht"]);
  assert.equal(plan.days.length, 13);
  assert.equal(plan.days[0].date, "2027-07-19");
  assert.equal(plan.days[0].meals[1].ref, "D5");
  assert.equal(plan.days[0].notes?.ref, "G5");
});

test("a patched meal keeps the cell style and reads back", async () => {
  const xlsx = await buildMenuPlan("Menüplan", "2027-07-19", "2027-07-20");
  const out = await patchCells(xlsx, "Menüplan", [{ ref: "F6", value: "Älplermagronen mit Apfelmus" }]);
  const plan = parseMenu(await toGrid({ buffer: out, format: "xlsx" }));
  assert.equal(plan.days[1].meals[3].text, "Älplermagronen mit Apfelmus");
});

test("buildMenuPlan refuses an empty or absurd period", async () => {
  await assert.rejects(buildMenuPlan("x", "2027-07-31", "2027-07-19"), /Zeitraum/);
});
