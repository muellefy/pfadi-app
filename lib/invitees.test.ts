import { test } from "node:test";
import assert from "node:assert/strict";
import { invitees } from "./invitees.ts";

const ctx = {
  al: ["al@pfadis.ch"], coach: ["coach@pfadis.ch"],
  hauptleitung: ["hl@pfadis.ch"], kueche: ["koch@pfadis.ch"], leiter: ["fuchs@pfadis.ch", "luchs@pfadis.ch"],
  people: [{ names: ["Fuchs", "Anna Muster"], email: "Fuchs@pfadis.ch" }, { names: ["Luchs"], email: "" }],
};

test("invitees: role words become the role's addresses", () => {
  assert.deepEqual(invitees("Coach", ctx), { emails: ["coach@pfadis.ch"], unknown: [] });
  assert.deepEqual(invitees("AL / Coach", ctx), { emails: ["al@pfadis.ch", "coach@pfadis.ch"], unknown: [] });
  assert.deepEqual(invitees("HL", ctx).emails, ["hl@pfadis.ch"]);
  assert.deepEqual(invitees("Lagerleitung", ctx).emails, ["hl@pfadis.ch"]);
  assert.deepEqual(invitees("Küche", ctx).emails, ["koch@pfadis.ch"]);
});

test("invitees: «alle» means every member of the camp", () => {
  assert.deepEqual(invitees("Alle", ctx).emails, ["hl@pfadis.ch", "koch@pfadis.ch", "fuchs@pfadis.ch", "luchs@pfadis.ch"]);
});

test("invitees: names from the Leiter list, addresses as written", () => {
  assert.deepEqual(invitees("Fuchs und anna muster, x@pfadis.ch", ctx), { emails: ["fuchs@pfadis.ch", "x@pfadis.ch"], unknown: [] });
});

test("invitees: names without an address and unknown words are reported", () => {
  assert.deepEqual(invitees("Luchs + Biber", ctx), { emails: [], unknown: ["Luchs", "Biber"] });
  assert.deepEqual(invitees("", ctx), { emails: [], unknown: [] });
});

test("invitees: «J+S-Coach» stays one word", () => {
  assert.deepEqual(invitees("J+S-Coach", ctx).emails, ["coach@pfadis.ch"]);
  assert.deepEqual(invitees("J+S Coach", ctx).emails, ["coach@pfadis.ch"]);
});
