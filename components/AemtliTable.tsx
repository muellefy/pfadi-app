import type { AemtliPlan } from "@/lib/aemtli";

const DAY = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });

/** Days down, Ämtli across, the group in each cell. */
export function AemtliTable({ plan, today }: { plan: AemtliPlan; today?: string }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr><th>Tag</th>{plan.chores.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {plan.days.map((d) => (
            <tr key={d.date} aria-current={d.date === today ? "date" : undefined}>
              <td>{DAY.format(new Date(`${d.date}T00:00:00Z`))}</td>
              {d.groups.map((g, i) => <td key={i}>{g}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
