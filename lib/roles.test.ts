import { test } from "node:test";
import assert from "node:assert/strict";
import { rolesOf } from "./roles.ts";

test("rolesOf: matches emails regardless of case and spaces", () => {
  assert.deepEqual(rolesOf("AL@Pfadis.ch ", { al: ["al@pfadis.ch"], coach: [] }), { al: true, coach: false });
});

test("rolesOf: no email, no role", () => {
  assert.deepEqual(rolesOf(undefined, { al: ["x@pfadis.ch"], coach: ["x@pfadis.ch"] }), { al: false, coach: false });
});

test("rolesOf: list entries are trimmed and lower-cased too", () => {
  assert.equal(rolesOf("c@pfadis.ch", { al: [], coach: [" C@pfadis.ch"] }).coach, true);
});
