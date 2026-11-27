import { notFound } from "next/navigation";
import { getMyCamp } from "@/lib/data/myRoles";
import { loadAemtli, loadPeople, loadProgram, loadTermine } from "@/lib/data/loaders";
import { campDates } from "@/lib/campDates";
import { campDays, DEFAULT_CHORES } from "@/lib/aemtli";
import { zurichDay } from "@/lib/today";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Source } from "@/components/Source";
import { AemtliTable } from "@/components/AemtliTable";
import { AemtliForm } from "@/components/AemtliForm";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Ämtliplan" };

const DEFAULT_GROUPS = ["Gruppe 1", "Gruppe 2", "Gruppe 3", "Gruppe 4"];

/** The camp's chore rotation: the saved plan from Drive, and a generator to make or redo it. */
export default async function AemtliPage({ params }: { params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const camp = await getMyCamp(slug);
  if (!camp) notFound();
  const [res, program, termine, tn] = await Promise.all([loadAemtli(camp), loadProgram(camp), loadTermine(camp), loadPeople(camp, "tn")]);
  const { start, end } = campDates(camp, program.ok ? program.data : null, termine.ok ? termine.data : undefined);
  const plan = res.ok ? res.data.plan : null;

  // groups: the saved plan's, else the TN list's Stufe/Gruppe column (if it has a sensible number), else numbered
  const col = tn.ok ? tn.data.roles.stufe : undefined;
  const fromList = tn.ok && col ? [...new Set(tn.data.rows.map((r) => r[col]?.trim()).filter(Boolean))] : [];
  const saved = plan ? [...new Set(plan.days.flatMap((d) => d.groups).filter(Boolean))] : [];
  const groups = saved.length ? saved : fromList.length >= 2 && fromList.length <= 12 ? fromList : DEFAULT_GROUPS;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>Ämtliplan</h1>
          <p className="no-print">Wer wann abwäscht, Holz holt und putzt – gespeichert als Excel im Lager-Ordner.</p>
        </div>
        {plan && <PrintButton />}
      </header>
      {!res.ok ? <ErrorNotice error={res.error} /> : (
        <>
          {plan ? (
            <>
              <AemtliTable plan={plan} today={zurichDay(new Date())} />
              <div style={{ marginTop: 10 }} className="no-print"><Source item={res.source} /></div>
            </>
          ) : <div className="notice">Noch kein Ämtliplan. Unten Ämtli und Gruppen prüfen und speichern.</div>}
          <AemtliForm
            slug={slug}
            days={campDays(start, end)}
            chores={plan?.chores.length ? plan.chores : DEFAULT_CHORES}
            groups={groups}
            canSave={camp.writeBack}
            replaces={Boolean(plan)}
          />
        </>
      )}
    </>
  );
}
