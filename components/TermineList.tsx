"use client";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import type { Termin } from "@/lib/termine";
import { toggleTermin } from "@/app/[camp]/termine/actions";
import { Check } from "./icons";
import { STATUS_LABEL, StatusPill } from "./StatusPill";
import { relative, weekday } from "@/lib/dates";

type Props = { slug: string; termine: Termin[]; writeBack: boolean };
const FILTERS = ["alle", "offen", "ueberfaellig", "bald", "erledigt"] as const;

export function TermineList({ slug, termine, writeBack }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("offen");
  const [wer, setWer] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [items, setOptimistic] = useOptimistic(termine, (state, { row, done }: { row: number; done: boolean }) =>
    state.map((t) => (t.row === row ? { ...t, erledigt: done, status: done ? ("erledigt" as const) : t.status } : t)),
  );

  const people = useMemo(
    () => [...new Set(termine.flatMap((t) => t.wer.split(/,\s*/)).map((s) => s.trim()).filter(Boolean))].sort(),
    [termine],
  );

  const visible = items.filter((t) => {
    if (wer && !t.wer.includes(wer)) return false;
    if (filter === "alle") return true;
    if (filter === "offen") return !t.erledigt;
    return t.status === filter;
  });
  const sections = [...new Set(visible.map((t) => t.section))];

  const onToggle = (t: Termin) =>
    start(async () => {
      setError("");
      setOptimistic({ row: t.row, done: !t.erledigt });
      const res = await toggleTermin(slug, t.row, t.was, !t.erledigt);
      if (!res.ok) setError(res.error ?? "Fehler");
    });

  return (
    <>
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Status">
          {FILTERS.map((f) => (
            <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "alle" ? "Alle" : f === "offen" ? "Noch offen" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <select className="search" style={{ flex: "0 1 260px" }} value={wer} onChange={(e) => setWer(e.target.value)} aria-label="Zuständig">
          <option value="">Alle Zuständigen</option>
          {people.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      {error && <div className="notice error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="card">
        {visible.length === 0 && <p className="muted">Nichts in dieser Ansicht. 🎉</p>}
        {sections.map((s) => (
          <section key={s || "_"}>
            {s && <h3 className="section-title">{s}</h3>}
            <ul className="termine">
              {visible.filter((t) => t.section === s).map((t) => (
                <li key={t.row} className="termin" data-status={t.status}>
                  <div className="date">
                    {t.date ? `${weekday(t.date)} ${t.dateLabel}` : t.dateLabel}
                    {t.date && !t.erledigt && <small>{relative(t.date)}</small>}
                  </div>
                  <div>
                    <div className="what">{t.was}</div>
                    <div className="who">{[t.wer, t.anWen && `→ ${t.anWen}`].filter(Boolean).join(" ")}</div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <StatusPill status={t.status} />
                    <button
                      className="check"
                      aria-pressed={t.erledigt}
                      aria-label={t.erledigt ? "Als offen markieren" : "Als erledigt markieren"}
                      title={writeBack ? "Im Drive abhaken" : "Zurückschreiben ist deaktiviert"}
                      disabled={!writeBack || pending}
                      onClick={() => onToggle(t)}
                    >
                      {t.erledigt && <Check size={14} />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
