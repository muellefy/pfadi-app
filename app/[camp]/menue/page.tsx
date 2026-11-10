import { notFound } from "next/navigation";
import { getCamp } from "@/lib/data/config";
import { loadMenu, loadPeople } from "@/lib/data/loaders";
import { XLSX } from "@/lib/data/drive";
import { dietCounts, dietHints } from "@/lib/diet";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Source } from "@/components/Source";
import { MenuView } from "@/components/MenuView";
import { External } from "@/components/icons";

export const metadata = { title: "Menüplan" };

export default async function MenuePage({ params }: { params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const camp = await getCamp(slug);
  if (!camp) notFound();
  const [res, tn, leiter] = await Promise.all([loadMenu(camp), loadPeople(camp, "tn"), loadPeople(camp, "leiter")]);

  // for the kitchen: how many people, and who needs what (only what the person may see in Drive)
  const people = [...(tn.ok ? dietHints(tn.data, "TN") : []), ...(leiter.ok ? dietHints(leiter.data, "Leitende") : [])];
  const headcount = (tn.ok ? tn.data.rows.length : 0) + (leiter.ok ? leiter.data.rows.length : 0);
  const editable = res.ok && camp.writeBack && res.source?.mimeType === XLSX && Boolean(res.source?.canEdit);
  const link = res.ok ? (res.source ?? res.data.folder)?.webViewLink : undefined;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>Menüplan</h1>
          <p>Was es an welchem Tag gibt – gespeichert als Excel im Küche-Ordner. Ein Klick in ein Feld, tippen, fertig.</p>
        </div>
        {link && <a className="btn" href={link} target="_blank" rel="noreferrer">Im Drive öffnen <External size={14} /></a>}
      </header>
      {!res.ok ? (
        <ErrorNotice error={res.error} />
      ) : (
        <>
          <MenuView
            slug={slug}
            plan={res.data.plan}
            editable={editable}
            canCreate={camp.writeBack && Boolean(res.data.folder?.canAddChildren)}
            headcount={headcount}
            people={people}
            counts={dietCounts(people)}
          />
          {res.data.plan && <div style={{ marginTop: 12 }}><Source item={res.source} /></div>}
        </>
      )}
    </>
  );
}
