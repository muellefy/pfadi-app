import "server-only";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { CAMP_ROLES, type CampRoleLists } from "../campRoles.ts";
import { dataPath, writeJson } from "./dataDir.ts";

/** $DATA_DIR/roles.json: the per-camp roles the Hauptleitung manages in the app, by camp slug. */
const Lists = z.object(Object.fromEntries(CAMP_ROLES.map((r) => [r, z.array(z.string()).default([])])) as Record<keyof CampRoleLists, z.ZodDefault<z.ZodArray<z.ZodString>>>);
const Store = z.record(z.string(), Lists);
export type RoleStore = z.infer<typeof Store>;

export async function readRoleStore(): Promise<RoleStore> {
  const raw = await readFile(dataPath("roles.json"), "utf8").catch((e) => (e.code === "ENOENT" ? null : Promise.reject(e)));
  return raw ? Store.parse(JSON.parse(raw)) : {};
}

/** Callers serialize writes (lib/lock) so two changes can't overwrite each other. */
export async function writeCampRoles(slug: string, lists: CampRoleLists) {
  const store = await readRoleStore();
  store[slug] = lists;
  await writeJson(dataPath("roles.json"), store);
}
