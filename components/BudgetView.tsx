"use client";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Booking, Budget, BudgetCell, BudgetRow } from "@/lib/budget";
import { deleteBooking, saveBooking, setBudgetValue, type Result } from "@/app/[camp]/budget/actions";

const CHF = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });
const NUM = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 });
const money = (n: number) => CHF.format(Math.round(n * 100) / 100);
const fmtCell = (c: BudgetCell) => (typeof c.value === "number" ? (c.money ? money(c.value) : NUM.format(c.value)) : c.value ?? "");
const DATE = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
/** "Ausgaben - Höcks" → "Höcks" for display; the sheet keeps the full name */
const shortCat = (c: string) => c.replace(/^(ausgaben|einnahmen)\s*-\s*/i, "");

type Props = { slug: string; budget: Budget; editable: boolean };

export function BudgetView({ slug, budget, editable }: Props) {
  const [tab, setTab] = useState<"budget" | "journal">("budget");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  /** runs a server action, then reloads the data (the page re-parses the new file version) */
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) { setError(res.error); return; }
      after?.();
      router.refresh();
    });

  const s = budget.summary;
  return (
    <>
      <div className="facts">
        <div><b>{money(s.expensesPlan)}</b><span>Ausgaben budgetiert</span></div>
        <div className={s.expensesActual > s.expensesPlan && s.expensesPlan > 0 ? "alert" : undefined}><b>{money(s.expensesActual)}</b><span>Ausgaben abgerechnet</span></div>
        <div><b>{money(s.incomeActual)}</b><span>Einnahmen abgerechnet</span></div>
        <div className={s.balanceActual < 0 ? "alert" : undefined}><b>{money(s.balanceActual)}</b><span>Saldo Abrechnung (Budget {money(s.balancePlan)})</span></div>
      </div>

      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div className="tabs" role="group" aria-label="Ansicht">
          <button aria-pressed={tab === "budget"} onClick={() => setTab("budget")}>Budget</button>
          <button aria-pressed={tab === "journal"} onClick={() => setTab("journal")}>Finanzjournal ({budget.journal.bookings.length})</button>
        </div>
        {pending && <span className="muted small" role="status">Speichere im Drive …</span>}
      </div>
      {error && <div className="notice error" style={{ marginBottom: 12 }}>{error}</div>}

      {tab === "budget" ? (
        <div className="grid budget-grid">
          <BudgetTable budget={budget} editable={editable && !pending} onSet={(ref, v) => run(() => setBudgetValue(slug, ref, v))} />
          <Sections budget={budget} />
        </div>
      ) : (
        <Journal budget={budget} editable={editable} pending={pending} run={run} slug={slug} />
      )}
    </>
  );
}

