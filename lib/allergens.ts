import { dishesIn, type Ingredient } from "./shopping.ts";
import type { MenuPlan } from "./menu.ts";

/**
 * Diets and allergies the kitchen plans around: how a note in the TN/Leiter list names
 * them, and which food clashes. Plain word lists, so they only catch the usual cases;
 * the kitchen still reads the notes themselves.
 */
const MEAT = /fleisch|ghackt|gehackt|speck|wurst|würst|schinken|poulet|huhn|hähnchen|rind|schwein|kalb|lamm|cervelat|salami|wienerli|landjäger|fisch|thon|lachs|crevette/i;
const DAIRY = /milch|käse|kaese|rahm|butter|joghurt|jogurt|quark|mascarpone|mozzarella|parmesan|sbrinz|raclette|fondue/i;

export const ALLERGENS = [
  { label: "vegetarisch", note: /vegetar|vegi\b|veggie|kein fleisch/i, food: MEAT },
  { label: "vegan", note: /vegan/i, food: new RegExp(`${MEAT.source}|${DAIRY.source}|eier|spiegelei|rührei|omelett|\\bei\\b|honig`, "i") },
  { label: "laktosefrei", note: /laktose|lactose|milch/i, food: DAIRY },
  { label: "glutenfrei", note: /gluten|zöliak|zoeliak|celiac/i, food: /mehl|brot|zopf|teigwaren|pasta|spaghetti|hörnli|magronen|penne|nudel|lasagne|couscous|weizen|dinkel|gerste|paniert|wähe|kuchen|guetzli/i },
  { label: "Nüsse", note: /nuss|nüsse|nuesse/i, food: /nuss|nüsse|mandel|pesto|cashew|pistazie|nutella|marzipan/i },
  { label: "Eier", note: /\beier?\b|eiallerg|ei-allerg/i, food: /eier|\bei\b|spiegelei|rührei|omelett|mayo/i },
  { label: "kein Schwein", note: /schwein|pork/i, food: /schwein|speck|schinken|cervelat|salami|wienerli|bratwurst|landjäger/i },
] as const;

/** The common diets a person's note names. */
export const dietLabels = (note: string) => ALLERGENS.filter((a) => a.note.test(note)).map((a) => a.label);

const ALLERGY_NOTE = /allerg|unverträg|unvertraeg|intoleran/i;
const NOT_FOOD = /^(allergie|allergien|allergisch|unverträglichkeit|intoleranz|gegen|keine|kein|leichte|starke|schwere|bitte|nicht)$/i;

/**
 * Why `food` is a problem for someone with this note: the diets it breaks, plus, for an allergy
 * the list doesn't know ("Allergie: Sellerie"), each word of the note that the food names.
 */
export function clashes(note: string, food: string): string[] {
  const known = ALLERGENS.filter((a) => a.note.test(note) && a.food.test(food)).map((a) => a.label);
  if (!ALLERGY_NOTE.test(note)) return known;
  const lower = food.toLowerCase();
  const words = note.split(/[^\p{L}]+/u).filter((w) => w.length >= 4 && !NOT_FOOD.test(w) && !ALLERGENS.some((a) => a.note.test(w)));
  return [...known, ...words.filter((w) => lower.includes(w.toLowerCase()))];
}

export type MealWarning = { date: string; meal: string; text: string; people: { name: string; why: string[] }[] };

/** Every planned meal that clashes with someone's note, judged by the meal text and its recipes' ingredients. */
export function mealWarnings(plan: MenuPlan, recipes: Ingredient[], people: { name: string; hints: string[] }[]): MealWarning[] {
  if (!people.length) return [];
  return plan.days.flatMap((day) => day.meals.flatMap((cell, i) => {
    if (!cell.text.trim()) return [];
    const dishes = dishesIn(cell.text, recipes);
    const food = [cell.text, ...recipes.filter((r) => dishes.includes(r.dish)).map((r) => r.item)].join(" ");
    const hit = people.flatMap((p) => {
      const why = [...new Set(p.hints.flatMap((h) => clashes(h, food)))];
      return why.length ? [{ name: p.name, why }] : [];
    });
    return hit.length ? [{ date: day.date, meal: plan.columns[i] ?? "", text: cell.text, people: hit }] : [];
  }));
}
