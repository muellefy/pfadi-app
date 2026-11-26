import type { BlockContent, Gap } from "@/lib/coach";
import type { EcampEntry } from "@/lib/data/ecamp";

const TIME = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });

/** One eCamp block with everything the Coach reads in it; text only, never eCamp's HTML. */
export function CoachBlock({ entry, content, gaps }: { entry: EcampEntry; content?: BlockContent; gaps: Gap[] }) {
  const texts: [string, string | undefined][] = [
    ["Ziele", content?.goals],
    ["Sicherheitsüberlegungen", content?.safety],
    ["Rahmengeschichte", content?.story],
    ["Lerninhalte", content?.topics],
    ["Ablauf", content?.storyboard.join("\n")],
    ["Material", content?.material.join("\n")],
    ["J+S-Erscheinungsformen", content?.characteristics.join(", ")],
    ["Notizen", content?.notes],
  ];
  return (
    <article className="card coach-block" style={{ borderLeft: `4px solid ${entry.color}` }}>
      <div className="card-head" style={{ marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>
          <span className="muted small">{TIME.format(new Date(entry.start))}–{TIME.format(new Date(entry.end))} · {entry.categoryShort}{entry.number ? ` ${entry.number}` : ""}</span><br />
          <a href={entry.url} target="_blank" rel="noreferrer">{entry.title}</a>
        </h3>
        {entry.progress && <span className="pill khaki">{entry.progress}</span>}
      </div>
      {(gaps.length > 0 || entry.movementMin) && (
        <p style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "0 0 8px" }}>
          {gaps.map((g) => <span key={g} className="pill rust">{g}</span>)}
          {entry.movementMin ? <span className="pill">{entry.movementMin} Min. Bewegung</span> : null}
        </p>
      )}
      {entry.location && <p className="small muted" style={{ margin: "0 0 8px" }}>Ort: {entry.location}</p>}
      {texts.filter(([, t]) => t).map(([label, t]) => (
        <div key={label} style={{ marginBottom: 8 }}>
          <div className="eyebrow">{label}</div>
          <p style={{ whiteSpace: "pre-line", margin: 0 }}>{t}</p>
        </div>
      ))}
    </article>
  );
}