function Sections({ budget }: { budget: Budget }) {
  const max = Math.max(1, ...budget.sections.flatMap((x) => [x.plan, x.actual]));
  return (
    <section className="card">
      <div className="card-head"><h2>Budget vs. Abrechnung</h2></div>
      <div className="vs">
        {budget.sections.map((x) => (
          <div key={x.title} className="vs-row">
            <span title={x.title}>{x.title}</span>
            <div className="vs-bars">
              <i className="plan" style={{ width: `${(x.plan / max) * 100}%` }} />
              <i className={x.actual > x.plan ? "actual over" : "actual"} style={{ width: `${(x.actual / max) * 100}%` }} />
            </div>
            <span className="muted small">{money(x.actual)} / {money(x.plan)}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}><i className="key plan" /> Budget <i className="key actual" /> Abrechnung</p>
    </section>
  );
}

function BudgetTable({ budget, editable, onSet }: { budget: Budget; editable: boolean; onSet: (ref: string, v: number | null) => void }) {
  return (
    <div className="table-wrap">
      <table className="data budget">
        <thead><tr><th>Posten</th><th className="num">Ansatz</th><th className="num">Budget</th><th className="num">Abrechnung</th></tr></thead>
        <tbody>
          {budget.rows.map((r) => <Row key={r.row + r.label} r={r} editable={editable} onSet={onSet} />)}
        </tbody>
      </table>
    </div>
  );
}

function Row({ r, editable, onSet }: { r: BudgetRow; editable: boolean; onSet: (ref: string, v: number | null) => void }) {
  if (r.kind === "group") return <tr className="group"><th colSpan={4}>{r.label}</th></tr>;
  if (r.kind === "heading") return <tr className="heading"><td colSpan={4}>{r.label}</td></tr>;
  const cell = (c?: BudgetCell) => (
    <td className={`num${c?.input ? ` input ${c.input}` : ""}`}>
      {c && (c.input && editable ? <CellInput key={`${c.ref}:${c.value}`} c={c} onSet={onSet} label={r.label} /> : fmtCell(c))}
    </td>
  );
  return (
    <tr className={r.kind}>
      <td>{r.label}</td>
      {cell(r.rate)}{cell(r.plan)}{cell(r.actual)}
    </tr>
  );
}

function CellInput({ c, onSet, label }: { c: BudgetCell; onSet: (ref: string, v: number | null) => void; label: string }) {
  const initial = typeof c.value === "number" ? String(c.value) : c.value ? String(c.value) : "";
  const [v, setV] = useState(initial);
  const commit = () => {
    const t = v.trim().replace(/['’\s]/g, "").replace(",", ".");
    if (t === initial.trim()) return;
    if (t === "") return onSet(c.ref, null);
    const n = Number(t);
    if (Number.isNaN(n)) { setV(initial); return; }
    onSet(c.ref, n);
  };
  return (
    <input
      className="cell" inputMode="decimal" value={v} aria-label={`${label} (${c.input === "plan" ? "Budget" : "Abrechnung"})`}
      title={c.formula ? "Hier steht eine Formel – eine Zahl ersetzt sie." : undefined}
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setV(initial); } }}
    />
  );
}

type JournalProps = { slug: string; budget: Budget; editable: boolean; pending: boolean; run: (fn: () => Promise<Result>, after?: () => void) => void };

function Journal({ slug, budget, editable, pending, run }: JournalProps) {
  const [editing, setEditing] = useState<Booking | null>(null);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const c of budget.categories) {
      const key = /^einnahme/i.test(c) ? "Einnahmen" : /^ausgabe/i.test(c) ? "Ausgaben" : "Weitere";
      g.set(key, [...(g.get(key) ?? []), c]);
    }
    return [...g];
  }, [budget.categories]);
  const shown = budget.journal.bookings.filter((b) => (!filter || b.category === filter) && (!q || b.text.toLowerCase().includes(q.toLowerCase())));
  const totals = shown.reduce((t, b) => ({ in: t.in + (b.income ?? 0), out: t.out + (b.expense ?? 0) }), { in: 0, out: 0 });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const input = {
      date: String(f.get("date")), text: String(f.get("text")), category: String(f.get("category")),
      amount: Number(String(f.get("amount")).replace(/['’\s]/g, "").replace(",", ".")),
    };
    const existing = editing ? { row: editing.row, text: editing.text } : undefined;
    run(() => saveBooking(slug, input, existing), () => { setEditing(null); form.reset(); });
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      {editable && (
        <form className="card form booking" onSubmit={submit} key={editing?.row ?? "new"}>
          <div className="card-head" style={{ margin: 0 }}>
            <h2>{editing ? `Buchung ${editing.nr} ändern` : "Neue Buchung"}</h2>
            {editing && <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Abbrechen</button>}
          </div>
          <div className="row">
            <label>Datum<input type="date" name="date" required defaultValue={editing?.date ?? new Date().toISOString().slice(0, 10)} /></label>
            <label>Betrag (CHF)<input name="amount" required inputMode="decimal" placeholder="0.00" defaultValue={editing ? String(editing.expense ?? editing.income ?? "") : ""} /></label>
          </div>
          <label>Text<input name="text" required maxLength={200} placeholder="z. B. Einkauf Landi, Beleg 12" defaultValue={editing?.text} /></label>
          <label>Kategorie
            <select name="category" required defaultValue={editing?.category ?? ""}>
              <option value="" disabled>Kategorie wählen</option>
              {groups.map(([g, cats]) => (
                <optgroup key={g} label={g}>{cats.map((c) => <option key={c} value={c}>{shortCat(c)}</option>)}</optgroup>
              ))}
            </select>
            <small className="muted">Einnahmen-Kategorien werden als Einnahme gebucht, alle anderen als Ausgabe.</small>
          </label>
          <div><button className="btn primary" disabled={pending}>{editing ? "Änderung speichern" : "Buchen"}</button></div>
        </form>
      )}

      <section>
        <div className="toolbar">
          <input className="search" type="search" placeholder="Buchungen durchsuchen" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="search" style={{ flex: "0 1 280px" }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Kategorie">
            <option value="">Alle Kategorien</option>
            {budget.categories.map((c) => <option key={c} value={c}>{shortCat(c)}</option>)}
          </select>
        </div>
        {shown.length === 0 ? <p className="notice">Noch keine Buchungen{filter || q ? " in dieser Ansicht" : ""}.</p> : (
          <div className="table-wrap">
            <table className="data journal">
              <thead><tr><th>Nr.</th><th>Datum</th><th>Text</th><th>Kategorie</th><th className="num">Einnahme</th><th className="num">Ausgabe</th>{editable && <th />}</tr></thead>
              <tbody>
                {shown.map((b) => (
                  <tr key={b.row}>
                    <td>{b.nr}</td>
                    <td>{b.date ? DATE.format(new Date(b.date)) : ""}</td>
                    <td title={b.text}>{b.text}</td>
                    <td title={b.category}>{shortCat(b.category)}</td>
                    <td className="num in">{b.income != null ? money(b.income) : ""}</td>
                    <td className="num">{b.expense != null ? money(b.expense) : ""}</td>
                    {editable && (
                      <td className="actions">
                        <button className="btn ghost" disabled={pending} onClick={() => { setEditing(b); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Ändern</button>
                        <button className="btn ghost" disabled={pending} onClick={() => { if (confirm(`Buchung «${b.text}» löschen?`)) run(() => deleteBooking(slug, b.row, b.text)); }}>Löschen</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4}>Total {filter || q ? "(Auswahl)" : ""}</td><td className="num in">{money(totals.in)}</td><td className="num">{money(totals.out)}</td>{editable && <td />}</tr></tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
