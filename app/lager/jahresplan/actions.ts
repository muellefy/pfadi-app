"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getConfig } from "@/lib/data/config";
import { loadProgram } from "@/lib/data/loaders";
import { campDates } from "@/lib/campDates";
import { CalendarError, syncCalendar, type Wanted } from "@/lib/data/calendar";
import { eventId, hashOf, YEAR_SCOPE, yearEvent } from "@/lib/calendarSync";
import { rolesOf } from "@/lib/roles";
import type { CalendarResult } from "@/app/[camp]/termine/calendarActions";


/** The AL puts every dated camp into their calendar and invites its members and the Coaches. */
export async function syncYearCalendar(): Promise<CalendarResult> {
  const [session, config] = await Promise.all([auth(), getConfig()]);
  if (!rolesOf(session?.user?.email, config.roles).al) return { ok: false, error: "Nur die Abteilungsleitung kann den Jahresplan eintragen." };
  const wanted: Wanted[] = [];
  let undated = 0;
  for (const c of config.camps) {
    const p = await loadProgram(c);
    const { start, end } = campDates(c, p.ok ? p.data : null);
    if (!start) { undated++; continue; }
    const emails = [...new Set([...c.hauptleitung, ...c.kueche, ...c.leiter, ...config.roles.al, ...config.roles.coach].map((e) => e.toLowerCase()))];
    const body = yearEvent({ name: c.name, kind: c.kind, start, end: end ?? start, link: `${process.env.AUTH_URL ?? ""}/${c.slug}` }, emails);
    wanted.push({ id: eventId(YEAR_SCOPE, c.slug), hash: hashOf(body), body });
  }
  try {
    const r = await syncCalendar(YEAR_SCOPE, wanted, []);
    revalidatePath("/lager/jahresplan");
    return { ok: true, ...r, unknown: [], undated };
  } catch (e) {
    if (e instanceof CalendarError) return { ok: false, error: e.message };
    throw e;
  }
}
