"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_LINES, rotate, splitLines } from "@/lib/aemtli";
import { saveAemtli } from "@/app/[camp]/aemtli/actions";
import { AemtliTable } from "./AemtliTable";

type Props = { slug: string; days: string[]; chores: string[]; groups: string[]; canSave: boolean; replaces: boolean };

/** Ämtli and groups, one per line; shows the rotation as you type and saves it to Drive. */
export function AemtliForm({ slug, days, chores, groups, canSave, replaces }: Props) {
  const [choreText, setChores] = useState(chores.join("\n"));
  const [groupText, setGroups] = useState(groups.join("\n"));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const c = splitLines(choreText, MAX_LINES);
  const plan = { chores: c, days: rotate(days, c, splitLines(groupText, MAX_LINES)) };

  const save = () => start(async () => {
    setError(""); setSaved(false);
    try {
      const res = await saveAemtli(slug, choreText, groupText);
      if (!res.ok) setError(res.error); else { setSaved(true); router.refresh(); }
    } catch { setError("Keine Verbindung zum Server. Bitte nochmals versuchen."); }
  });

  return (
    <section className="card no-print" style={{ marginTop: 20 }}>
      <div className="card-head"><h2>{replaces ? "Neu verteilen" : "Ämtliplan erstellen"}</h2><span className="small muted">eine Zeile pro Ämtli bzw. Gruppe</span></div>
      <div className="form"><div className="row">
        <label>Ämtli<textarea rows={6} value={choreText} onChange={(e) => setChores(e.target.value)} /></label>
        <label>Gruppen<textarea rows={6} value={groupText} onChange={(e) => setGroups(e.target.value)} /></label>
      </div></div>
      <p className="small muted">Jeden Tag rückt jede Gruppe ein Ämtli weiter, so macht über das Lager jede Gruppe jedes Ämtli etwa gleich oft.</p>
      {days.length === 0 ? <div className="notice">Lagerbeginn und -ende fehlen (in eCamp oder in der Konfiguration).</div> : (
        <>
          <h3 className="small muted" style={{ margin: "12px 0 6px" }}>Vorschau</h3>
          <AemtliTable plan={plan} />
          <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
            {canSave && <button className="btn primary" onClick={save} disabled={pending || !plan.days.length}>{pending ? "Speichere …" : replaces ? "Ersetzen und speichern" : "Im Drive speichern"}</button>}
            {!canSave && <span className="small muted">Speichern ist für dieses Lager ausgeschaltet (writeBack) – die Vorschau kannst du trotzdem ausdrucken.</span>}
            {replaces && canSave && <span className="small muted">Die alte Version bleibt im Drive-Verlauf.</span>}
          </div>
        </>
      )}
      {error && <div className="notice error" style={{ marginTop: 10 }}>{error}</div>}
      {saved && <div className="notice" style={{ marginTop: 10 }}>Gespeichert.</div>}
    </section>
  );
}
