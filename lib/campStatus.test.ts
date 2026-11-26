import { test } from "node:test";
import assert from "node:assert/strict";
import { campStatus } from "./campStatus.ts";
import type { TermineSheet, Termin } from "./termine";
import type { Budget } from "./budget";
import type { DayCheck } from "./coach";

const termin = (status: Termin["status"]): Termin =>
  ({ row: 1, section: "", date: null, dateLabel: "", was: "x", wer: "", anWen: "", erledigt: status === "erledigt", status });
const day = (ok: boolean, mergedWithFirst?: boolean): DayCheck =>
  ({ date: "2027-07-20", jsMinutes: 0, movementMin: 0, parts: [], ok, entries: [], mergedWithFirst });

test("campStatus: nothing loaded, nothing known", () => {
  assert.deepEqual(campStatus({}), { overdue: null, tn: null, balancePlan: null, balanceActual: null, failedDays: null });
});

test("campStatus: counts overdue Termine only", () => {
  const termine: TermineSheet = { meta: {}, erledigtCol: 3, termine: [termin("ueberfaellig"), termin("ueberfaellig"), termin("erledigt"), termin("bald")] };
  assert.equal(campStatus({ termine }).overdue, 2);
});

test("campStatus: failed days, the merged last day not counted twice", () => {
  assert.equal(campStatus({ days: [day(false), day(true), day(false, true)] }).failedDays, 1);
});

test("campStatus: budget balances and TN count are passed through", () => {
  const budget = { summary: { balancePlan: -100, balanceActual: 50 } } as Budget;
  const s = campStatus({ budget, tn: 23 });
  assert.equal(s.balancePlan, -100);
  assert.equal(s.balanceActual, 50);
  assert.equal(s.tn, 23);
});
