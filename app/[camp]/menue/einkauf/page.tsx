import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyCamp } from "@/lib/data/myRoles";
import { loadMenu, loadPeople } from "@/lib/data/loaders";
import { dietCounts, dietHints } from "@/lib/diet";
import { ErrorNotice } from "@/components/ErrorNotice";
import { ShoppingList } from "@/components/ShoppingList";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Einkaufsliste" };

const DAY = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
const label = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));

/** The shopping list as a sheet to print and take along, for all days or a few (one trip to the shop). */
export default async function EinkaufPage({ params, searchParams }: {
  params: Promise<{ camp: string }>; searchParams: Promise<{ von?: string; bis?: string }>;
}) {
  const [{ camp: slug }, q] = await Promise.all([params, searchParams]);
  const camp = await getMyCamp(slug);
  if (!camp) notFound();
  const [res, tn, leiter] = await Promise.all([loadMenu(camp), loadPeople(camp, "tn"), loadPeople(camp, "leiter")]);
  if (!res.ok) return <ErrorNotice error={res.error} />;
  const plan = res.data.plan;
  if (!plan) return <div className="notice">Noch kein Menüplan. <Link href={`/${slug}/menue`}>Zum Menüplan</Link></div>;

  const dates = plan.days.map((d) => d.date);
  const von = q.von && dates.includes(q.von) ? q.von : dates[0];
  const bis = q.bis && dates.includes(q.bis) && q.bis >= von ? q.bis : dates.at(-1);
  const days = plan.days.filter((d) => d.date >= von && (!bis || d.date <= bis));
  const people = [...(tn.ok ? dietHints(tn.data, "TN") : []), ...(leiter.ok ? dietHints(leiter.data, "Leitende") : [])];
  const headcount = (tn.ok ? tn.data.rows.length : 0) + (leiter.ok ? leiter.data.rows.length : 0);
  const counts = dietCounts(people);
  const span = days.length === plan.days.length ? "ganzes Lager" : `${label(von)} bis ${label(bis ?? von)}`;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>Einkaufsliste</h1>
          <p className="no-print">Für einen Einkauf nur die Tage wählen, für die du einkaufst. Dann drucken oder als PDF sichern.</p>
        </div>
        <PrintButton />
      </header>
      {dates.length > 0 && (
        <form className="toolbar no-print" method="get">
          <label>Von <select name="von" defaultValue={von}>{dates.map((d) => <option key={d} value={d}>{label(d)}</option>)}</select></label>
          <label>Bis <select name="bis" defaultValue={bis}>{dates.map((d) => <option key={d} value={d}>{label(d)}</option>)}</select></label>
          <button className="btn">Anzeigen</button>
          <Link href={`/${slug}/menue`} className="small">Zurück zum Menüplan</Link>
        </form>
      )}
      {counts.length > 0 && (
        <p><b>Ersatz einplanen:</b> {counts.map((c) => `${c.count}× ${c.label}`).join(" · ")}</p>
      )}
      <ShoppingList plan={{ ...plan, days }} recipes={res.data.recipes} headcount={headcount} span={span} checkable />
    </>
  );
}
