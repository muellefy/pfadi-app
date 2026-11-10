import { notFound } from "next/navigation";
import { getCamp } from "@/lib/data/config";
import { loadBudget } from "@/lib/data/loaders";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Source } from "@/components/Source";
import { BudgetView } from "@/components/BudgetView";
import { External } from "@/components/icons";

export const metadata = { title: "Budget" };

export default async function BudgetPage({ params }: { params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const camp = await getCamp(slug);
  if (!camp) notFound();
  const res = await loadBudget(camp);
  const editable = res.ok && camp.writeBack && Boolean(res.source?.canEdit);

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>Budget & Abrechnung</h1>
          <p>
            Direkt in der Budget-Datei im Drive: blaue Felder sind das Budget, grüne die Abrechnung.
            Buchungen landen im Finanzjournal; die Summen rechnet die App selbst, Excel beim nächsten Öffnen auch.
          </p>
        </div>
        {res.ok && res.source?.webViewLink && (
          <a className="btn" href={res.source.webViewLink} target="_blank" rel="noreferrer">In Excel / Drive öffnen <External size={14} /></a>
        )}
      </header>
      {!res.ok ? (
        <ErrorNotice error={res.error} />
      ) : (
        <>
          {!editable && (
            <div className="notice" style={{ marginBottom: 16 }}>
              {!camp.writeBack ? "Bearbeiten ist für dieses Lager ausgeschaltet (writeBack)." : "Nur lesen – du hast im Drive keine Schreibrechte auf diese Datei."}
            </div>
          )}
          <BudgetView slug={slug} budget={res.data} editable={editable} />
          <div style={{ marginTop: 12 }}><Source item={res.source} /></div>
        </>
      )}
    </>
  );
}
