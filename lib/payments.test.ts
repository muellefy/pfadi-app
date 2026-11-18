import { test } from "node:test";
import assert from "node:assert/strict";
import type { Budget, Booking } from "./budget.ts";
import { beitragOf, paymentOf, paymentText } from "./payments.ts";

const cell = (value: number) => ({ ref: "C30", value, money: true });
const budget = (rows: Budget["rows"], categories: string[]) => ({ rows, categories }) as Budget;
const booking = (text: string, category: string): Booking => ({ row: 5, nr: "1", date: null, text, category, income: 90, expense: null });

test("beitragOf: finds category and rate, Lager- and Leiterbeitrag kept apart", () => {
  const b = budget(
    [
      { row: 30, label: "Lagerbeiträge TN", kind: "line", rate: cell(90) },
      { row: 31, label: "Leiterbeiträge", kind: "line", rate: cell(40) },
    ],
    ["Ausgaben - Miete", "Einnahmen - Lagerbeiträge", "Einnahmen - Leiterbeiträge"],
  );
  assert.deepEqual(beitragOf(b, "tn"), { category: "Einnahmen - Lagerbeiträge", rate: 90 });
  assert.deepEqual(beitragOf(b, "leiter"), { category: "Einnahmen - Leiterbeiträge", rate: 40 });
});

test("beitragOf: no Leiterbeitrag in the budget (or 0 CHF) means null", () => {
  const cats = ["Einnahmen - Lagerbeiträge", "Einnahmen - Leiterbeiträge"];
  assert.equal(beitragOf(budget([{ row: 30, label: "Lagerbeiträge TN", kind: "line", rate: cell(90) }], cats), "leiter"), null);
  assert.equal(beitragOf(budget([{ row: 31, label: "Leiterbeiträge", kind: "line", rate: cell(0) }], cats), "leiter"), null);
});

test("paymentOf: whole name in the text of a booking of that category", () => {
  const cat = "Einnahmen - Lagerbeiträge";
  const list = [booking("Lagerbeitrag Mia Müller", cat), booking("Mia Muster Ausflug", "Einnahmen - Spenden")];
  assert.equal(paymentOf(list, cat, "mia muller")?.text, "Lagerbeitrag Mia Müller");
  assert.equal(paymentOf(list, cat, "Mia Muster"), undefined); // other category
  assert.equal(paymentOf([booking("LB Miami", cat)], cat, "Mia"), undefined); // whole words only
  assert.equal(paymentOf(list, cat, ""), undefined);
  assert.equal(paymentText("leiter", "Kiwi"), "Leiterbeitrag Kiwi");
});
