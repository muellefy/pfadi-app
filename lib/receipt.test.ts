import { test } from "node:test";
import assert from "node:assert/strict";
import { receiptName } from "./receipt.ts";

test("receiptName: date, text and the file's extension in lower case", () => {
  assert.equal(receiptName("2027-07-20", "Einkauf Landi", "IMG_1234.JPG"), "Beleg 2027-07-20 Einkauf Landi.jpg");
});

test("receiptName: slashes and backslashes become spaces", () => {
  assert.equal(receiptName("2027-07-20", "a/b\\c", "x.pdf"), "Beleg 2027-07-20 a b c.pdf");
});

test("receiptName: no extension, none added", () => {
  assert.equal(receiptName("2027-07-20", "Bon", "scan"), "Beleg 2027-07-20 Bon");
});

test("receiptName: long text is cut to 80 characters", () => {
  assert.equal(receiptName("2027-07-20", "x".repeat(200), "a.png"), `Beleg 2027-07-20 ${"x".repeat(80)}.png`);
});
