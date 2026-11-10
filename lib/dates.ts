/** Swiss date formatting and parsing ("19.07.2027"), plus "in 3 Tagen"-style labels. */

const pad = (n: number) => String(n).padStart(2, "0");
export const fmtDate = (d: Date) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;

export function parseSwissDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
}

const WEEKDAY = new Intl.DateTimeFormat("de-CH", { weekday: "short", timeZone: "UTC" });
export const weekday = (iso: string) => WEEKDAY.format(new Date(iso));

export function daysUntil(iso: string) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(iso) - today) / 86_400_000);
}

export function relative(iso: string) {
  const d = daysUntil(iso);
  if (d === 0) return "heute";
  if (d === 1) return "morgen";
  if (d === -1) return "gestern";
  return d > 0 ? `in ${d} Tagen` : `vor ${-d} Tagen`;
}
