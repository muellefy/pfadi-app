import { createHash } from "node:crypto";

/**
 * Termine and camps as Google Calendar events. The app gives each event a fixed id derived
 * from what it is, so syncing again updates the same event instead of inviting twice.
 */

/** Google allows event ids of 5–1024 characters from 0-9 and a-v; hex fits. */
export const eventId = (scope: string, key: string) => createHash("sha256").update(`${scope}\n${key}`).digest("hex");

export const hashOf = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export type CalendarEvent = {
  summary: string; description: string;
  start: { date: string }; end: { date: string };
  attendees: { email: string }[];
  /** guests may see each other, so everyone knows who else is on it */
  guestsCanSeeOtherGuests: true;
};

const event = (summary: string, description: string, start: string, end: string, emails: string[]): CalendarEvent => ({
  summary, description, start: { date: start }, end: { date: nextDay(end) },
  attendees: emails.map((email) => ({ email })), guestsCanSeeOtherGuests: true,
});

export type TerminInfo = { camp: string; was: string; date: string; wer: string; anWen: string; link: string };

export const terminEvent = (t: TerminInfo, emails: string[]) =>
  event(`${t.camp}: ${t.was}`, [t.wer && `Wer: ${t.wer}`, t.anWen && `An wen: ${t.anWen}`, `Abhaken: ${t.link}`].filter(Boolean).join("\n"), t.date, t.date, emails);

/** Where the camps of the year plan are remembered in calendar.json (camp slugs never start with "_"). */
export const YEAR_SCOPE = "_jahresplan";

export type CampInfo = { name: string; kind: string; start: string; end: string; link: string };

export const yearEvent = (c: CampInfo, emails: string[]) =>
  event(`${c.name} (${c.kind})`, `Im Lagerplaner: ${c.link}`, c.start, c.end, emails);

/**
 * What to do on a sync. `stored` are the events sent last time (id → hash of what was sent),
 * `wanted` what should be in the calendar now, `keep` ids to leave as they are (ticked-off Termine).
 */
export function planSync<W extends { id: string; hash: string }>(stored: Record<string, string>, wanted: W[], keep: string[]) {
  const ids = new Set([...wanted.map((w) => w.id), ...keep]);
  return {
    send: wanted.filter((w) => stored[w.id] !== w.hash),
    remove: Object.keys(stored).filter((id) => !ids.has(id)),
  };
}
