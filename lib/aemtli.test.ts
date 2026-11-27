import { test } from "node:test";
import assert from "node:assert/strict";
import { campDays, parseAemtli, rotate, splitLines } from "./aemtli.ts";

const days = ["2027-07-19", "2027-07-20", "2027-07-21"];

test("rotate: every day each group moves on to the next Ämtli", () => {
  const plan = rotate(days, ["Abwaschen", "Holz", "WC"], ["Füchse", "Biber", "Luchse"]);
  assert.deepEqual(plan.map((d) => d.groups), [
    ["Füchse", "Biber", "Luchse"],
    ["Luchse", "Füchse", "Biber"],
    ["Biber", "Luchse", "Füchse"],
  ]);
});

test("rotate: over the camp every group does each Ämtli about equally often", () => {
  const groups = ["A", "B", "C", "D"];
  const plan = rotate([...days, "2027-07-22"], ["Abwaschen", "Holz"], groups);
  const count = (g: string, chore: number) => plan.filter((d) => d.groups[chore] === g).length;
  for (const g of groups) for (const c of [0, 1]) assert.equal(count(g, c), 1, `${g} ${c}`);
});

test("rotate: more Ämtli than groups gives a group several on the same day", () => {
  assert.deepEqual(rotate(days.slice(0, 1), ["a", "b", "c"], ["X", "Y"])[0].groups, ["X", "Y", "X"]);
});

test("rotate: nothing to share out, an empty plan", () => {
  assert.deepEqual(rotate(days, ["a"], []), []);
  assert.deepEqual(rotate(days, [], ["X"]), []);
});

test("campDays: every day from start to end", () => {
  assert.deepEqual(campDays("2027-07-30", "2027-08-01"), ["2027-07-30", "2027-07-31", "2027-08-01"]);
  assert.deepEqual(campDays("2027-07-30", undefined), ["2027-07-30"]);
  assert.deepEqual(campDays(undefined, undefined), []);
});

test("splitLines: trimmed, no blanks or doubles, capped", () => {
  assert.deepEqual(splitLines(" Abwaschen \n\nHolz\nabwaschen\n", 10), ["Abwaschen", "Holz"]);
  assert.equal(splitLines("a\nb\nc", 2).length, 2);
});

test("parseAemtli: reads the saved sheet back", () => {
  const plan = parseAemtli([
    ["Ämtliplan Sola 27"],
    [],
    ["Datum", "Tag", "Abwaschen", "Holz"],
    ["19.07.2027", "Mo", "Füchse", "Biber"],
    ["20.07.2027", "Di", "Biber", "Füchse"],
  ]);
  assert.deepEqual(plan, {
    chores: ["Abwaschen", "Holz"],
    days: [{ date: "2027-07-19", groups: ["Füchse", "Biber"] }, { date: "2027-07-20", groups: ["Biber", "Füchse"] }],
  });
});

test("buildAemtliXlsx: what the app saves, it reads back", async () => {
  const { buildAemtliXlsx } = await import("./aemtliXlsx.ts");
  const { toGrid } = await import("./grid.ts");
  const plan = { chores: ["Abwaschen", "Holz"], days: rotate(days.slice(0, 2), ["Abwaschen", "Holz"], ["Füchse", "Biber"]) };
  const grid = await toGrid({ buffer: await buildAemtliXlsx("Ämtliplan Sola", plan), format: "xlsx" });
  assert.deepEqual(parseAemtli(grid), plan);
});
