"use client";
import { useMemo, useState } from "react";
import type { EcampProgram } from "@/lib/data/ecamp";

const TZ = "Europe/Zurich";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("de-CH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("de-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export function ProgramView({ program }: { program: EcampProgram }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (s: string) => setHidden((h) => { const n = new Set(h); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const days = useMemo(() => {
    const m = new Map<string, typeof program.entries>();
    for (const e of program.entries) {
      if (hidden.has(e.categoryShort)) continue;
      const k = dayKey.format(new Date(e.start));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [program.entries, hidden]);

  return (
    <>
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Kategorien">
          {program.categories.map((c) => (
            <button key={c.short} className="chip" aria-pressed={!hidden.has(c.short)} onClick={() => toggle(c.short)} style={{ ["--c" as string]: c.color }}>
              <span className="swatch" /> {c.short} · {c.name} <span className="muted">({c.count})</span>
            </button>
          ))}
        </div>
      </div>
      {days.length === 0 ? (
        <div className="notice">Noch keine Programmblöcke im Grobprogramm.</div>
      ) : (
        <div className="days">
          {days.map(([k, entries], i) => (
            <div className="day" key={k}>
              <h3>Tag {i + 1}<small>{dayLabel.format(new Date(entries[0].start))}</small></h3>
              {entries.map((e) => (
                <a key={e.id} className="block" href={e.url} target="_blank" rel="noreferrer" style={{ ["--c" as string]: e.color }}>
                  <span className="t">{time.format(new Date(e.start))}–{time.format(new Date(e.end))} · {e.number ?? e.categoryShort}</span>
                  <b>{e.title}</b>
                  {(e.location || e.progress) && <span className="muted">{[e.location, e.progress].filter(Boolean).join(" · ")}</span>}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
