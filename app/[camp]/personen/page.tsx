import Link from "next/link";
import { notFound } from "next/navigation";
import { getCamp } from "@/lib/config";
import { campDates, loadPeople } from "@/lib/data";
import { ErrorNotice, Source } from "@/components/Bits";
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
  const which = liste === "leiter" ? "leiter" : "tn";
  const res = await loadPeople(camp, which);
  const { start } = campDates(camp);

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
          <PeopleView table={res.data} campStart={start} label={which === "tn" ? "Teilnehmende" : "Leitende"} />
          <div style={{ marginTop: 12 }}><Source item={res.source} /></div>
        </>
      ) : (
        <ErrorNotice error={res.error} />
      )}
    </>
  );
}
