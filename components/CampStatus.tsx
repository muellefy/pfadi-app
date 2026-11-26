import Link from "next/link";
import type { CampConfig } from "@/lib/data/config";
import { loadBudget, loadPeople, loadProgram, loadTermine } from "@/lib/data/loaders";
import { campStatus } from "@/lib/campStatus";
import { checkDays } from "@/lib/coach";
import { money } from "@/lib/money";

/**
 * The status of one camp for the AL and Coach. Loads its own data (as the logged-in
 * person, so Drive decides what they see); a source that fails shows "–".
 */
export async function CampStatus({ camp }: { camp: CampConfig }) {
  const [termine, tn, budget, program] = await Promise.all([
    loadTermine(camp), loadPeople(camp, "tn"), camp.drive.budgetFileId ? loadBudget(camp) : null, loadProgram(camp),
  ]);
  const s = campStatus({
    termine: termine.ok ? termine.data : undefined,
    tn: tn.ok ? tn.data.rows.length : undefined,
    budget: budget?.ok ? budget.data : undefined,
    days: program.ok && program.data ? checkDays(program.data.entries) : undefined,
  });
  const n = (v: number | null) => (v == null ? "–" : String(v));
  return (
    <ul className="small camp-status" style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 2 }}>
      <li><Link href={`/${camp.slug}/termine`} className={s.overdue ? "alert" : undefined}>{n(s.overdue)} Termine überfällig</Link></li>
      <li><Link href={`/${camp.slug}/personen`}>{n(s.tn)} Teilnehmende</Link></li>
      <li><Link href={`/${camp.slug}/budget`}>Saldo {s.balanceActual == null ? "–" : money(s.balanceActual)} (Budget {s.balancePlan == null ? "–" : money(s.balancePlan)})</Link></li>
      <li><Link href={`/${camp.slug}/coach`} className={s.failedDays ? "alert" : undefined}>{n(s.failedDays)} Tage unter J+S-Minimum</Link></li>
    </ul>
  );
}
