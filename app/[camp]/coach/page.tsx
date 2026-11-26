import Link from "next/link";
import { notFound } from "next/navigation";
import { getCamp } from "@/lib/data/config";
import { loadCoach } from "@/lib/data/loaders";
import { checkDays, gapsOf } from "@/lib/coach";
import { fileUrl } from "@/lib/files";
import { ErrorNotice } from "@/components/ErrorNotice";
import { CoachBlock } from "@/components/CoachBlock";
import { CoachDay } from "@/components/CoachDay";
import { External } from "@/components/icons";

export const metadata = { title: "Coach" };

/** Everything the J+S Coach reviews on one page: the Lagerdossier and every eCamp block, gaps marked. */
export default async function CoachPage({ params, searchParams }: {
  params: Promise<{ camp: string }>;
  searchParams: Promise<{ luecken?: string }>;
}) {
  const [{ camp: slug }, { luecken }] = await Promise.all([params, searchParams]);
  const camp = await getCamp(slug);
  if (!camp) notFound();
  const res = await loadCoach(camp);
  const onlyGaps = luecken === "1";

  const days = res.ok && res.data ? checkDays(res.data.program.entries) : [];
  const content = res.ok && res.data ? res.data.content : {};
  const withGaps = days.map((d) => ({ day: d, blocks: d.entries.map((e) => ({ e, gaps: gapsOf(e, e.root ? content[e.root] : undefined) })) }));
  const gapCount = withGaps.reduce((n, d) => n + d.blocks.filter((b) => b.gaps.length).length, 0);
  const failedDays = days.filter((d) => !d.ok && !d.mergedWithFirst).length;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>Coach-Durchsicht</h1>
          <p>Alle Programmblöcke aus eCamp mit Inhalt auf einer Seite. Rot markiert, was fehlt. Bearbeiten weiterhin in eCamp.</p>
        </div>
        {res.ok && res.data && (
          <a className="btn" href={res.data.program.url} target="_blank" rel="noreferrer">In eCamp öffnen <External size={14} /></a>
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
        <>
          <div className="facts">
            {res.data.dossier ? (
              <a href={fileUrl(res.data.dossier.id)} target="_blank" rel="noreferrer"><b>Dossier</b><span>{res.data.dossier.name}</span></a>
            ) : (
              <div><b>–</b><span>Kein Lagerdossier gefunden (Datei mit «dossier» im Namen im Lagerordner)</span></div>
            )}
            <div className={gapCount ? "alert" : undefined}><b>{gapCount}</b><span>Blöcke mit Lücken</span></div>
            <div className={failedDays ? "alert" : undefined}><b>{failedDays}</b><span>Tage unter dem J+S-Minimum</span></div>
          </div>
          <div className="toolbar">
            {onlyGaps ? <Link href="?" className="btn">Alle Blöcke zeigen</Link> : <Link href="?luecken=1" className="btn">Nur Blöcke mit Lücken</Link>}
          </div>
          {days.length === 0 && <div className="notice">In eCamp ist noch kein Programmblock eingeplant.</div>}
          {withGaps.map(({ day, blocks }) => (
            <CoachDay key={day.date} day={day}>
              {blocks.filter((b) => !onlyGaps || b.gaps.length).map(({ e, gaps }) => (
                <CoachBlock key={e.id} entry={e} content={e.root ? content[e.root] : undefined} gaps={gaps} />
              ))}
            </CoachDay>
          ))}
        </>
      )}
    </>
  );
}
