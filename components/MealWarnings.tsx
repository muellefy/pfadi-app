import type { MealWarning } from "@/lib/allergens";

const DAY = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });

/** Planned meals that clash with someone's diet or allergy note, so the kitchen plans a substitute. */
export function MealWarnings({ warnings }: { warnings: MealWarning[] }) {
  if (!warnings.length) return null;
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="card-head"><h2>Aufpassen bei</h2><span className="small muted">aus Menü, Rezepten und den Hinweisen – ohne Gewähr, Hinweise selbst lesen</span></div>
      <ul className="diet">
        {warnings.map((w) => (
          <li key={`${w.date}|${w.meal}`}>
            <b>{DAY.format(new Date(`${w.date}T00:00:00Z`))} {w.meal}</b> <span className="muted small">{w.text}</span>
            <div className="flag">{w.people.map((p) => `${p.name} (${p.why.join(", ")})`).join(" · ")}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
