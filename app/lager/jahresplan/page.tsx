import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getConfig, type CampConfig } from "@/lib/data/config";
import { loadProgram, loadTermine } from "@/lib/data/loaders";
import { readCalendarStore } from "@/lib/data/calendar";
import { campDates } from "@/lib/campDates";
import { canSeeCamp, rolesOf } from "@/lib/roles";
import { weekday } from "@/lib/dates";
import { CalendarSync } from "@/components/CalendarSync";
import { StatusPill } from "@/components/StatusPill";
import { syncYearCalendar } from "./actions";
import { YEAR_SCOPE } from "@/lib/calendarSync";

export const metadata = { title: "Jahresplan" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { day: "numeric", month: "short", timeZone: "UTC" });
const WHEN = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });
const FOR_AL = /\b(al|abteilungsleitung|coach)\b/i;

/** All camps of the Abteilung by date; for AL and Coach also their deadlines across camps. */
export default async function JahresplanPage() {
  const [config, session, synced] = await Promise.all([getConfig(), auth(), readCalendarStore().catch(() => ({}) as Awaited<ReturnType<typeof readCalendarStore>>)]);
  const email = session?.user?.email;
  const roles = rolesOf(email, config.roles);
  const visible = config.camps.filter((c) => canSeeCamp(rolesOf(email, config.roles, c), c));
  const camps = await Promise.all(visible.map(async (c) => {
    const p = await loadProgram(c);
    return { camp: c, ...campDates(c, p.ok ? p.data : null) };
  }));
  camps.sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));
  const years = [...new Set(camps.map((c) => c.start?.slice(0, 4) ?? "Datum offen"))];
  const last = synced[YEAR_SCOPE];

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{config.organisation}</div>
          <h1>Jahresplan</h1>
          <p>Alle Lager und Weekends nach Datum.</p>
        </div>
        <Link href="/lager" className="btn">Alle Lager</Link>
      </header>
      {roles.al && (
        <CalendarSync action={syncYearCalendar} label="Lager in Google Kalender eintragen"
          last={last && `Zuletzt am ${WHEN.format(new Date(last.syncedAt))} von ${last.organizer}`}>
          Jedes Lager mit Daten kommt als mehrtägiger Termin in deinen Kalender. Eingeladen werden seine Hauptleitung,
          Küche und Leiter sowie alle AL und Coaches. Nochmals drücken aktualisiert geänderte Daten.
        </CalendarSync>
      )}
      {years.map((y) => (
        <section key={y} style={{ marginBottom: 24 }}>
          <h2 className="section-title">{y}</h2>
          <ul className="termine">
            {camps.filter((c) => (c.start?.slice(0, 4) ?? "Datum offen") === y).map(({ camp, start, end }) => (
              <li key={camp.slug} className="termin">
                <div className="date">{start ? fmt(start) : "–"}{start && end && end !== start && <small>bis {fmt(end)}</small>}</div>
                <div><div className="what"><Link href={`/${camp.slug}`}>{camp.name}</Link></div><div className="who">{camp.kind}</div></div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {(roles.al || roles.coach) && (
        <Suspense fallback={<p className="loading" role="status">Lade Fristen …</p>}>
          <Deadlines camps={visible} />
        </Suspense>
      )}
    </>
  );
}

/** Open Termine of every camp whose «Wer» names the AL or the Coach. */
async function Deadlines({ camps }: { camps: CampConfig[] }) {
  const lists = await Promise.all(camps.map(async (c) => {
    const t = await loadTermine(c);
    return t.ok ? t.data.termine.filter((x) => !x.erledigt && x.date && FOR_AL.test(x.wer)).map((x) => ({ ...x, camp: c })) : [];
  }));
  const all = lists.flat().sort((a, b) => a.date!.localeCompare(b.date!));
  return (
    <section className="card">
      <div className="card-head"><h2>Fristen für AL und Coach</h2><span className="small muted">offene Termine aller Lager, «Wer» nennt AL oder Coach</span></div>
      {all.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nichts offen.</p> : (
        <ul className="termine">
          {all.map((t) => (
            <li key={`${t.camp.slug}|${t.row}`} className="termin" data-status={t.status}>
              <div className="date">{weekday(t.date!)} {t.dateLabel}</div>
              <div><div className="what">{t.was}</div><div className="who"><Link href={`/${t.camp.slug}/termine`}>{t.camp.name}</Link> · {t.wer}</div></div>
              <StatusPill status={t.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
