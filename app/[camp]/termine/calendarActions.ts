"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getConfig } from "@/lib/data/config";
import { getMyCamp } from "@/lib/data/myRoles";
import { loadPeople, loadTermine } from "@/lib/data/loaders";
import { CalendarError, syncCalendar, type Wanted } from "@/lib/data/calendar";
import { contactsOf, invitees } from "@/lib/invitees";
import { eventId, hashOf, terminEvent } from "@/lib/calendarSync";
import { canManageRoles, rolesOf } from "@/lib/roles";

export type CalendarResult =
  | { ok: true; sent: number; removed: number; unknown: string[]; undated: number }
  | { ok: false; error: string };

/**
 * Puts the camp's open Termine into the caller's Google Calendar and invites everyone the
 * «Wer» column names. Only the Hauptleitung and the AL may; the caller becomes the organizer.
 */
export async function syncTermineCalendar(slug: string): Promise<CalendarResult> {
  const [session, config, camp] = await Promise.all([auth(), getConfig(), getMyCamp(String(slug))]);
  if (!camp) return { ok: false, error: "Unbekanntes Lager." };
  if (!canManageRoles(rolesOf(session?.user?.email, config.roles, camp))) {
    return { ok: false, error: "Nur die Hauptleitung und die Abteilungsleitung können Einladungen verschicken." };
  }
  const [termine, leiter] = await Promise.all([loadTermine(camp), loadPeople(camp, "leiter")]);
  if (!termine.ok) return { ok: false, error: termine.error };
  // without the list, everyone named in it would drop off the events and get a cancellation
  if (camp.drive.leiterFileId && !leiter.ok) return { ok: false, error: `Die Leiterliste lässt sich gerade nicht laden (${leiter.error}). Bitte später nochmals versuchen.` };
  const ctx = {
    ...config.roles, hauptleitung: camp.hauptleitung, kueche: camp.kueche, leiter: camp.leiter,
    people: leiter.ok ? contactsOf(leiter.data) : [], domain: process.env.ALLOWED_DOMAIN ?? "pfadis.ch",
  };
  const link = `${process.env.AUTH_URL ?? ""}/${camp.slug}/termine`;

  const seen = new Map<string, number>();
  const wanted: Wanted[] = [];
  const keep: string[] = [];
  const unknown = new Set<string>();
  let undated = 0;
  for (const t of termine.data.termine) {
    // same text twice in one sheet stays two events
    const base = `${t.section}|${t.was.trim().toLowerCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const id = eventId(camp.slug, `${base}|${n}`);
    // ticked off, or no date right now (e.g. "7 Wochen vorher" while eCamp is down): leave the event as it is
    if (t.erledigt) { keep.push(id); continue; }
    if (!t.date) { keep.push(id); undated++; continue; }
    const who = invitees(t.wer, ctx);
    who.unknown.forEach((u) => unknown.add(u));
    const body = terminEvent({ camp: camp.name, was: t.was, date: t.date, wer: t.wer, anWen: t.anWen, link }, who.emails);
    wanted.push({ id, hash: hashOf(body), body });
  }
  try {
    const r = await syncCalendar(camp.slug, wanted, keep);
    revalidatePath(`/${camp.slug}/termine`);
    return { ok: true, ...r, unknown: [...unknown], undated };
  } catch (e) {
    if (e instanceof CalendarError) return { ok: false, error: e.message };
    throw e;
  }
}
