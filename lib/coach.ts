import type { EcampEntry } from "./data/ecamp";
import { JS_RULES } from "./js-rules.ts";

/** What the Coach reads in a block, already plain text. */
export type BlockContent = {
  goals: string; safety: string; story: string; notes: string; topics: string;
  storyboard: string[]; material: string[]; characteristics: string[];
};

export type Gap = "keine Sicherheitsüberlegungen" | "keine Ziele" | "keine Bewegungszeit" | "kürzer als 30 Min.";
export type Part = "Vormittag" | "Nachmittag" | "Abend";
export type DayCheck = {
  date: string; jsMinutes: number; movementMin: number; parts: Part[]; ok: boolean;
  entries: EcampEntry[];
  /** the last day: J+S checks it together with the first one */
  mergedWithFirst?: boolean;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** eCamp stores rich text as HTML written by users; we only ever show it as text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (ENTITIES[e.toLowerCase()]) return ENTITIES[e.toLowerCase()];
      if (e[0] !== "#") return m;
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}

const isJs = (e: EcampEntry) => !(JS_RULES.nonJsCategories as readonly string[]).includes(e.categoryShort);
const minutes = (e: EcampEntry) => Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60_000);

export function gapsOf(entry: EcampEntry, content: BlockContent | undefined): Gap[] {
  const gaps: Gap[] = [];
  if (!content?.safety) gaps.push("keine Sicherheitsüberlegungen");
  if (!content?.goals) gaps.push("keine Ziele");
  if (isJs(entry)) {
    if (!entry.movementMin) gaps.push("keine Bewegungszeit");
    if (minutes(entry) < JS_RULES.minBlockMin) gaps.push("kürzer als 30 Min.");
  }
  return gaps;
}

const LOCAL = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
/** Swiss local date and minute of the day */
function local(iso: string) {
  const p = Object.fromEntries(LOCAL.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

const PARTS: [Part, number, number][] = [
  ["Vormittag", 0, JS_RULES.parts.afternoonFrom * 60],
  ["Nachmittag", JS_RULES.parts.afternoonFrom * 60, JS_RULES.parts.eveningFrom * 60],
  ["Abend", JS_RULES.parts.eveningFrom * 60, 24 * 60],
];

function partsOf(e: EcampEntry): Part[] {
  const s = local(e.start).min;
  const end = s + minutes(e); // past midnight still counts as the evening of the start day
  return PARTS.filter(([, from, to]) => s < to && end > from).map(([p]) => p);
}

function totals(entries: EcampEntry[]) {
  const js = entries.filter(isJs);
  const parts = new Set(js.flatMap(partsOf));
  const jsMinutes = js.reduce((t, e) => t + minutes(e), 0);
  const movementMin = js.reduce((t, e) => t + (e.movementMin ?? 0), 0);
  const ok = jsMinutes >= JS_RULES.minHoursPerDay * 60 && movementMin >= JS_RULES.minMovementMinPerDay && parts.size >= JS_RULES.minPartsOfDay;
  return { jsMinutes, movementMin, parts: PARTS.map(([p]) => p).filter((p) => parts.has(p)), ok };
}

/** One check per camp day (Swiss date of the block start), in order. */
export function checkDays(entries: EcampEntry[]): DayCheck[] {
  const byDay = new Map<string, EcampEntry[]>();
  for (const e of [...entries].sort((a, b) => a.start.localeCompare(b.start))) {
    const d = local(e.start).date;
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const days: DayCheck[] = [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, entries: list, ...totals(list) }));
  if (days.length >= 2) {
    // J+S: arrival and departure day count together as one day
    const first = days[0], last = days[days.length - 1];
    const ok = totals([...first.entries, ...last.entries]).ok;
    first.ok = ok;
    last.ok = ok;
    last.mergedWithFirst = true;
  }
  return days;
}
