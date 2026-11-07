import "server-only";
import { cache } from "react";
import type { CampConfig } from "./config";
import { download, getItem, listChildren, parseRessort, resolveTableFile, XLSX, type DriveItem } from "./drive";
import { cached } from "./cache";
import { parsePeople, parseTermine, toGrid, type Grid, type PersonTable, type TermineSheet } from "./tables";
import { ecampConfigured, getProgram, type EcampProgram } from "./ecamp";
import { parseBudget, type Budget } from "./budget";
import { MENU_FILE, parseMenu, type MenuPlan } from "./menu";

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

/**
 * Downloads and parses a sheet once per version. Safe to share between people:
 * the caller already fetched `item` with their own token, so Drive checked access,
 * and the same id + modifiedTime is the same content for everyone.
 */
function gridOf(item: DriveItem): Promise<Grid> {
  if (!item.modifiedTime) return download(item).then((f) => toGrid(f));
  return cached(`grid:${item.id}:${item.modifiedTime}`, 6 * 3_600_000, async () => toGrid(await download(item)));
}

export const loadTermine = cache((camp: CampConfig) =>
  attempt<TermineSheet>(async () => {
    if (!camp.drive.termineFileId) throw new Error("Keine Termin-Datei konfiguriert (drive.termineFileId).");
    const source = await getItem(camp.drive.termineFileId);
    return { data: parseTermine(await gridOf(source)), source };
  }),
);

export const loadPeople = cache((camp: CampConfig, which: "tn" | "leiter") =>
  attempt<PersonTable>(async () => {
    const id = which === "tn" ? camp.drive.tnFileId : camp.drive.leiterFileId;
    if (!id) throw new Error(`Keine ${which === "tn" ? "TN" : "Leiter"}-Liste konfiguriert.`);
    const source = await resolveTableFile(id);
    if (!source) throw new Error("Im Ordner liegt noch keine Tabelle (xlsx, csv oder Google Sheet).");
    return { data: parsePeople(await gridOf(source)), source };
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

export const BUDGET_FILE = /budget|abrechnung/i;

/** The budget workbook, parsed (with all formulas evaluated) once per file version. */
export const loadBudget = cache((camp: CampConfig) =>
  attempt<Budget>(async () => {
    if (!camp.drive.budgetFileId) throw new Error("Keine Budget-Datei konfiguriert (drive.budgetFileId).");
    const source = await resolveTableFile(camp.drive.budgetFileId, BUDGET_FILE);
    if (!source) throw new Error("Im Budget-Ordner liegt noch keine Tabelle.");
    if (source.mimeType !== XLSX) throw new Error("Das Budget muss eine .xlsx-Datei sein (Google Sheets und CSV gehen hier nicht).");
    const parse = async () => parseBudget((await download(source)).buffer);
    const data = source.modifiedTime ? await cached(`budget:${source.id}:${source.modifiedTime}`, 6 * 3_600_000, parse) : await parse();
    return { data, source };
  }),
);

export type MenuData = { plan: MenuPlan | null; folder?: DriveItem };

/**
 * The Menüplan. `menuFileId` is the xlsx itself or the Küche folder; in a folder the
 * newest table called "Menüplan …" is used, and none yet means: offer to create one.
 */
export const loadMenu = cache((camp: CampConfig) =>
  attempt<MenuData>(async () => {
    if (!camp.drive.menuFileId) throw new Error("Kein Menüplan-Ordner konfiguriert (drive.menuFileId).");
    const item = await getItem(camp.drive.menuFileId);
    let source: DriveItem | undefined = item;
    if (item.isFolder) {
      const tables = (await listChildren(item.id)).filter((f) => !f.isFolder && MENU_FILE.test(f.name) && (f.mimeType === XLSX || f.mimeType === "application/vnd.google-apps.spreadsheet"));
      tables.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
      if (!tables[0]) return { data: { plan: null, folder: item } };
      source = await getItem(tables[0].id); // fresh after the app wrote it (see resolveTableFile)
    }
    return { data: { plan: parseMenu(await gridOf(source)), folder: item.isFolder ? item : undefined }, source };
  }),
);
