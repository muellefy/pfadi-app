import { notFound } from "next/navigation";
import { getMyCamp } from "@/lib/data/myRoles";
import { loadTermine } from "@/lib/data/loaders";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Source } from "@/components/Source";
import { TermineList } from "@/components/TermineList";
import { CalendarSync } from "@/components/CalendarSync";
import { myRoles } from "@/lib/data/myRoles";
import { readCalendarStore } from "@/lib/data/calendar";
import { canManageRoles } from "@/lib/roles";
import { syncTermineCalendar } from "./calendarActions";

const WHEN = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });

export const metadata = { title: "Termine" };

export default async function TerminePage({ params }: { params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const camp = await getMyCamp(slug);
  if (!camp) notFound();
  const [res, roles, synced] = await Promise.all([loadTermine(camp), myRoles(camp), readCalendarStore().catch(() => ({}) as Awaited<ReturnType<typeof readCalendarStore>>)]);
  const last = synced[camp.slug];

  const t = res.ok ? res.data.termine : [];
  const done = t.filter((x) => x.erledigt).length;
  const overdue = t.filter((x) => x.status === "ueberfaellig").length;
  const soon = t.filter((x) => x.status === "bald").length;
  const pct = (n: number) => `${t.length ? (n / t.length) * 100 : 0}%`;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>Termine</h1>
          <p>Fristen aus der Lagerplanung – rot ist überfällig, orange in den nächsten 14 Tagen fällig.</p>
        </div>
        {res.ok && (
          <div style={{ minWidth: 240 }}>
            <div className="small muted">{done} von {t.length} erledigt</div>
            <div className="timeline-bar" aria-hidden>
              <i style={{ width: pct(done), background: "var(--forest)" }} />
              <i style={{ width: pct(overdue), background: "var(--rust)" }} />
              <i style={{ width: pct(soon), background: "var(--amber)" }} />
            </div>
          </div>
        )}
      </header>
      {res.ok && canManageRoles(roles) && (
        <CalendarSync
          action={syncTermineCalendar.bind(null, slug)}
          label="In Google Kalender eintragen"
          last={last && `Zuletzt am ${WHEN.format(new Date(last.syncedAt))} von ${last.organizer}`}
        >
          Jeder offene Termin mit Datum kommt als ganztägiger Termin in deinen Kalender, und alle in «Wer» Genannten
          bekommen eine Einladung (Rollen wie Coach, AL, HL, Küche, Alle; Namen aus der Leiterliste; E-Mail-Adressen).
          Nochmals drücken aktualisiert geänderte Daten und Personen.
        </CalendarSync>
      )}
      {res.ok ? (
        <>
          <TermineList slug={slug} termine={t} writeBack={camp.writeBack && !!res.source?.name.endsWith(".xlsx")} />
          <div style={{ marginTop: 10 }}><Source item={res.source} /></div>
        </>
      ) : (
        <ErrorNotice error={res.error} />
      )}
    </>
  );
}
