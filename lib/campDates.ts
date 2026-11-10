import "server-only";
import type { CampConfig } from "./data/config";
import type { EcampProgram } from "./data/ecamp";
import { parseSwissDate } from "./dates.ts";
import type { TermineSheet } from "./termine";

/** Camp dates: eCamp periods win, then config, then "Erster Lagertag" in Lagerdaten.xlsx. */
export function campDates(camp: CampConfig, program?: EcampProgram | null, termine?: TermineSheet) {
  const p = program?.periods ?? [];
  if (p.length) return { start: p[0].start.slice(0, 10), end: p[p.length - 1].end.slice(0, 10) };
  const fromSheet = termine?.meta["Erster Lagertag"];
  // the cell may be text like "Sa 19.07.2027", so skip anything before the date
  const start = camp.start || (fromSheet ? parseSwissDate(fromSheet.replace(/^\D+/, ""))?.toISOString().slice(0, 10) : undefined);
  return { start, end: camp.end };
}
