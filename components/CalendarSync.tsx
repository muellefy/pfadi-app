"use client";
import { useState, useTransition } from "react";
import type { CalendarResult } from "@/app/[camp]/termine/calendarActions";

type Props = {
  /** a server action, bound to its camp or the year plan */
  action: () => Promise<CalendarResult>;
  label: string; children: React.ReactNode;
  /** "Zuletzt am … von …", if it was synced before */
  last?: string;
};

/** A button that puts events into the user's Google Calendar and invites people; says what happened. */
export function CalendarSync({ action, label, children, last }: Props) {
  const [result, setResult] = useState<CalendarResult | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    setResult(null);
    try { setResult(await action()); } catch { setResult({ ok: false, error: "Keine Verbindung zum Server. Bitte nochmals versuchen." }); }
  });
  return (
    <section className="card no-print" style={{ marginBottom: 20 }}>
      <div className="card-head">
        <h2>Google Kalender</h2>
        <button className="btn primary" onClick={run} disabled={pending}>{pending ? "Trage ein …" : label}</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{children}{last && <> {last}.</>}</p>
      {result && !result.ok && <div className="notice error" style={{ marginTop: 10 }}>{result.error}</div>}
      {result?.ok && (
        <div className="notice" style={{ marginTop: 10 }}>
          {result.sent === 0 && result.removed === 0 ? "Alles war schon aktuell." : `${result.sent} eingetragen oder geändert, ${result.removed} entfernt.`}
          {result.undated > 0 && ` ${result.undated} ohne Datum ausgelassen.`}
          {result.unknown.length > 0 && <> Ohne E-Mail-Adresse (nicht eingeladen): {result.unknown.join(", ")}. Trage sie in der Leiterliste mit E-Mail ein oder unter «Rollen im Lager».</>}
        </div>
      )}
    </section>
  );
}
