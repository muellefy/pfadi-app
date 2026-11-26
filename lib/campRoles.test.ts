import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeRoleChange, changeRole, checkRoleEmail, mergeRoles } from "./campRoles.ts";

const lists = (hauptleitung: string[] = [], kueche: string[] = []) => ({ hauptleitung, kueche });

test("mergeRoles: camps.json and app lists together, lower-case, no duplicates", () => {
  assert.deepEqual(mergeRoles({ hauptleitung: ["A@pfadis.ch"] }, { hauptleitung: ["a@pfadis.ch ", "b@pfadis.ch"], kueche: ["k@pfadis.ch"] }),
    lists(["a@pfadis.ch", "b@pfadis.ch"], ["k@pfadis.ch"]));
  assert.deepEqual(mergeRoles({}), lists());
});

test("checkRoleEmail: only valid addresses of the allowed domain", () => {
  assert.equal(checkRoleEmail("kim@pfadis.ch", "pfadis.ch"), null);
  assert.equal(checkRoleEmail(" Kim@Pfadis.ch", "pfadis.ch"), null);
  assert.match(checkRoleEmail("kim@gmail.com", "pfadis.ch") ?? "", /@pfadis\.ch/);
  assert.match(checkRoleEmail("kim", "pfadis.ch") ?? "", /E-Mail/);
  assert.match(checkRoleEmail("a b@pfadis.ch", "pfadis.ch") ?? "", /E-Mail/);
});

test("changeRole: adds to the app's list", () => {
  const r = changeRole(lists(), lists(), "kueche", "K@pfadis.ch", true);
  assert.deepEqual(r, { stored: lists([], ["k@pfadis.ch"]) });
});

test("changeRole: removes from the app's list", () => {
  const r = changeRole(lists(["a@pfadis.ch", "b@pfadis.ch"]), lists(), "hauptleitung", "a@pfadis.ch", false);
  assert.deepEqual(r, { stored: lists(["b@pfadis.ch"]) });
});

test("changeRole: someone listed in camps.json can't be removed in the app", () => {
  const r = changeRole(lists(), lists([], ["k@pfadis.ch"]), "kueche", "k@pfadis.ch", false);
  assert.ok("error" in r && /camps\.json/.test(r.error));
});

test("changeRole: the last Hauptleitung stays", () => {
  const r = changeRole(lists(["a@pfadis.ch"]), lists(), "hauptleitung", "a@pfadis.ch", false);
  assert.ok("error" in r && /letzte Hauptleitung/.test(r.error));
});

const who = (r: Partial<{ al: boolean; coach: boolean; hauptleitung: boolean; kueche: boolean }>) => ({ al: false, coach: false, hauptleitung: false, kueche: false, ...r });

test("authorizeRoleChange: only this camp's Hauptleitung and the AL", () => {
  assert.equal(authorizeRoleChange(who({ hauptleitung: true }), "kueche", "k@pfadis.ch", true, "pfadis.ch"), null);
  assert.equal(authorizeRoleChange(who({ al: true }), "hauptleitung", "h@pfadis.ch", true, "pfadis.ch"), null);
  for (const r of [who({}), who({ kueche: true }), who({ coach: true })]) {
    assert.match(authorizeRoleChange(r, "kueche", "k@pfadis.ch", true, "pfadis.ch") ?? "", /Hauptleitung/);
  }
});

test("authorizeRoleChange: unknown roles are refused, even for the AL", () => {
  for (const role of ["al", "coach", "__proto__", "constructor"]) {
    assert.match(authorizeRoleChange(who({ al: true }), role, "k@pfadis.ch", true, "pfadis.ch") ?? "", /Unbekannte Rolle/);
  }
});

test("authorizeRoleChange: added addresses must be of the domain", () => {
  assert.match(authorizeRoleChange(who({ al: true }), "kueche", "x@pfadis.ch.evil.com", true, "pfadis.ch") ?? "", /@pfadis\.ch/);
  assert.match(authorizeRoleChange(who({ al: true }), "kueche", "nope", true, "pfadis.ch") ?? "", /E-Mail/);
  // removing an odd old entry must stay possible
  assert.equal(authorizeRoleChange(who({ al: true }), "kueche", "nope", false, "pfadis.ch"), null);
});
