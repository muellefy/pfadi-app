import "server-only";
import type { PersonTable } from "./people";
import { ALLERGENS } from "./allergens.ts";

const NO_HINT = /^(-|keine?|nein|no|none|n\/a|0)$/i;

export type DietPerson = { name: string; list: string; hints: string[] };

/** Everyone with a filled-in Hinweis column (allergies, diet …), for the kitchen. */
export function dietHints(table: PersonTable, list: string): DietPerson[] {
  const { roles } = table;
  return table.rows.flatMap((r) => {
    const hints = roles.hinweise.map((c) => r[c]?.trim()).filter((v): v is string => Boolean(v) && !NO_HINT.test(v!));
    if (!hints.length) return [];
    const name = (roles.pfadiname && r[roles.pfadiname]) || [roles.vorname && r[roles.vorname], roles.nachname && r[roles.nachname]].filter(Boolean).join(" ") || "(ohne Namen)";
    return [{ name, list, hints }];
  });
}

/** How many people need each common diet, counted from their hints. */
export function dietCounts(people: DietPerson[]) {
  return ALLERGENS.map(({ label, note }) => ({ label, count: people.filter((p) => p.hints.some((h) => note.test(h))).length })).filter((d) => d.count);
}
