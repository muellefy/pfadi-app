import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * Camps are configured in config/camps.json (mounted into the container),
 * so adding the next Lager never needs a rebuild.
 */
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
  }),
  ecampCampId: z.string().optional(), // id from the eCamp URL: app.ecamp3.ch/camps/<id>/...
  writeBack: z.boolean().default(false),
});
export type CampConfig = z.infer<typeof Camp>;

const Config = z.object({
  organisation: z.string().default("Pfadi"),
  camps: z.array(Camp).min(1),
});
export type AppConfig = z.infer<typeof Config>;

let cache: { at: number; value: AppConfig } | null = null;

export async function getConfig(): Promise<AppConfig> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const file = process.env.CAMPS_CONFIG ?? path.join(process.cwd(), "config", "camps.json");
  const raw = await readFile(file, "utf8").catch(() => {
    throw new Error(`Konfiguration fehlt: ${file}. Kopiere config/camps.example.json nach config/camps.json.`);
  });
  const value = Config.parse(JSON.parse(raw));
  cache = { at: Date.now(), value };
  return value;
}

export async function getCamp(slug: string): Promise<CampConfig | undefined> {
  return (await getConfig()).camps.find((c) => c.slug === slug);
}
