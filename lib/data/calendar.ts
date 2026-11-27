import "server-only";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { auth } from "@/auth";
import { dataPath, writeJson } from "./dataDir.ts";
import { parseConfigFile } from "../configFile.ts";
import { planSync, type CalendarEvent } from "../calendarSync.ts";
import { serialize } from "../lock.ts";

/**
 * Sends events to the Google Calendar of the person who syncs (they become the organizer,
 * Google mails the invitations). $DATA_DIR/calendar.json remembers per scope (camp slug or
 * "_jahresplan") who sent what, so the next sync only updates what changed.
 */
const Entry = z.object({ organizer: z.string(), syncedAt: z.string(), events: z.record(z.string(), z.string()) });
const Store = z.record(z.string(), Entry);
export type SyncInfo = z.infer<typeof Entry>;

const FILE = () => dataPath("calendar.json");
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function readCalendarStore(): Promise<Record<string, SyncInfo>> {
  const raw = await readFile(FILE(), "utf8").catch((e) => (e.code === "ENOENT" ? null : Promise.reject(e)));
  return raw ? parseConfigFile(Store, raw, FILE()) : {};
}

export class CalendarError extends Error {}

async function call(token: string, method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method, signal: AbortSignal.timeout(20_000),
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok || (method === "DELETE" && (res.status === 404 || res.status === 410))) return res.status;
  const text = await res.text();
  if (res.status === 409 && method === "POST") return 409;
  if (res.status === 401 || /SCOPE_INSUFFICIENT|insufficientPermissions/i.test(text)) {
    throw new CalendarError("Die App darf deinen Kalender noch nicht benutzen. Bitte abmelden, wieder anmelden und bei Google «Kalender» erlauben.");
  }
  if (/accessNotConfigured|SERVICE_DISABLED/i.test(text)) {
    throw new CalendarError("Die Google Calendar API ist im Google-Cloud-Projekt der App nicht eingeschaltet (APIs & Services → Google Calendar API → Aktivieren).");
  }
  throw new CalendarError(`Google Kalender antwortet mit Fehler ${res.status}.`);
}

/** Creates the event with our id, or updates it if it exists (also when it was deleted in the calendar). */
async function upsert(token: string, id: string, body: CalendarEvent) {
  const q = "?sendUpdates=all";
  if ((await call(token, "POST", API + q, { ...body, id })) === 409) {
    await call(token, "PUT", `${API}/${id}${q}`, { ...body, status: "confirmed" });
  }
}

/**
 * Runs `fn` over `list`, a few at a time (Google limits requests per second). Every request of a
 * batch finishes before the next batch or the error, so nothing still runs after we saved.
 */
async function inBatches<T>(list: T[], fn: (x: T) => Promise<void>, size = 5) {
  for (let i = 0; i < list.length; i += size) {
    const results = await Promise.allSettled(list.slice(i, i + size).map(fn));
    const failed = results.find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
  }
}

export type Wanted = { id: string; hash: string; body: CalendarEvent };
export type SyncResult = { sent: number; removed: number };

/** Brings the organizer's calendar in line with `wanted`. Only the person who sent the invitations can update them. */
export async function syncCalendar(scope: string, wanted: Wanted[], keep: string[]): Promise<SyncResult> {
  const session = await auth();
  const me = session?.user?.email?.toLowerCase();
  if (!session?.accessToken || session.error || !me) throw new CalendarError("Google-Sitzung abgelaufen – bitte neu anmelden.");
  const token = session.accessToken;
  return serialize("calendar", async () => {
    const store = await readCalendarStore();
    const before = store[scope];
    if (before && before.organizer !== me) {
      throw new CalendarError(`Die Einladungen hat ${before.organizer} verschickt. Nur diese Person kann sie aktualisieren, sonst kämen alle Einladungen doppelt.`);
    }
    const stored = before?.events ?? {};
    const { send, remove } = planSync(stored, wanted, keep);
    const events = { ...stored };
    let done = 0;
    try {
      await inBatches(send, async (w) => { await upsert(token, w.id, w.body); events[w.id] = w.hash; done++; });
      await inBatches(remove, async (id) => { await call(token, "DELETE", `${API}/${id}?sendUpdates=all`); delete events[id]; done++; });
    } finally {
      // save what got through even if a later request failed, so a retry doesn't invite twice;
      // nobody becomes the organizer of a camp without having sent anything
      if (done > 0) {
        const rest = { ...store };
        if (Object.keys(events).length) rest[scope] = { organizer: me, syncedAt: new Date().toISOString(), events };
        else delete rest[scope];
        await writeJson(FILE(), rest);
      }
    }
    return { sent: send.length, removed: remove.length };
  });
}
