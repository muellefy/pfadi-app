import { test } from "node:test";
import assert from "node:assert/strict";
import { canManageRoles, canReview, rolesOf } from "./roles.ts";

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
