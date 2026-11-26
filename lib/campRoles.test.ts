import { test } from "node:test";
import assert from "node:assert/strict";
import { changeRole, checkRoleEmail, mergeRoles } from "./campRoles.ts";

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
