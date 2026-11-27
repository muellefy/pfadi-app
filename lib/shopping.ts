import type { Grid } from "./grid.ts";
import type { MenuPlan } from "./menu.ts";

/**
 * The Einkaufsliste: the «Rezepte» sheet of the Menüplan lists each dish's ingredients
 * per person; every planned meal that names a dish adds those amounts × headcount.
 */
export const RECIPES_SHEET = "Rezepte";

export type Ingredient = { dish: string; item: string; perPerson: number; unit: string };
export type ShoppingItem = { item: string; unit: string; amount: number };

/** Reads rows below a header with «Gericht» and «Zutat». A blank Gericht repeats the one above. */
export function parseRecipes(grid: Grid): Ingredient[] {
  const headerIdx = grid.findIndex((row) => row.some((c) => /^gericht$/i.test(c)));
  if (headerIdx < 0) return [];
  const head = grid[headerIdx];
  const col = (re: RegExp) => head.findIndex((c) => re.test(c));
  const [dishCol, itemCol, amountCol, unitCol] = [col(/^gericht$/i), col(/^zutat/i), col(/^menge/i), col(/^einheit$/i)];
  if (itemCol < 0 || amountCol < 0) return [];
  let dish = "";
  return grid.slice(headerIdx + 1).flatMap((row) => {
    dish = row[dishCol] || dish;
    const item = row[itemCol];
    const perPerson = Number((row[amountCol] ?? "").replace(/['’\s]/g, "").replace(",", "."));
    if (!dish || !item || !(perPerson > 0)) return [];
    return [{ dish, item, perPerson, unit: (unitCol >= 0 && row[unitCol]) || "" }];
  });
}

/** The recipes a meal names: every dish whose name the meal text contains. */
export function dishesIn(meal: string, recipes: Ingredient[]): string[] {
  const text = meal.toLowerCase();
  return [...new Set(recipes.map((r) => r.dish))].filter((d) => text.includes(d.toLowerCase()));
}

/**
 * Sums the ingredients of every planned meal for `people`. A meal matches each dish whose
 * name it contains, so «Älplermagronen mit Apfelmus» picks up both recipes.
 * shortcut: plain substring match («Reis» also hits «Reissalat»), use exact names if that bites.
 */
export function shoppingList(plan: MenuPlan, recipes: Ingredient[], people: number) {
  const totals = new Map<string, ShoppingItem>();
  const missing = new Set<string>();
  for (const meal of plan.days.flatMap((d) => d.meals)) {
    if (!meal.text) continue;
    const hits = dishesIn(meal.text, recipes);
    if (!hits.length) missing.add(meal.text);
    for (const r of recipes.filter((r) => hits.includes(r.dish))) {
      const key = `${r.item.toLowerCase()}|${r.unit.toLowerCase()}`;
      const entry = totals.get(key) ?? { item: r.item, unit: r.unit, amount: 0 };
      entry.amount += r.perPerson * people;
      totals.set(key, entry);
    }
  }
  const items = [...totals.values()].sort((a, b) => a.item.localeCompare(b.item, "de"));
  return { items, missing: [...missing] };
}
