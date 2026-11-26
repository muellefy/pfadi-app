"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { forgetConfig, getCamp, getConfig } from "@/lib/data/config";
import { readRoleStore, writeCampRoles } from "@/lib/data/campRolesStore";
import { CAMP_ROLES, changeRole, checkRoleEmail, mergeRoles, type CampRole } from "@/lib/campRoles";
import { canManageRoles, rolesOf } from "@/lib/roles";
import { serialize } from "@/lib/lock";

export type RoleResult = { ok: true } | { ok: false; error: string };

const DOMAIN = (process.env.ALLOWED_DOMAIN ?? "pfadis.ch").toLowerCase();

/** Gives or takes a camp role. Only the camp's Hauptleitung and the AL may; checked here, not in the page. */
export async function updateRole(slug: string, role: CampRole, email: string, add: boolean): Promise<RoleResult> {
  if (!CAMP_ROLES.includes(role)) return { ok: false, error: "Unbekannte Rolle." };
  const address = String(email ?? "").trim().toLowerCase();
  if (add) {
    const bad = checkRoleEmail(address, DOMAIN);
    if (bad) return { ok: false, error: bad };
  }
  const [session, config, camp] = await Promise.all([auth(), getConfig(), getCamp(slug)]);
  if (!camp) return { ok: false, error: "Unbekanntes Lager." };
  if (!canManageRoles(rolesOf(session?.user?.email, config.roles, camp))) {
    return { ok: false, error: "Nur die Hauptleitung dieses Lagers und die Abteilungsleitung dürfen Rollen vergeben." };
  }
  const result = await serialize("roles", async () => {
    const stored = mergeRoles({}, (await readRoleStore())[slug]);
    const changed = changeRole(stored, camp.fixedRoles ?? mergeRoles({}), role, address, add);
    if ("error" in changed) return changed;
    await writeCampRoles(slug, changed.stored);
    forgetConfig();
    return null;
  });
  if (result) return { ok: false, error: result.error };
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}
