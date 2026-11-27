import { parseSwissDate } from "./dates.ts";
import type { Grid } from "./grid.ts";

/**
 * The Ämtliplan: which group does which chore on which camp day. Groups rotate one step
 * per day, so over the camp each group gets each Ämtli about equally often.
 */
export const AEMTLI_FILE = /ämtli|aemtli/i;
export const DEFAULT_CHORES = ["Abwaschen", "Tisch decken & abräumen", "Feuerholz & Wasser", "WC & Waschplatz", "Küchenhilfe"];

/** at most this many Ämtli and groups: a camp has a handful of each */
export const MAX_LINES = 20;

export type AemtliDay = { date: string; groups: string[] };
export type AemtliPlan = { chores: string[]; days: AemtliDay[] };

/** Day d, Ämtli i goes to group (i - d) mod n: everyone moves one Ämtli on each day. */
export function rotate(days: string[], chores: string[], groups: string[]): AemtliDay[] {
  if (!chores.length || !groups.length) return [];
  const n = groups.length;
  return days.map((date, d) => ({ date, groups: chores.map((_, i) => groups[(((i - d) % n) + n) % n]) }));
}

export function campDays(start?: string, end?: string): string[] {
  if (!start) return [];
  const out: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end ?? start}T00:00:00Z`) && out.length < 60; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** One entry per line, trimmed, without blanks or repeats (case-insensitive), at most `max`. */
export function splitLines(text: string, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const v = line.trim().slice(0, 60);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out.slice(0, max);
}

/** Reads the sheet the app saved: a header with «Datum», «Tag» and one column per Ämtli. */
export function parseAemtli(grid: Grid): AemtliPlan | null {
  const headerIdx = grid.findIndex((row) => row.some((c) => /^datum$/i.test(c)));
  if (headerIdx < 0) return null;
  const head = grid[headerIdx];
  const dateCol = head.findIndex((c) => /^datum$/i.test(c));
  const cols = head.map((c, i) => [c, i] as const).filter(([c, i]) => c && i > dateCol && !/^tag$/i.test(c));
  const days = grid.slice(headerIdx + 1).flatMap((row) => {
    const d = parseSwissDate(row[dateCol] ?? "");
    return d ? [{ date: d.toISOString().slice(0, 10), groups: cols.map(([, i]) => row[i] ?? "") }] : [];
  });
  return { chores: cols.map(([c]) => c), days };
}
