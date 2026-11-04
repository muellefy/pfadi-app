import { notFound } from "next/navigation";
import { getCamp } from "@/lib/config";
import { loadProgram } from "@/lib/data";
import { ErrorNotice } from "@/components/Bits";
import { ProgramView } from "@/components/ProgramView";
import { Avatar, External } from "@/components/icons";

export const metadata = { title: "Programm" };

export default async function ProgrammPage({ params }: { params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const camp = await getCamp(slug);
  if (!camp) notFound();
  const res = await loadProgram(camp);

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>Programm</h1>
          <p>Live aus eCamp (nur lesen). Bearbeiten weiterhin in eCamp.</p>
        </div>
        {res.ok && res.data && (
          <a className="btn" href={res.data.url} target="_blank" rel="noreferrer">In eCamp öffnen <External size={14} /></a>
        )}
      </header>
      {!res.ok ? (
        <ErrorNotice error={res.error} />
      ) : !res.data ? (
        <div className="notice">
          eCamp ist für dieses Lager noch nicht verbunden. Trage <code>ecampCampId</code> in <code>config/camps.json</code> ein
          und setze <code>ECAMP_EMAIL</code> / <code>ECAMP_PASSWORD</code> in der <code>.env</code>.
        </div>
      ) : (
        <div className="grid" style={{ gap: 20 }}>
          <ProgramView program={res.data} />
          <section className="card">
            <div className="card-head"><h2>Lagerteam in eCamp</h2><span className="small muted">{res.data.team.length} Personen</span></div>
            <div className="grid grid-3" style={{ gap: 10 }}>
              {res.data.team.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Avatar name={m.name} />
                  <div><div>{m.name}</div><div className="small muted">{m.role}{m.status === "invited" ? " · eingeladen" : ""}</div></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
