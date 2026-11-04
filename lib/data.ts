import "server-only";
import { cache } from "react";
import type { CampConfig } from "./config";
import { download, getItem, listChildren, parseRessort, resolveTableFile, type DriveItem } from "./drive";
import { parsePeople, parseTermine, toGrid, type PersonTable, type TermineSheet } from "./tables";
import { ecampConfigured, getProgram, type EcampProgram } from "./ecamp";

/** Every loader returns either data or a readable error, so one broken file never takes a whole page down. */
export type Result<T> = { ok: true; data: T; source?: DriveItem } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<{ data: T; source?: DriveItem }>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: /404|not found/i.test(msg) ? "Datei nicht gefunden oder kein Zugriff." : msg };
  }
}

export const loadTermine = cache((camp: CampConfig) =>
  attempt<TermineSheet>(async () => {
    if (!camp.drive.termineFileId) throw new Error("Keine Termin-Datei konfiguriert (drive.termineFileId).");
    const source = await getItem(camp.drive.termineFileId);
    return { data: parseTermine(await toGrid(await download(source))), source };
  }),
);

export const loadPeople = cache((camp: CampConfig, which: "tn" | "leiter") =>
  attempt<PersonTable>(async () => {
    const id = which === "tn" ? camp.drive.tnFileId : camp.drive.leiterFileId;
    if (!id) throw new Error(`Keine ${which === "tn" ? "TN" : "Leiter"}-Liste konfiguriert.`);
    const source = await resolveTableFile(id);
    if (!source) throw new Error("Im Ordner liegt noch keine Tabelle (xlsx, csv oder Google Sheet).");
    return { data: parsePeople(await toGrid(await download(source))), source };
  }),
);

export type Ressort = DriveItem & { nr?: string; title: string; owner?: string };

export const loadRessorts = cache((camp: CampConfig) =>
  attempt<Ressort[]>(async () => {
    const children = await listChildren(camp.drive.rootFolderId);
    return {
      data: children.filter((c) => c.isFolder).map((c) => ({ ...c, ...parseRessort(c.name) })),
    };
  }),
);

export const loadProgram = cache((camp: CampConfig) =>
  attempt<EcampProgram | null>(async () => {
    if (!camp.ecampCampId || !ecampConfigured()) return { data: null };
    return { data: await getProgram(camp.ecampCampId) };
  }),
);

/** Camp dates: eCamp periods win, then config, then "Erster Lagertag" in Lagerdaten.xlsx. */
export function campDates(camp: CampConfig, program?: EcampProgram | null, termine?: TermineSheet) {
  const p = program?.periods ?? [];
  if (p.length) return { start: p[0].start.slice(0, 10), end: p[p.length - 1].end.slice(0, 10) };
  let start = camp.start;
  const fromSheet = termine?.meta["Erster Lagertag"];
  if (!start && fromSheet) {
    const m = fromSheet.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) start = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return { start, end: camp.end };
}
