import { test } from "node:test";
import assert from "node:assert/strict";
import { canCook, canManageRoles, canReview, isKitchenCategory, kitchenBlocked, rolesOf } from "./roles.ts";

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

// the categories of the Lagerbudget template (sheet "Berechnung"): "Section: Item"
const TEMPLATE = ["Rekognoszierung: Reise, Verpflegung", "Rekognoszierung: weiteres", "Unterkunft: Miete Haus/Zeltplatz", "Unterkunft: Nebenkosten (Strom, Holz, Heizung usw.)", "Unterkunft: Kurtaxe", "Unterkunft: weiteres", "Unterkunft: Beschädigungen (z.B. Geschirr)\nca. 2% der Miete", "Verpflegung: Verpflegungskosten", "Verpflegung: weiteres", "Reise&Transport: Kollektivbillett", "Reise&Transport: J&S Material", "Reise&Transport: Materialtransport, Chauffeur", "Reise&Transport: weiteres", "Programm: Programm-Abend vor Lager", "Programm: Benützungsgebühren für Turnhallen usw.", "Programm: Ausflüge", "Programm: Preise für Wettbewerbe", "Programm: weiteres", "Material: Verbrauchsmaterial", "Material: Spiel- und Bastelmaterial", "Material: Apotheke", "Material: Reparaturen und Ersatz", "Material: weiteres", "Organisation: Porti, Telefonspesen", "Organisation: Fotokopien usw.", "Organisation: Spesen Leitungsteam/Küche", "Organisation: Geschenke, Trinkgelder", "Organisation: weiteres", "Lagerauswertung: Elternabend", "Lagerauswertung: Abschlussabend des Leitungsteams", "Lagerauswertung: weiteres", "Einnahmen: Total Lagerbeitrag", "Einnahmen: Total Präventionsbeitrag", "Einnahmen: Finanzaktionen", "Einnahmen: Spenden", "Einnahmen: weiteres"];

test("isKitchenCategory: in the template only the Verpflegung section is the kitchen's", () => {
  assert.deepEqual(TEMPLATE.filter(isKitchenCategory), ["Verpflegung: Verpflegungskosten", "Verpflegung: weiteres"]);
});

test("isKitchenCategory: names without a section match whole words", () => {
  for (const c of ["Ausgaben - Essen", "Küche", "Ausgaben - Lebensmittel", "Ku\u0308che"]) assert.equal(isKitchenCategory(c), true, c);
  for (const c of ["Ausgaben - Höcks", "Ausgaben - Miete", "Programm Essensausflug", "Interessen"]) assert.equal(isKitchenCategory(c), false, c);
});

test("kitchenBlocked: outsiders can neither write nor overwrite kitchen bookings", () => {
  assert.equal(kitchenBlocked(false, "Verpflegung: weiteres"), true);
  assert.equal(kitchenBlocked(false, "Material: weiteres", "Verpflegung: weiteres"), true); // kitchen → other
  assert.equal(kitchenBlocked(false, "Verpflegung: weiteres", "Material: weiteres"), true); // other → kitchen
  assert.equal(kitchenBlocked(false, "Material: weiteres", "Programm: weiteres"), false);
  assert.equal(kitchenBlocked(true, "Verpflegung: weiteres", "Verpflegung: weiteres"), false);
});
