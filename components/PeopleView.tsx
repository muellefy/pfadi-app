"use client";
import { Fragment, useMemo, useState } from "react";
import type { PersonTable } from "@/lib/tables";
import { Download } from "./icons";

type Props = { table: PersonTable; campStart?: string; label: string };

const NONE = /^(-|keine?|nein|no|none|n\/a|0)$/i;

function ageAt(birth: string, at: Date) {
  const m = birth.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/) ?? birth.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = birth.includes("-") ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]];
  let a = at.getFullYear() - y;
  if (at.getMonth() + 1 < mo || (at.getMonth() + 1 === mo && at.getDate() < d)) a--;
  return a;
}

function toCsv(columns: string[], rows: Record<string, string>[]) {
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // semicolon + BOM so Excel (de-CH) opens it correctly
  return "﻿" + [columns.map(esc).join(";"), ...rows.map((r) => columns.map((c) => esc(r[c] ?? "")).join(";"))].join("\r\n");
}

export function PeopleView({ table, campStart, label }: Props) {
  const { columns, rows, roles } = table;
  const [q, setQ] = useState("");
  const [stufe, setStufe] = useState<string>("");
  const [onlyFlags, setOnlyFlags] = useState(false);
  const [view, setView] = useState<"karten" | "tabelle">("karten");
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const at = campStart ? new Date(campStart) : new Date();

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
      return !needle || columns.some((c) => r[c]?.toLowerCase().includes(needle));
    });
    if (sort) out = [...out].sort((a, b) => sort.dir * (a[sort.col] ?? "").localeCompare(b[sort.col] ?? "", "de", { numeric: true }));
    return out;
  }, [rows, q, stufe, onlyFlags, sort, columns, roles.stufe]);

  const withFlags = rows.filter((r) => flagsOf(r).length).length;

  const exportCsv = () => {
    const blob = new Blob([toCsv(columns, filtered)], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${label}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!rows.length) return <div className="notice">Die Liste ist noch leer.</div>;

  const name = (r: Record<string, string>) =>
    [roles.vorname && r[roles.vorname], roles.nachname && r[roles.nachname]].filter(Boolean).join(" ") ||
    r[columns[0]];
  const shownFields = [roles.stufe, roles.geburtsdatum, roles.telefon, roles.email].filter(Boolean) as string[];

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{rows.length}</b><span>{label} total</span></div>
        {stufen.slice(0, 4).map(([s, n]) => <div className="stat" key={s}><b>{n}</b><span>{s}</span></div>)}
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
        <span className="small muted">{filtered.length} angezeigt</span>
      </div>

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
              </article>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} onClick={() => setSort(sort?.col === c ? { col: c, dir: sort.dir === 1 ? -1 : 1 } : { col: c, dir: 1 })} aria-sort={sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    {c}{sort?.col === c ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>{columns.map((c) => <td key={c} title={r[c]}>{r[c]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
