import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyCamp } from "@/lib/data/myRoles";
import { loadMenu, loadPeople, loadProgram, loadTermine } from "@/lib/data/loaders";
import { campDates } from "@/lib/campDates";
import { campDay, entriesOn, shiftDay, zurichDay } from "@/lib/today";
import { dietHints } from "@/lib/diet";
import { mealWarnings } from "@/lib/allergens";
import { ErrorNotice } from "@/components/ErrorNotice";
import { StatusPill } from "@/components/StatusPill";
import { External } from "@/components/icons";

export const metadata = { title: "Heute" };

const DAY = new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
const label = (iso: string, f = DAY) => f.format(new Date(`${iso}T00:00:00Z`));

/** One camp day on the phone: the program with who leads it, the meals, and what is due. `?tag=` picks another day. */
export default async function HeutePage({ params, searchParams }: {
  params: Promise<{ camp: string }>; searchParams: Promise<{ tag?: string }>;
}) {
  const [{ camp: slug }, q] = await Promise.all([params, searchParams]);
  const camp = await getMyCamp(slug);
  if (!camp) notFound();
  const [program, termine, menu, tn, leiter] = await Promise.all([
    loadProgram(camp), loadTermine(camp), loadMenu(camp), loadPeople(camp, "tn"), loadPeople(camp, "leiter"),
  ]);
  const prog = program.ok ? program.data : null;
  const { start, end } = campDates(camp, prog, termine.ok ? termine.data : undefined);
  const { day, when } = campDay(zurichDay(new Date()), start, end, q.tag);

  const blocks = prog ? entriesOn(prog.entries, day) : [];
  const plan = menu.ok ? menu.data.plan : null;
  const meals = plan?.days.find((d) => d.date === day);
  const people = [...(tn.ok ? dietHints(tn.data, "TN") : []), ...(leiter.ok ? dietHints(leiter.data, "Leitende") : [])];
  const warnings = plan && meals ? mealWarnings({ ...plan, days: [meals] }, menu.ok ? menu.data.recipes : [], people) : [];
  const due = termine.ok ? termine.data.termine.filter((t) => !t.erledigt && t.date && t.date <= day).slice(0, 10) : [];

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>{label(day)}</h1>
          {when === "before" && start && <p>Das Lager beginnt am {label(start)}. Hier siehst du schon den ersten Tag.</p>}
          {when === "after" && <p>Das Lager ist vorbei. Hier siehst du den letzten Tag.</p>}
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <Link className="btn" href={`?tag=${shiftDay(day, -1)}`} aria-label="Vortag">‹ {label(shiftDay(day, -1), SHORT)}</Link>
          <Link className="btn" href={`?tag=${shiftDay(day, 1)}`} aria-label="Nächster Tag">{label(shiftDay(day, 1), SHORT)} ›</Link>
        </div>
      </header>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head"><h2>Programm</h2><Link href={`/${slug}/programm`}>Ganzes Programm</Link></div>
          {!program.ok ? <ErrorNotice error={program.error} /> : !prog ? <p className="muted">eCamp ist noch nicht verbunden.</p>
            : blocks.length === 0 ? <p className="muted">Keine Programmblöcke an diesem Tag.</p> : (
              <ul className="termine">
                {blocks.map((b) => (
                  <li key={b.id} className="termin">
                    <div className="date">{TIME.format(new Date(b.start))}<small>bis {TIME.format(new Date(b.end))}</small></div>
                    <div>
                      <div className="what"><span className="swatch" style={{ ["--c" as string]: b.color }} /> {b.number && `${b.number} `}{b.title}</div>
                      <div className="who">{[b.responsibles?.join(", "), b.location].filter(Boolean).join(" · ") || b.category}</div>
                    </div>
                    <a href={b.url} target="_blank" rel="noreferrer" aria-label={`${b.title} in eCamp öffnen`}><External size={14} /></a>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Essen</h2><Link href={`/${slug}/menue`}>Menüplan</Link></div>
          {!menu.ok ? <ErrorNotice error={menu.error} /> : !meals ? <p className="muted">Für diesen Tag steht nichts im Menüplan.</p> : (
            <ul className="termine">
              {meals.meals.map((m, i) => {
                const w = warnings.find((x) => x.meal === plan!.columns[i]);
                return (
                  <li key={m.ref} className="termin">
                    <div className="date">{plan!.columns[i]}</div>
                    <div>
                      <div className="what">{m.text || <span className="muted">–</span>}</div>
                      {w && <div className="flag">{w.people.map((p) => `${p.name} (${p.why.join(", ")})`).join(" · ")}</div>}
                    </div>
                  </li>
                );
              })}
              {meals.notes?.text && <li className="termin"><div className="date">Notiz</div><div>{meals.notes.text}</div></li>}
            </ul>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-head"><h2>Fällig bis heute</h2><Link href={`/${slug}/termine`}>Alle Termine</Link></div>
        {!termine.ok ? <ErrorNotice error={termine.error} /> : due.length === 0 ? <p className="muted">Nichts offen.</p> : (
          <ul className="termine">
            {due.map((t) => (
              <li key={t.row} className="termin" data-status={t.status}>
                <div className="date">{t.dateLabel}</div>
                <div><div className="what">{t.was}</div><div className="who">{t.wer}</div></div>
                <StatusPill status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
