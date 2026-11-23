import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecipes, shoppingList } from "./shopping.ts";
import type { MenuPlan } from "./menu.ts";

const recipes = parseRecipes([
  ["Gericht", "Zutat", "Menge pro Person", "Einheit"],
  ["Älplermagronen", "Hörnli", "120", "g"],
  ["", "Käse", "0,05", "kg"],
  ["Apfelmus", "Äpfel", "150", "g"],
  ["Spaghetti", "Spaghetti", "", "g"],
]);

const plan = (...texts: string[]): MenuPlan => ({
  columns: ["Znacht"], hasNotes: false,
  days: texts.map((text, i) => ({ row: i + 5, date: "2027-07-19", meals: [{ ref: `F${i + 5}`, text }] })),
});

test("parseRecipes fills down the dish and skips rows without an amount", () => {
  assert.deepEqual(recipes.map((r) => [r.dish, r.item, r.perPerson]), [
    ["Älplermagronen", "Hörnli", 120], ["Älplermagronen", "Käse", 0.05], ["Apfelmus", "Äpfel", 150],
  ]);
});

test("shoppingList multiplies by people, sums repeated dishes and lists meals without a recipe", () => {
  const { items, missing } = shoppingList(plan("Älplermagronen mit Apfelmus", "älplermagronen", "Hot Dogs", ""), recipes, 10);
  assert.deepEqual(items.map((i) => [i.item, Math.round(i.amount * 100) / 100, i.unit]), [
    ["Äpfel", 1500, "g"], ["Hörnli", 2400, "g"], ["Käse", 1, "kg"],
  ]);
  assert.deepEqual(missing, ["Hot Dogs"]);
});
