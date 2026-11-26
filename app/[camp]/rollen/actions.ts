"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { forgetConfig, getCamp, getConfig } from "@/lib/data/config";
import { readRoleStore, writeCampRoles } from "@/lib/data/campRolesStore";
import { authorizeRoleChange, changeRole, mergeRoles, type CampRole } from "@/lib/campRoles";
import { rolesOf } from "@/lib/roles";
import { serialize } from "@/lib/lock";

export type RoleResult = { ok: true } | { ok: false; error: string };

const DOMAIN = (process.env.ALLOWED_DOMAIN ?? "pfadis.ch").toLowerCase();

/** Gives or takes a camp role. Only the camp's Hauptleitung and the AL may; checked here, not in the page. */
export async function updateRole(slug: string, role: CampRole, email: string, add: boolean): Promise<RoleResult> {
  const address = String(email ?? "").trim().toLowerCase();
  const [session, config, camp] = await Promise.all([auth(), getConfig(), getCamp(String(slug))]);
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
