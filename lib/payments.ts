import type { Booking, Budget } from "./budget.ts";

/**
 * Lagerbeitrag (TN) and Leiterbeitrag payments, kept as income bookings in the
 * budget's Finanzjournal ("Lagerbeitrag Mia Muster"), so the Abrechnung stays right.
 */
export type Which = "tn" | "leiter";
export type Beitrag = { category: string; rate: number };

const MATCH: Record<Which, (s: string) => boolean> = {
  tn: (s) => /(lager|tn|teilnehm\w*)[\s-]*beitr/i.test(s) && !/leiter/i.test(s),
  leiter: (s) => /leiter\w*[\s-]*beitr/i.test(s),
};

/** The journal category and CHF per person, or null if the budget charges no such Beitrag. */
export function beitragOf(b: Budget, which: Which): Beitrag | null {
  const row = b.rows.find((r) => MATCH[which](r.label) && typeof r.rate?.value === "number" && r.rate.value > 0);
  const cats = b.categories.filter(MATCH[which]);
  const category = cats.find((c) => /^einnahme/i.test(c)) ?? cats[0];
  return row && category ? { category, rate: row.rate!.value as number } : null;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The booking that pays `name`'s Beitrag: the right category, and the whole name as words in its text. */
// shortcut: matches by name, so namesakes (or "Mia Muster" in "Mia Muster Meier") share one booking; match by MiData id if that bites
export function paymentOf(bookings: Booking[], category: string, name: string): Booking | undefined {
  const n = norm(name);
  return n ? bookings.find((b) => b.category === category && ` ${norm(b.text)} `.includes(` ${n} `)) : undefined;
}

export const paymentText = (which: Which, name: string) => `${which === "tn" ? "Lagerbeitrag" : "Leiterbeitrag"} ${name}`;
