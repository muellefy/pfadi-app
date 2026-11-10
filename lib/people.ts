import "server-only";
import type { Grid } from "./grid";

export type PersonTable = {
  columns: string[];
  rows: Record<string, string>[];
  roles: {
    vorname?: string; nachname?: string; pfadiname?: string; stufe?: string;
    geburtsdatum?: string; hinweise: string[]; telefon?: string; email?: string;
  };
};

const ROLE_PATTERNS: [keyof Omit<PersonTable["roles"], "hinweise">, RegExp][] = [
  ["pfadiname", /pfadi.?name|übername|uebername|vulgo|^v\/o$|nickname|spitzname/i],
  ["vorname", /^vorname|first.?name/i],
  ["nachname", /^(nach)?name$|^nachname|last.?name|familienname/i],
  ["stufe", /stufe|einheit|gruppe|abteilung|^rolle$|^role$/i],
  ["geburtsdatum", /geburt|birth|jahrgang/i],
  ["telefon", /tel|natel|handy|mobile|phone/i],
  ["email", /mail/i],
];
const HINWEIS = /allerg|medi|krank|unverträg|unvertraeg|diät|diaet|vegi|vegan|ernährung|ernaehrung|besonder|bemerk|gesundheit|essen/i;

/** Turns any TN/Leiter export (MiData CSV, Anmeldeformular xlsx, …) into records. */
export function parsePeople(grid: Grid): PersonTable {
  const headerIdx = grid.slice(0, 15).findIndex((r) => r.filter(Boolean).length >= 3);
  if (headerIdx < 0) return { columns: [], rows: [], roles: { hinweise: [] } };
  const seen = new Map<string, number>();
  const columns = grid[headerIdx].map((c, i) => {
    const base = c || `Spalte ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  const rows = grid
    .slice(headerIdx + 1)
    .filter((r) => r.filter(Boolean).length >= 2)
    .map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ""])));

  const roles: PersonTable["roles"] = { hinweise: columns.filter((c) => HINWEIS.test(c)) };
  for (const [role, re] of ROLE_PATTERNS) {
    const hit = columns.find((c) => re.test(c) && !Object.values(roles).includes(c));
    if (hit) roles[role] = hit;
  }
  // keep only columns that actually contain something
  const used = columns.filter((c) => rows.some((r) => r[c]));
  return { columns: used, rows, roles };
}
