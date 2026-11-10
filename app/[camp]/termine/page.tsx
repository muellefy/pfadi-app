import { notFound } from "next/navigation";
import { getCamp } from "@/lib/data/config";
import { loadTermine } from "@/lib/data/loaders";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Source } from "@/components/Source";
import { TermineList } from "@/components/TermineList";

export const metadata = { title: "Termine" };

export default async function TerminePage({ params }: { params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const camp = await getCamp(slug);
  if (!camp) notFound();
  const res = await loadTermine(camp);

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
