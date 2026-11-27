import { test } from "node:test";
import assert from "node:assert/strict";
import { clashes, dietLabels, mealWarnings } from "./allergens.ts";
import { parseRecipes } from "./shopping.ts";
import type { MenuPlan } from "./menu.ts";

test("dietLabels: names the common diets in a person's note", () => {
  assert.deepEqual(dietLabels("Vegi, Nussallergie"), ["vegetarisch", "Nüsse"]);
  assert.deepEqual(dietLabels("keine"), []);
});

test("clashes: a known diet against the food", () => {
  assert.deepEqual(clashes("Vegi", "Spaghetti Bolognese mit Hackfleisch"), ["vegetarisch"]);
  assert.deepEqual(clashes("Laktoseintoleranz", "Älplermagronen Käse Rahm"), ["laktosefrei"]);
  assert.deepEqual(clashes("Zöliakie", "Pesto Pasta"), ["glutenfrei"]);
  assert.deepEqual(clashes("Erdnussallergie", "Pasta mit Pesto"), ["Nüsse"]);
  assert.deepEqual(clashes("vegan", "Rösti mit Spiegelei"), ["vegan"]);
  assert.deepEqual(clashes("Vegi", "Rösti mit Spiegelei"), []);
});

test("clashes: an allergy the list doesn't know matches the named food itself", () => {
  assert.deepEqual(clashes("Allergie: Sellerie, Kiwi", "Gemüsesuppe Sellerie Rüebli"), ["Sellerie"]);
  assert.deepEqual(clashes("Allergie: Sellerie", "Hörnli mit Ghacktem"), []);
});

test("clashes: notes that aren't about food don't match by word", () => {
  assert.deepEqual(clashes("Medikamente: Ritalin morgens", "Birchermüesli morgens"), []);
});

const recipes = parseRecipes([
  ["Gericht", "Zutat", "Menge pro Person", "Einheit"],
  ["Pesto Pasta", "Spaghetti", "120", "g"],
  ["", "Pesto", "30", "g"],
  ["Gemüsesuppe", "Rüebli", "100", "g"],
]);
const plan: MenuPlan = {
  columns: ["Zmittag", "Znacht"], hasNotes: false,
  days: [
    { row: 5, date: "2027-07-19", meals: [{ ref: "C5", text: "Pesto Pasta" }, { ref: "D5", text: "Gemüsesuppe" }] },
    { row: 6, date: "2027-07-20", meals: [{ ref: "C6", text: "Cervelat vom Feuer" }, { ref: "D6", text: "" }] },
  ],
};

test("mealWarnings: names each affected meal with who and why, from the meal text and its recipe", () => {
  const people = [{ name: "Fuchs", hints: ["Nussallergie"] }, { name: "Luchs", hints: ["Vegi"] }, { name: "Biber", hints: ["Zöliakie"] }];
  assert.deepEqual(mealWarnings(plan, recipes, people), [
    { date: "2027-07-19", meal: "Zmittag", text: "Pesto Pasta", people: [{ name: "Fuchs", why: ["Nüsse"] }, { name: "Biber", why: ["glutenfrei"] }] },
    { date: "2027-07-20", meal: "Zmittag", text: "Cervelat vom Feuer", people: [{ name: "Luchs", why: ["vegetarisch"] }] },
  ]);
});

test("mealWarnings: nobody with notes, no warnings", () => {
  assert.deepEqual(mealWarnings(plan, recipes, []), []);
});
