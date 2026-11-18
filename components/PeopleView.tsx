"use client";
import { Fragment, useMemo, useOptimistic, useState, useTransition } from "react";
import type { PersonTable } from "@/lib/people";
import type { Booking } from "@/lib/budget";
import { paymentOf, type Which } from "@/lib/payments";
import { personName } from "@/lib/personName";
import { setPaid } from "@/app/[camp]/budget/actions";
import { toCsv } from "@/lib/csv";
import { Check, Download } from "./icons";

/** Lager-/Leiterbeitrag bookings from the budget's Finanzjournal; absent if the budget charges none. */
export type Payments = { which: Which; rate: number; category: string; bookings: Booking[]; editable: boolean };
type Props = { slug: string; table: PersonTable; campStart?: string; label: string; payments?: Payments };

const NONE = /^(-|keine?|nein|no|none|n\/a|0)$/i;

function ageAt(birth: string, at: Date) {
  const m = birth.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/) ?? birth.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = birth.includes("-") ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]];
  let a = at.getFullYear() - y;
  if (at.getMonth() + 1 < mo || (at.getMonth() + 1 === mo && at.getDate() < d)) a--;
  return a;
}

export function PeopleView({ slug, table, campStart, label, payments }: Props) {
  const { columns, rows, roles } = table;
  const [q, setQ] = useState("");
  const [stufe, setStufe] = useState<string>("");
  const [onlyFlags, setOnlyFlags] = useState(false);
  const [view, setView] = useState<"karten" | "tabelle">("karten");
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [paidFilter, setPaidFilter] = useState<"" | "bezahlt" | "offen">("");
  const [payError, setPayError] = useState("");
  const [paying, startPaying] = useTransition();
  const [overrides, setOverride] = useOptimistic<Record<string, boolean>, [string, boolean]>({}, (o, [n, v]) => ({ ...o, [n]: v }));
  const at = campStart ? new Date(campStart) : new Date();
  const name = (r: Record<string, string>) => personName(table, r);
  const isPaid = (r: Record<string, string>) =>
    Boolean(payments) && (overrides[name(r)] ?? Boolean(paymentOf(payments!.bookings, payments!.category, name(r))));
  const togglePaid = (r: Record<string, string>) =>
    startPaying(async () => {
      setPayError("");
      const n = name(r), next = !isPaid(r);
      setOverride([n, next]);
      const res = await setPaid(slug, payments!.which, n, next);
      if (!res.ok) setPayError(res.error);
    });

  const flagsOf = (r: Record<string, string>) =>
    roles.hinweise.map((c) => [c, r[c]] as const).filter(([, v]) => v && !NONE.test(v.trim()));

  const stufen = useMemo(() => {
    if (!roles.stufe) return [];
    const counts = new Map<string, number>();
    for (const r of rows) { const s = r[roles.stufe] || "–"; counts.set(s, (counts.get(s) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, roles.stufe]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (stufe && roles.stufe && (r[roles.stufe] || "–") !== stufe) return false;
      if (onlyFlags && flagsOf(r).length === 0) return false;
      if (paidFilter && isPaid(r) !== (paidFilter === "bezahlt")) return false;
      return !needle || columns.some((c) => r[c]?.toLowerCase().includes(needle));
    });
    if (sort) out = [...out].sort((a, b) => sort.dir * (a[sort.col] ?? "").localeCompare(b[sort.col] ?? "", "de", { numeric: true }));
    return out;
  }, [rows, q, stufe, onlyFlags, sort, columns, roles.stufe, paidFilter, payments, overrides]);

  const withFlags = rows.filter((r) => flagsOf(r).length).length;

  const exportCsv = () => {
    const blob = new Blob([toCsv(columns, filtered)], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${label}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!rows.length) return <div className="notice">Die Liste ist noch leer.</div>;

  const paidCount = payments ? rows.filter(isPaid).length : 0;
  const beitrag = payments?.which === "leiter" ? "Leiterbeitrag" : "Lagerbeitrag";
  const paidButton = (r: Record<string, string>) => (
    <button
      className="check"
      aria-pressed={isPaid(r)}
      aria-label={`${beitrag} ${name(r)}: ${isPaid(r) ? "als offen markieren" : "als bezahlt markieren"}`}
      title={payments!.editable ? `${beitrag} (CHF ${payments!.rate}) im Finanzjournal verbuchen` : "Nur mit Schreibrechten auf das Budget (und writeBack)"}
      disabled={!payments!.editable || paying}
      onClick={() => togglePaid(r)}
    >
      {isPaid(r) && <Check size={14} />}
    </button>
  );
  const shownFields = [roles.stufe, roles.geburtsdatum, roles.telefon, roles.email].filter(Boolean) as string[];

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{rows.length}</b><span>{label} total</span></div>
        {stufen.slice(0, 4).map(([s, n]) => <div className="stat" key={s}><b>{n}</b><span>{s}</span></div>)}
        {payments && <div className="stat"><b>{paidCount}/{rows.length}</b><span>{beitrag} bezahlt</span></div>}
        {roles.hinweise.length > 0 && <div className="stat"><b>{withFlags}</b><span>mit Hinweisen (Allergien, Medis…)</span></div>}
      </div>

      <div className="toolbar">
        <input className="search" type="search" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Suchen" />
        <div className="tabs" role="group" aria-label="Ansicht">
          <button aria-pressed={view === "karten"} onClick={() => setView("karten")}>Karten</button>
          <button aria-pressed={view === "tabelle"} onClick={() => setView("tabelle")}>Tabelle</button>
        </div>
        <button className="btn" onClick={exportCsv} title="Aktuelle Ansicht als CSV herunterladen"><Download size={16} /> CSV</button>
      </div>
      <div className="toolbar">
        {stufen.length > 1 && (
          <div className="chips" role="group" aria-label={roles.stufe}>
            <button className="chip" aria-pressed={!stufe} onClick={() => setStufe("")}>Alle</button>
            {stufen.map(([s, n]) => (
              <button key={s} className="chip" aria-pressed={stufe === s} onClick={() => setStufe(stufe === s ? "" : s)}>{s} · {n}</button>
            ))}
          </div>
        )}
        {roles.hinweise.length > 0 && (
          <button className="chip" aria-pressed={onlyFlags} onClick={() => setOnlyFlags(!onlyFlags)}>Nur mit Hinweisen</button>
        )}
        {payments && (
          <div className="chips" role="group" aria-label={beitrag}>
            <button className="chip" aria-pressed={paidFilter === "bezahlt"} onClick={() => setPaidFilter(paidFilter === "bezahlt" ? "" : "bezahlt")}>Bezahlt · {paidCount}</button>
            <button className="chip" aria-pressed={paidFilter === "offen"} onClick={() => setPaidFilter(paidFilter === "offen" ? "" : "offen")}>Offen · {rows.length - paidCount}</button>
          </div>
        )}
        <span className="small muted">{filtered.length} angezeigt</span>
      </div>
      {payError && <div className="notice error" style={{ marginBottom: 12 }}>{payError}</div>}

      {view === "karten" ? (
        <div className="people">
          {filtered.map((r, i) => {
            const flags = flagsOf(r);
            const age = roles.geburtsdatum ? ageAt(r[roles.geburtsdatum] ?? "", at) : null;
            return (
              <article className="card person" key={i}>
                {roles.pfadiname && r[roles.pfadiname] && <div className="vo">{r[roles.pfadiname]}</div>}
                <div className="name">{name(r)}{age != null && <span className="muted" style={{ fontWeight: 400 }}> · {age} J.</span>}</div>
                <dl>
                  {shownFields.filter((c) => r[c]).map((c) => (
                    <Fragment key={c}><dt>{c}</dt><dd>{c === roles.email ? <a href={`mailto:${r[c]}`}>{r[c]}</a> : c === roles.telefon ? <a href={`tel:${r[c].replace(/\s/g, "")}`}>{r[c]}</a> : r[c]}</dd></Fragment>
                  ))}
                </dl>
                {flags.map(([c, v]) => <div className="flag" key={c}><b>{c}:</b> {v}</div>)}
                {payments && <label className="small" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>{paidButton(r)} {beitrag} bezahlt</label>}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {payments && <th>Bezahlt</th>}
                {columns.map((c) => (
                  <th key={c} onClick={() => setSort(sort?.col === c ? { col: c, dir: sort.dir === 1 ? -1 : 1 } : { col: c, dir: 1 })} aria-sort={sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    {c}{sort?.col === c ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>{payments && <td>{paidButton(r)}</td>}{columns.map((c) => <td key={c} title={r[c]}>{r[c]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
