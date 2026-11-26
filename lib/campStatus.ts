import type { Budget } from "./budget";
import type { DayCheck } from "./coach";
import type { TermineSheet } from "./termine";

export type CampStatus = { overdue: number | null; tn: number | null; balancePlan: number | null; balanceActual: number | null; failedDays: number | null };

/** The few numbers the AL and Coach want per camp; null where that source didn't load. */
export function campStatus(input: { termine?: TermineSheet; tn?: number; budget?: Budget; days?: DayCheck[] }): CampStatus {
  return {
    overdue: input.termine ? input.termine.termine.filter((t) => t.status === "ueberfaellig").length : null,
    tn: input.tn ?? null,
    balancePlan: input.budget?.summary.balancePlan ?? null,
    balanceActual: input.budget?.summary.balanceActual ?? null,
    // the last day shares its check with the first one
    failedDays: input.days ? input.days.filter((d) => !d.ok && !d.mergedWithFirst).length : null,
  };
}
