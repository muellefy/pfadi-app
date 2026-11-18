import Link from "next/link";
import { notFound } from "next/navigation";
import { getCamp } from "@/lib/data/config";
import { loadBudget, loadPeople, loadProgram, loadTermine } from "@/lib/data/loaders";
import { beitragOf, type Which } from "@/lib/payments";
import { campDates } from "@/lib/campDates";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Source } from "@/components/Source";
import { PeopleView } from "@/components/PeopleView";

export const metadata = { title: "Teilnehmende & Leitende" };

export default async function PersonenPage({
  params,
  searchParams,
}: {
  params: Promise<{ camp: string }>;
  searchParams: Promise<{ liste?: string }>;
}) {
  const [{ camp: slug }, { liste }] = await Promise.all([params, searchParams]);
  const camp = await getCamp(slug);
  if (!camp) notFound();
  const which: Which = liste === "leiter" ? "leiter" : "tn";
  // eCamp and Lagerdaten.xlsx can hold the camp start, needed for "Alter am Lagerbeginn"
  const [res, program, termine, budget] = await Promise.all([
    loadPeople(camp, which), loadProgram(camp), loadTermine(camp), camp.drive.budgetFileId ? loadBudget(camp) : null,
  ]);
  const { start } = campDates(camp, program.ok ? program.data : null, termine.ok ? termine.data : undefined);
  // Beiträge only show up when the budget charges one per person (no Leiterbeitrag → no column)
  const beitrag = budget?.ok ? beitragOf(budget.data, which) : null;
  const payments = beitrag && budget?.ok ? {
    which,
    rate: beitrag.rate,
    category: beitrag.category,
    bookings: budget.data.journal.bookings.filter((b) => b.category === beitrag.category),
    editable: camp.writeBack && Boolean(budget.source?.canEdit),
  } : undefined;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>{which === "tn" ? "Teilnehmende" : "Leitende"}</h1>
          <p>Direkt aus der Liste im Drive – Änderungen dort erscheinen hier nach dem Neuladen.</p>
        </div>
        <nav className="tabs" aria-label="Liste">
          <Link href="?liste=tn" aria-current={which === "tn" ? "page" : undefined}>Teilnehmende</Link>
          <Link href="?liste=leiter" aria-current={which === "leiter" ? "page" : undefined}>Leitende</Link>
        </nav>
      </header>
      {res.ok ? (
        <>
          <PeopleView slug={slug} table={res.data} campStart={start} payments={payments} label={which === "tn" ? "Teilnehmende" : "Leitende"} />
          <div style={{ marginTop: 12 }}><Source item={res.source} /></div>
        </>
      ) : (
        <ErrorNotice error={res.error} />
      )}
    </>
  );
}
