import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDays, gapsOf, htmlToText, type BlockContent } from "./coach.ts";
import type { EcampEntry } from "./data/ecamp";

const entry = (start: string, end: string, categoryShort = "LS", movementMin?: number): EcampEntry => ({
  id: start, start, end, title: "Block", location: "", category: categoryShort, categoryShort, color: "#000", url: "", movementMin,
});
const at = (day: number, hm: string) => `2027-07-${String(day).padStart(2, "0")}T${hm}:00+02:00`;
const empty: BlockContent = { goals: "", safety: "", story: "", notes: "", topics: "", storyboard: [], material: [], characteristics: [] };

test("htmlToText: plain text with lines, entities decoded, scripts dropped", () => {
  assert.equal(htmlToText("<p>A &amp; B</p><ul><li>x</li><li>y</li></ul><script>bad()</script>"), "A & B\nx\ny");
});

test("htmlToText: empty and whitespace-only html give an empty string", () => {
  assert.equal(htmlToText(""), "");
  assert.equal(htmlToText("<p>&nbsp;</p>"), "");
});

test("gapsOf: a short J+S block without content has every gap", () => {
  const gaps = gapsOf(entry(at(20, "09:00"), at(20, "09:20")), undefined);
  for (const g of ["keine Sicherheitsüberlegungen", "keine Ziele", "keine Bewegungszeit", "kürzer als 30 Min."]) assert.ok(gaps.includes(g as never), g);
});

test("gapsOf: an LP block only needs safety notes and goals", () => {
  assert.deepEqual(gapsOf(entry(at(20, "09:00"), at(20, "09:20"), "LP"), empty), ["keine Sicherheitsüberlegungen", "keine Ziele"]);
});

test("gapsOf: a complete J+S block has no gaps", () => {
  assert.deepEqual(gapsOf(entry(at(20, "09:00"), at(20, "10:00"), "LS", 45), { ...empty, goals: "x", safety: "y" }), []);
});

test("checkDays: a full middle day passes", () => {
  const days = checkDays([
    entry(at(19, "10:00"), at(19, "11:00"), "LS", 30), entry(at(19, "19:00"), at(19, "20:00"), "LS", 30),
    entry(at(20, "09:00"), at(20, "11:00"), "LS", 90), entry(at(20, "14:00"), at(20, "16:30"), "LS", 60),
    entry(at(21, "10:00"), at(21, "11:00"), "LS", 30), entry(at(21, "14:00"), at(21, "15:00"), "LS", 30),
  ]);
  const mid = days[1];
  assert.equal(mid.date, "2027-07-20");
  assert.equal(mid.jsMinutes, 270);
  assert.equal(mid.movementMin, 150);
  assert.deepEqual(mid.parts, ["Vormittag", "Nachmittag"]);
  assert.equal(mid.ok, true);
});

test("checkDays: a middle day with only a morning block fails", () => {
  const days = checkDays([entry(at(19, "09:00"), at(19, "10:00")), entry(at(20, "09:00"), at(20, "11:00"), "LS", 90), entry(at(21, "09:00"), at(21, "10:00"))]);
  assert.equal(days[1].ok, false);
});

test("checkDays: LP blocks don't count as J+S time", () => {
  const days = checkDays([entry(at(20, "09:00"), at(20, "11:00"), "LS", 60), entry(at(20, "14:00"), at(20, "16:00"), "LP")]);
  assert.equal(days[0].jsMinutes, 120);
});

test("checkDays: a block from 17:00 to 19:00 touches afternoon and evening", () => {
  assert.deepEqual(checkDays([entry(at(20, "17:00"), at(20, "19:00"), "LS", 60)])[0].parts, ["Nachmittag", "Abend"]);
});

test("checkDays: a block over midnight counts fully on the day it starts", () => {
  const days = checkDays([entry(at(20, "22:00"), at(21, "00:30"), "LS", 30)]);
  assert.equal(days.length, 1);
  assert.equal(days[0].jsMinutes, 150);
});

test("checkDays: first and last day are checked together", () => {
  const days = checkDays([
    entry(at(19, "09:00"), at(19, "11:00"), "LS", 60),
    entry(at(20, "09:00"), at(20, "11:00"), "LS", 90), entry(at(20, "14:00"), at(20, "16:00"), "LS", 60),
    entry(at(21, "14:00"), at(21, "16:00"), "LS", 60),
  ]);
  assert.equal(days[0].ok, true);
  assert.equal(days[2].mergedWithFirst, true);
});

test("checkDays: no entries, no days", () => {
  assert.deepEqual(checkDays([]), []);
});
