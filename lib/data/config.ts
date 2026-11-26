import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { mergeRoles, type CampRoleLists } from "../campRoles.ts";
import { emailList, parseConfigFile } from "../configFile.ts";
import { readRoleStore } from "./campRolesStore.ts";
import { dataPath, writeJson } from "./dataDir.ts";

/**
 * Camps come from two files, merged:
 * - config/camps.json, mounted read-only into the container and edited by hand;
 * - $DATA_DIR/camps.json, written by the app when someone creates a camp in the UI.
 * A slug in config/camps.json wins, so a hand-edited copy overrides the app's.
 */
export const RESERVED_SLUGS = ["lager", "login", "api", "_next"];

const Camp = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  kind: z.string().default("Lager"),
  motto: z.string().optional(),
  start: z.string().optional(), // ISO date, e.g. 2027-07-19 — fallback if eCamp is not set
  end: z.string().optional(),
  drive: z.object({
    rootFolderId: z.string(), // e.g. the "02_Sola 27" folder
    termineFileId: z.string().optional(), // Lagerdaten.xlsx
    tnFileId: z.string().optional(), // file OR folder (newest xlsx/csv/Sheet inside is used)
    leiterFileId: z.string().optional(),
    budgetFileId: z.string().optional(), // Lagerbudget/Abrechnung xlsx, or its folder
    menuFileId: z.string().optional(), // Menüplan xlsx, or the Küche folder (the app creates it there)
  }),
  ecampCampId: z.string().optional(), // id from the eCamp URL: app.ecamp3.ch/camps/<id>/...
  writeBack: z.boolean().default(false),
  // per-camp roles fixed here; more are managed in the app ($DATA_DIR/roles.json)
  hauptleitung: emailList,
  kueche: emailList,
  leiter: emailList,
});
/** hauptleitung/kueche are merged with the app's roles; fixedRoles are the ones from the camp files. */
export type CampConfig = z.infer<typeof Camp> & { fixedRoles?: CampRoleLists };
export type CampInput = z.input<typeof Camp>;

const Config = z.object({
  organisation: z.string().default("Pfadi"),
  /** Drive folder copied for a new camp ("Neues Lager"); can be changed in the form */
  templateFolderId: z.string().optional(),
  camps: z.array(Camp).default([]),
  /** emails of the Abteilungsleitung and J+S Coaches (see lib/roles.ts) */
  roles: z.object({ al: emailList, coach: emailList }).default({ al: [], coach: [] }),
});
export type AppConfig = z.infer<typeof Config>;

const Stored = z.object({ camps: z.array(Camp).default([]) });

const configFile = () => process.env.CAMPS_CONFIG ?? path.join(/* turbopackIgnore: true */ process.cwd(), "config", "camps.json");
const dataFile = () => dataPath("camps.json");

let cache: { at: number; value: AppConfig } | null = null;

async function readStored(): Promise<z.infer<typeof Stored>> {
  const raw = await readFile(dataFile(), "utf8").catch((e) => (e.code === "ENOENT" ? null : Promise.reject(e)));
  return raw ? parseConfigFile(Stored, raw, dataFile()) : { camps: [] };
}

export async function getConfig(): Promise<AppConfig> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const file = configFile();
  const raw = await readFile(file, "utf8").catch(() => {
    throw new Error(`Konfiguration fehlt: ${file}. Kopiere config/camps.example.json nach config/camps.json.`);
  });
  const base = parseConfigFile(Config, raw, file);
  const stored = await readStored();
  const known = new Set(base.camps.map((c) => c.slug));
  const roles = await readRoleStore();
  const camps = [...base.camps, ...stored.camps.filter((c) => !known.has(c.slug))].map((c) => ({
    ...c, ...mergeRoles(c, roles[c.slug]), fixedRoles: mergeRoles(c),
  }));
  const value = { ...base, camps };
  cache = { at: Date.now(), value };
  return value;
}

export async function getCamp(slug: string): Promise<CampConfig | undefined> {
  return (await getConfig()).camps.find((c) => c.slug === slug);
}

/** Saves a camp created in the app to $DATA_DIR/camps.json (atomic rename, so a crash never leaves half a file). */
export async function addCamp(input: CampInput): Promise<CampConfig> {
  const camp = Camp.parse(input);
  if (RESERVED_SLUGS.includes(camp.slug)) throw new Error(`«${camp.slug}» ist als Kurzname reserviert.`);
  if (await getCamp(camp.slug)) throw new Error(`Es gibt schon ein Lager mit dem Kurznamen «${camp.slug}».`);
  const stored = await readStored();
  stored.camps.push(camp);
  await writeJson(dataFile(), stored);
  cache = null;
  return camp;
}

/** After the app changed roles: the next getConfig reads the files again. */
export function forgetConfig() {
  cache = null;
}
