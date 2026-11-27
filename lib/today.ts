/**
 * The "Heute" view: which camp day to show and what happens on it. Days are Swiss
 * calendar days ("YYYY-MM-DD", Europe/Zurich), as people in the camp count them.
 */
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const zurichDay = (d: Date) => DAY.format(d);

export function shiftDay(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type CampDay = { day: string; when: "before" | "during" | "after" };

/** The day to show: the asked-for one, today during the camp, else the first (before) or last (after) camp day. */
export function campDay(today: string, start?: string, end?: string, asked?: string): CampDay {
  const day = asked && ISO_DAY.test(asked) && !Number.isNaN(Date.parse(asked)) ? asked : undefined;
  if (day) return { day, when: start && day < start ? "before" : end && day > end ? "after" : "during" };
  if (start && today < start) return { day: start, when: "before" };
  if (end && today > end) return { day: end, when: "after" };
  return { day: today, when: "during" };
}

/** Program entries that start on `day` (Swiss time), in the order given. */
export const entriesOn = <E extends { start: string }>(entries: E[], day: string) =>
  entries.filter((e) => zurichDay(new Date(e.start)) === day);
