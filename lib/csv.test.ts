import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv.ts";

const body = (csv: string) => csv.replace(/^﻿/, "").split("\r\n");

test("toCsv: semicolon separated, quotes values with ; or quotes", () => {
  assert.deepEqual(body(toCsv(["Name", "Bemerkung"], [{ Name: "Mia", Bemerkung: 'a; "b"' }])), [
    "Name;Bemerkung",
    'Mia;"a; ""b"""',
  ]);
});

test("toCsv: values that Excel would run as a formula are made plain text", () => {
  const rows = [{ A: '=HYPERLINK("http://x","y")', B: "+41 79 123", C: "@SUM(1)", D: "-2+3" }];
  const [, line] = body(toCsv(["A", "B", "C", "D"], rows));
  assert.equal(line, `"'=HYPERLINK(""http://x"",""y"")";'+41 79 123;'@SUM(1);'-2+3`);
});
