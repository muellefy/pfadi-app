import { test } from "node:test";
import assert from "node:assert/strict";
import { canCook, canManageRoles, canReview, isKitchenCategory, rolesOf } from "./roles.ts";

const none = { al: false, coach: false, hauptleitung: false, kueche: false };

test("rolesOf: matches emails regardless of case and spaces", () => {
  assert.deepEqual(rolesOf("AL@Pfadis.ch ", { al: ["al@pfadis.ch"], coach: [] }), { ...none, al: true });
});

test("rolesOf: no email, no role", () => {
  assert.deepEqual(rolesOf(undefined, { al: ["x@pfadis.ch"], coach: ["x@pfadis.ch"] }, { hauptleitung: ["x@pfadis.ch"], kueche: ["x@pfadis.ch"] }), none);
});

test("rolesOf: list entries are trimmed and lower-cased too", () => {
  assert.equal(rolesOf("c@pfadis.ch", { al: [], coach: [" C@pfadis.ch"] }).coach, true);
});

test("rolesOf: Hauptleitung only counts for the camp that lists the person", () => {
  const lists = { al: [], coach: [] };
  assert.equal(rolesOf("hl@pfadis.ch", lists, { hauptleitung: ["HL@pfadis.ch"], kueche: [] }).hauptleitung, true);
  assert.equal(rolesOf("hl@pfadis.ch", lists, { hauptleitung: ["other@pfadis.ch"], kueche: [] }).hauptleitung, false);
  assert.equal(rolesOf("hl@pfadis.ch", lists).hauptleitung, false);
});

test("canReview: AL, Coach and the camp's Hauptleitung see eCamp block contents", () => {
  assert.equal(canReview(none), false);
  assert.equal(canReview({ ...none, al: true }), true);
  assert.equal(canReview({ ...none, coach: true }), true);
  assert.equal(canReview({ ...none, hauptleitung: true }), true);
});

test("rolesOf: Küche of the camp", () => {
  assert.equal(rolesOf("k@pfadis.ch", { al: [], coach: [] }, { hauptleitung: [], kueche: ["k@pfadis.ch"] }).kueche, true);
});

test("canManageRoles: the camp's Hauptleitung and the AL, nobody else", () => {
  assert.equal(canManageRoles({ ...none, hauptleitung: true }), true);
  assert.equal(canManageRoles({ ...none, al: true }), true);
  assert.equal(canManageRoles({ ...none, coach: true }), false);
  assert.equal(canManageRoles({ ...none, kueche: true }), false);
});

test("canCook: without a Küche team everyone may edit the kitchen as before", () => {
  assert.equal(canCook(none, { kueche: [] }), true);
});

test("canCook: with a Küche team only Küche, Hauptleitung and AL", () => {
  const camp = { kueche: ["k@pfadis.ch"] };
  assert.equal(canCook(none, camp), false);
  assert.equal(canCook({ ...none, coach: true }, camp), false);
  assert.equal(canCook({ ...none, kueche: true }, camp), true);
  assert.equal(canCook({ ...none, hauptleitung: true }, camp), true);
  assert.equal(canCook({ ...none, al: true }, camp), true);
});

test("isKitchenCategory: food categories only", () => {
  for (const c of ["Ausgaben - Essen", "Ausgaben - Küche", "Verpflegung", "Ausgaben - Lebensmittel"]) assert.equal(isKitchenCategory(c), true, c);
  for (const c of ["Ausgaben - Höcks", "Ausgaben - Miete", "Einnahmen - Lagerbeiträge", "Interessen"]) assert.equal(isKitchenCategory(c), false, c);
});
