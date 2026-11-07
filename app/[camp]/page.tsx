import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCamp, type CampConfig } from "@/lib/config";
import { loadPeople, loadProgram, loadRessorts, loadTermine } from "@/lib/data";
import { campDates } from "@/lib/tables";
import { ErrorNotice, StatusPill, daysUntil, relative, weekday } from "@/components/Bits";
import { Avatar } from "@/components/icons";

const TODAY = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Zurich" });
const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";

const distance = (d: number) => (d === 0 ? "heute" : d === 1 ? "morgen" : `${d} Tage`);

/**
 * Every section loads its own data inside a Suspense boundary, so the page
 * streams: what is cached shows at once, a slow source only delays its own card.
 * The loaders are React-cached, so sections sharing a source fetch it once.
 */
export default async function Dashboard({ params }: { params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const camp = await getCamp(slug);
  if (!camp) notFound();

  return (
    <>
      <Suspense fallback={<section className="hero"><div className="camp"><div className="eyebrow">{camp.kind}</div><h1>{camp.name}</h1></div></section>}>
        <Hero camp={camp} />
      </Suspense>
      <Suspense fallback={<div className="facts skeleton" aria-hidden />}>
        <Facts camp={camp} />
      </Suspense>
      <div className="grid grid-2">
        <Suspense fallback={<Placeholder title="Als Nächstes" />}><NextUp camp={camp} /></Suspense>
        <Suspense fallback={<Placeholder title="Programm nach Kategorie" />}><ProgramCard camp={camp} /></Suspense>
      </div>
      <Suspense fallback={<section style={{ marginTop: 24 }}><div className="card-head"><h2>Ressorts</h2></div><p className="loading" role="status">Lade Ordner …</p></section>}>
        <Ressorts camp={camp} />
      </Suspense>
    </>
  );
}

function Placeholder({ title }: { title: string }) {
  return <section className="card"><div className="card-head"><h2>{title}</h2></div><p className="loading" role="status">Lade …</p></section>;
}

async function Hero({ camp }: { camp: CampConfig }) {
  const slug = camp.slug;
  const [termine, program] = await Promise.all([loadTermine(camp), loadProgram(camp)]);
  const prog = program.ok ? program.data : null;
  const { start, end } = campDates(camp, prog, termine.ok ? termine.data : undefined);
  const days = start ? daysUntil(start) : null;
  const lagerleitung = termine.ok ? termine.data.meta["Lagerleitung"] : undefined;
  const open = termine.ok ? termine.data.termine.filter((t) => !t.erledigt) : [];
  const overdue = open.filter((t) => t.status === "ueberfaellig").length;
  const motto = prog?.motto ?? camp.motto;
  const nextDue = open.find((t) => t.status === "bald" || t.status === "offen");

  return (
    <section className="hero">
      <div className="camp">
        <div className="eyebrow">{camp.kind}</div>
        <h1>{prog?.title ?? camp.name}</h1>
        {motto && <p className="motto">«{motto}»</p>}
        <p className="when">
          {start ? `${fmt(start)}${end ? ` bis ${fmt(end)}` : ""}` : "Lagerdaten noch offen"}
          {lagerleitung ? `, Leitung ${lagerleitung}` : ""}
        </p>
      </div>
      {/* a Swiss trail signpost: where we are, and how far to what comes next */}
      <div className="signpost" role="group" aria-label="Wegweiser">
        <div className="plate here"><b>Heute</b><span>{TODAY.format(new Date())}</span></div>
        {days != null && (
          <div className="plate to">
            <b>{days >= 0 ? "Lagerbeginn" : "Lager vorbei"}</b>
            {days >= 0 && <time dateTime={start}>{distance(days)}</time>}
          </div>
        )}
        {nextDue?.date && (
          <Link href={`/${slug}/termine`} className="plate to" style={{ textDecoration: "none" }}>
            <b title={nextDue.was}>{nextDue.was}</b>
            <time dateTime={nextDue.date}>{distance(daysUntil(nextDue.date))}</time>
            {nextDue.wer && <small>{nextDue.wer}</small>}
          </Link>
        )}
        {overdue > 0 && (
          <Link href={`/${slug}/termine`} className="plate to late" style={{ textDecoration: "none" }}>
            <b>Überfällig</b><time>{overdue} {overdue === 1 ? "Termin" : "Termine"}</time>
          </Link>
        )}
      </div>
    </section>
  );
}

async function Facts({ camp }: { camp: CampConfig }) {
  const slug = camp.slug;
  const [termine, program, tn, leiter] = await Promise.all([
    loadTermine(camp), loadProgram(camp), loadPeople(camp, "tn"), loadPeople(camp, "leiter"),
  ]);
  const prog = program.ok ? program.data : null;
  const all = termine.ok ? termine.data.termine : [];
  const overdue = all.filter((t) => !t.erledigt && t.status === "ueberfaellig").length;
  const doneCount = all.filter((t) => t.erledigt).length;
  return (
    <div className="facts">
      <Link href={`/${slug}/personen`}><b>{tn.ok ? tn.data.rows.length : "–"}</b><span>Teilnehmende</span></Link>
      <Link href={`/${slug}/personen?liste=leiter`}><b>{leiter.ok ? leiter.data.rows.length : prog ? prog.team.length : "–"}</b><span>Leitende</span></Link>
      <Link href={`/${slug}/termine`} className={overdue ? "alert" : undefined}><b>{overdue}</b><span>Termine überfällig</span></Link>
      <Link href={`/${slug}/termine`}><b>{doneCount}/{termine.ok ? all.length : "–"}</b><span>Termine erledigt</span></Link>
      <Link href={`/${slug}/programm`}><b>{prog ? prog.entries.length : "–"}</b><span>Programmblöcke</span></Link>
    </div>
  );
}

async function NextUp({ camp }: { camp: CampConfig }) {
  const termine = await loadTermine(camp);
  const next = termine.ok ? termine.data.termine.filter((t) => !t.erledigt && t.status !== "ohne-datum").slice(0, 6) : [];
  return (
    <section className="card">
      <div className="card-head"><h2>Als Nächstes</h2><Link href={`/${camp.slug}/termine`}>Alle Termine</Link></div>
      {!termine.ok ? <ErrorNotice error={termine.error} /> : next.length === 0 ? <p className="muted">Alles erledigt. 🎉</p> : (
        <ul className="termine">
          {next.map((t) => (
            <li key={t.row} className="termin" data-status={t.status}>
              <div className="date">{t.date ? `${weekday(t.date)} ${t.dateLabel}` : t.dateLabel}{t.date && <small>{relative(t.date)}</small>}</div>
              <div><div className="what">{t.was}</div><div className="who">{t.wer}</div></div>
              <StatusPill status={t.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function ProgramCard({ camp }: { camp: CampConfig }) {
  const program = await loadProgram(camp);
  const prog = program.ok ? program.data : null;
  return (
    <section className="card">
      <div className="card-head"><h2>Programm nach Kategorie</h2><Link href={`/${camp.slug}/programm`}>Ganzes Programm</Link></div>
      {!program.ok ? <ErrorNotice error={program.error} /> : !prog ? (
        <p className="muted">eCamp ist noch nicht verbunden.</p>
      ) : (
        <div className="bars">
          {prog.categories.map((c) => {
            const max = Math.max(1, ...prog.categories.map((x) => x.count));
            return (
              <div className="bar" key={c.short}>
                <span title={`${c.short}: ${c.name}`}>{c.name}</span>
                <div style={{ width: `${(c.count / max) * 100}%`, background: c.color, minWidth: 4 }} />
                <span className="muted">{c.count}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

async function Ressorts({ camp }: { camp: CampConfig }) {
  const ressorts = await loadRessorts(camp);
  return (
    <section style={{ marginTop: 24 }}>
      <div className="card-head"><h2>Ressorts</h2><Link href={`/${camp.slug}/ablage`}>Ganze Ablage</Link></div>
      {!ressorts.ok ? <ErrorNotice error={ressorts.error} /> : (
        <div className="grid grid-3">
          {ressorts.data.map((r) => (
            <Link key={r.id} href={`/${camp.slug}/ablage/${r.id}`} className="card ressort">
              {r.nr && <span className="nr">{r.nr}</span>}
              <h3>{r.title}</h3>
              <span className="owner">
                {r.owner ? <><Avatar name={r.owner} /> {r.owner}</> : <span>Alle / Hauptleitung</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
