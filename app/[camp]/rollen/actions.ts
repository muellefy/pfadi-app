"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { forgetConfig, getConfig } from "@/lib/data/config";
import { getMyCamp } from "@/lib/data/myRoles";
import { readRoleStore, writeCampRoles } from "@/lib/data/campRolesStore";
import { authorizeRoleChange, changeRole, checkRoleEmail, mergeRoles, splitEmails, type CampRole } from "@/lib/campRoles";
import { rolesOf } from "@/lib/roles";
import { serialize } from "@/lib/lock";

export type RoleResult = { ok: true } | { ok: false; error: string };
export type AddResult = { ok: true; added: number; invalid: string[] } | { ok: false; error: string };

const DOMAIN = (process.env.ALLOWED_DOMAIN ?? "pfadis.ch").toLowerCase();
// a camp has a few dozen leaders; these limits only stop accidents and abuse
const MAX_PASTE = 30_000;
const MAX_ADD = 300;

/** Gives or takes a camp role. Only the camp's Hauptleitung and the AL may; checked here, not in the page. */
export async function updateRole(slug: string, role: CampRole, email: string, add: boolean): Promise<RoleResult> {
  const address = String(email ?? "").trim().toLowerCase();
  const [session, config, camp] = await Promise.all([auth(), getConfig(), getMyCamp(String(slug))]);
  if (!camp) return { ok: false, error: "Unbekanntes Lager." };
  const denied = authorizeRoleChange(rolesOf(session?.user?.email, config.roles, camp), String(role), address, add === true, DOMAIN);
  if (denied) return { ok: false, error: denied };
  const result = await serialize("roles", async () => {
    const stored = mergeRoles({}, (await readRoleStore())[slug]);
    const changed = changeRole(stored, camp.fixedRoles ?? mergeRoles({}), role, address, add === true);
    if ("error" in changed) return changed;
    await writeCampRoles(slug, changed.stored);
    forgetConfig();
    return null;
  });
  if (result) return { ok: false, error: result.error };
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

/** Adds every valid address of a pasted list to a camp role; the others come back so the page can name them. */
export async function addRoleMembers(slug: string, role: CampRole, text: string): Promise<AddResult> {
  const [session, config, camp] = await Promise.all([auth(), getConfig(), getMyCamp(String(slug))]);
  if (!camp) return { ok: false, error: "Unbekanntes Lager." };
  // permission and role name before any parsing, so nobody else can make the server work on their input
  const denied = authorizeRoleChange(rolesOf(session?.user?.email, config.roles, camp), String(role), "", false, DOMAIN);
  if (denied) return { ok: false, error: denied };
  const raw = String(text ?? "");
  if (raw.length > MAX_PASTE) return { ok: false, error: "Das ist zu viel Text auf einmal. Bitte in kleineren Teilen einfügen." };
  const emails = splitEmails(raw);
  if (!emails.length) return { ok: false, error: "Bitte mindestens eine E-Mail-Adresse eingeben." };
  if (emails.length > MAX_ADD) return { ok: false, error: `Höchstens ${MAX_ADD} Adressen auf einmal (du hast ${emails.length} eingefügt).` };
  const valid = emails.filter((e) => !checkRoleEmail(e, DOMAIN));
  const invalid = emails.filter((e) => checkRoleEmail(e, DOMAIN));
  if (valid.length) {
    await serialize("roles", async () => {
      let stored = mergeRoles({}, (await readRoleStore())[slug]);
      for (const e of valid) {
        const changed = changeRole(stored, camp.fixedRoles ?? mergeRoles({}), role, e, true);
        if ("stored" in changed) stored = changed.stored;
      }
      await writeCampRoles(slug, stored);
      forgetConfig();
    });
    revalidatePath(`/${slug}`, "layout");
  }
  return { ok: true, added: valid.length, invalid };
}
