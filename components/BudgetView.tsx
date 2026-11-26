"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Budget, BudgetCell, BudgetRow } from "@/lib/budget";
import { money } from "@/lib/money";
import { Journal } from "./Journal";
import { setBudgetValue, type Result } from "@/app/[camp]/budget/actions";

const NUM = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 });
const fmtCell = (c: BudgetCell) => (typeof c.value === "number" ? (c.money ? money(c.value) : NUM.format(c.value)) : c.value ?? "");

type Props = { slug: string; budget: Budget; editable: boolean; receiptFolderId?: string };

export function BudgetView({ slug, budget, editable, receiptFolderId }: Props) {
  const [tab, setTab] = useState<"budget" | "journal">("budget");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  /** runs a server action, then reloads the data (the page re-parses the new file version) */
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setError("");
      // a thrown error (e.g. offline) must show as a message, not replace the page
      const res = await fn().catch((e: unknown): Result => ({ ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." }));
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
        <Journal budget={budget} editable={editable} pending={pending} run={run} slug={slug} receiptFolderId={receiptFolderId} />
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
