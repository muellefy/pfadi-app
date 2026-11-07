import Link from "next/link";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { CURRENT_COOKIE, pickCurrent } from "@/lib/camps";
import { loadProgram } from "@/lib/data";
import { campDates } from "@/lib/tables";
import { daysUntil } from "@/components/Bits";
import { ChooseCampButton } from "@/components/ChooseCampButton";

export const metadata = { title: "Alle Lager" };

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

export default async function LagerPage() {
  const [config, jar] = await Promise.all([getConfig(), cookies()]);
  const chosen = jar.get(CURRENT_COOKIE)?.value;
  // eCamp dates win over the config ones; the program is cached, so this is cheap
  const camps = await Promise.all(
    config.camps.map(async (c) => {
      const p = await loadProgram(c);
      return { ...c, ...campDates(c, p.ok ? p.data : null) };
    }),
  );
  const current = pickCurrent(camps, chosen);
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...camps].sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""));

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{config.organisation}</div>
          <h1>Alle Lager</h1>
          <p>Wähle das Lager, an dem du gerade arbeitest – die App öffnet beim nächsten Mal direkt dieses.</p>
        </div>
        <Link href="/lager/neu" className="btn primary">Neues Lager anlegen</Link>
      </header>
      {!sorted.length && <div className="notice">Noch kein Lager – lege das erste an.</div>}
      <div className="grid grid-3">
        {sorted.map((c) => {
          const days = c.start ? daysUntil(c.start) : null;
          const over = c.end ? c.end < today : days != null && days < 0;
          const isCurrent = c.slug === current;
          return (
            <article key={c.slug} className="card camp-card" data-current={isCurrent || undefined}>
              <div className="eyebrow">{c.kind}{isCurrent && <span className="pill" style={{ marginLeft: 8 }}>Aktuell</span>}</div>
              <h2><Link href={`/${c.slug}`}>{c.name}</Link></h2>
              <p className="muted small" style={{ margin: 0 }}>
                {c.start ? `${fmt(c.start)}${c.end ? ` – ${fmt(c.end)}` : ""}` : "Daten noch offen"}
                {days != null && !over && (days > 0 ? ` · in ${days} Tagen` : " · läuft")}
                {over && " · vorbei"}
              </p>
              <div className="camp-card-actions">
                <Link href={`/${c.slug}`} className="btn">Öffnen</Link>
                {!isCurrent && <ChooseCampButton slug={c.slug} />}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
