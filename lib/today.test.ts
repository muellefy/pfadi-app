import { test } from "node:test";
import assert from "node:assert/strict";
import { campDay, entriesOn, shiftDay, zurichDay } from "./today.ts";

test("zurichDay: the calendar day in Switzerland, also late in the evening", () => {
  assert.equal(zurichDay(new Date("2027-07-19T22:30:00Z")), "2027-07-20"); // 00:30 in summer time
  assert.equal(zurichDay(new Date("2027-07-19T10:00:00Z")), "2027-07-19");
});

test("shiftDay: next and previous day across a month end", () => {
  assert.equal(shiftDay("2027-07-31", 1), "2027-08-01");
  assert.equal(shiftDay("2027-08-01", -1), "2027-07-31");
});

test("campDay: during the camp it's today", () => {
  assert.deepEqual(campDay("2027-07-21", "2027-07-19", "2027-07-31"), { day: "2027-07-21", when: "during" });
});

test("campDay: before the camp the first day, after it the last", () => {
  assert.deepEqual(campDay("2027-07-01", "2027-07-19", "2027-07-31"), { day: "2027-07-19", when: "before" });
  assert.deepEqual(campDay("2027-08-05", "2027-07-19", "2027-07-31"), { day: "2027-07-31", when: "after" });
});

test("campDay: an asked-for day wins, and without camp dates it's just today", () => {
  assert.deepEqual(campDay("2027-07-21", "2027-07-19", "2027-07-31", "2027-07-25"), { day: "2027-07-25", when: "during" });
  assert.deepEqual(campDay("2027-07-21", undefined, undefined), { day: "2027-07-21", when: "during" });
  assert.deepEqual(campDay("2027-07-21", "2027-07-19", "2027-07-31", "kaputt"), { day: "2027-07-21", when: "during" });
});

test("entriesOn: the blocks that start on that Swiss day", () => {
  const e = (start: string) => ({ start, title: start });
  const list = [e("2027-07-19T06:00:00+00:00"), e("2027-07-19T22:30:00+00:00"), e("2027-07-20T08:00:00+00:00")];
  assert.deepEqual(entriesOn(list, "2027-07-19").map((x) => x.start), ["2027-07-19T06:00:00+00:00"]);
  assert.deepEqual(entriesOn(list, "2027-07-20").map((x) => x.start), ["2027-07-19T22:30:00+00:00", "2027-07-20T08:00:00+00:00"]);
});
