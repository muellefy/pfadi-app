import type { DayCheck } from "@/lib/coach";
import { JS_RULES } from "@/lib/js-rules";

const DAY = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
const h = (min: number) => `${Math.round((min / 60) * 10) / 10} h`;

/** A camp day: the J+S check line, then its blocks. */
export function CoachDay({ day, children }: { day: DayCheck; children: React.ReactNode }) {
  const mark = (ok: boolean) => (ok ? "✓" : "⚠");
  return (
    <section style={{ marginTop: 24 }}>
      <div className="card-head">
        <h2>{DAY.format(new Date(day.date))}</h2>
        <span className={`pill ${day.ok ? "" : "rust"}`}>
          {mark(day.jsMinutes >= JS_RULES.minHoursPerDay * 60)} {h(day.jsMinutes)} J+S · {mark(day.movementMin >= JS_RULES.minMovementMinPerDay)} {h(day.movementMin)} Bewegung · {mark(day.parts.length >= JS_RULES.minPartsOfDay)} {day.parts.join(", ") || "keine Tageszeit"}
        </span>
      </div>
      {day.mergedWithFirst && <p className="small muted">Erster und letzter Lagertag zählen für J+S zusammen; der Haken gilt für beide.</p>}
      <div className="grid" style={{ gap: 12 }}>{children}</div>
    </section>
  );
}
