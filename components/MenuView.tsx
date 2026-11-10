"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MenuCell, MenuPlan } from "@/lib/menu";
import type { DietPerson } from "@/lib/diet";
import { createMenuPlan, setMeal, type Result } from "@/app/[camp]/menue/actions";

const DAY = new Intl.DateTimeFormat("de-CH", { weekday: "long", timeZone: "UTC" });
const DATE = new Intl.DateTimeFormat("de-CH", { day: "numeric", month: "long", timeZone: "UTC" });

type Props = {
  slug: string; plan: MenuPlan | null; editable: boolean; canCreate: boolean;
  headcount: number; people: DietPerson[]; counts: { label: string; count: number }[];
};

export function MenuView({ slug, plan, editable, canCreate, headcount, people, counts }: Props) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  const filled = plan ? plan.days.reduce((n, d) => n + d.meals.filter((m) => m.text).length, 0) : 0;
  const total = plan ? plan.days.length * plan.columns.length : 0;

  return (
    <>
      <div className="facts">
        <div><b>{plan?.days.length ?? "–"}</b><span>Lagertage</span></div>
        <div><b>{plan ? `${filled}/${total}` : "–"}</b><span>Mahlzeiten geplant</span></div>
        <div><b>{headcount || "–"}</b><span>Personen (TN + Leitende)</span></div>
        <div><b>{people.length}</b><span>mit Ernährungshinweis</span></div>
      </div>
      {error && <div className="notice error" style={{ marginBottom: 12 }}>{error}</div>}

      {!plan ? (
        <div className="card" style={{ display: "grid", gap: 12, justifyItems: "start", marginBottom: 20 }}>
          <h2>Noch kein Menüplan</h2>
          <p className="muted" style={{ margin: 0 }}>
            Die App legt im Küche-Ordner «Menüplan …xlsx» an: eine Zeile pro Lagertag, Spalten für Zmorge, Zmittag, Zvieri, Znacht und Bemerkungen.
            Du kannst ihn danach hier oder in Excel bearbeiten.
          </p>
          <button className="btn primary" disabled={!canCreate || pending} onClick={() => run(() => createMenuPlan(slug))}>
            {pending ? "Lege an …" : "Menüplan anlegen"}
          </button>
          {!canCreate && <span className="small muted">Du darfst im Küche-Ordner nichts anlegen, oder Zurückschreiben ist ausgeschaltet.</span>}
        </div>
      ) : (
        <>
          {!editable && <div className="notice" style={{ marginBottom: 12 }}>Nur lesen – Bearbeiten braucht eine .xlsx-Datei, Schreibrechte im Drive und writeBack.</div>}
          <div className="days menu-days">
            {plan.days.map((d) => (
              <section key={d.row} className="day card">
                <h3>{DAY.format(new Date(d.date))}<small>{DATE.format(new Date(d.date))}</small></h3>
                {d.meals.map((m, i) => (
                  <Meal key={`${m.ref}:${m.text}`} label={plan.columns[i]} cell={m} editable={editable} onSave={(t) => run(() => setMeal(slug, m.ref, m.text, t))} />
                ))}
                {d.notes && <Meal key={`${d.notes.ref}:${d.notes.text}`} label="Bemerkungen" cell={d.notes} editable={editable} onSave={(t) => run(() => setMeal(slug, d.notes!.ref, d.notes!.text, t))} />}
              </section>
            ))}
          </div>
          {pending && <p className="muted small" role="status">Speichere im Drive …</p>}
        </>
      )}

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-head"><h2>Ernährungshinweise</h2><span className="small muted">aus TN- und Leiterliste</span></div>
        {counts.length > 0 && (
          <div className="chips" style={{ marginBottom: 12 }}>
            {counts.map((c) => <span key={c.label} className="pill amber">{c.count} × {c.label}</span>)}
          </div>
        )}
        {people.length === 0 ? <p className="muted" style={{ margin: 0 }}>Keine Hinweise in den Listen (oder kein Zugriff darauf).</p> : (
          <ul className="diet">
            {people.map((p, i) => (
              <li key={i}><b>{p.name}</b> <span className="muted small">{p.list}</span><div className="flag">{p.hints.join(" · ")}</div></li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Meal({ label, cell, editable, onSave }: { label: string; cell: MenuCell; editable: boolean; onSave: (text: string) => void }) {
  const [v, setV] = useState(cell.text);
  if (!editable) return <div className="meal"><span>{label}</span><p>{cell.text || <span className="muted">–</span>}</p></div>;
  return (
    <label className="meal">
      <span>{label}</span>
      <textarea
        rows={2} value={v} placeholder="–" maxLength={500}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v.trim() !== cell.text) onSave(v); }}
        onKeyDown={(e) => { if (e.key === "Escape") setV(cell.text); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
      />
    </label>
  );
}
