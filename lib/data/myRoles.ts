import "server-only";
import { auth } from "@/auth";
import { canSeeCamp, rolesOf, type Roles } from "../roles";
import { getConfig, type CampConfig } from "./config";

/** The logged-in person's roles in this camp (plus AL/Coach). */
export async function myRoles(camp: CampConfig): Promise<Roles> {
  const [session, config] = await Promise.all([auth(), getConfig()]);
  return rolesOf(session?.user?.email, config.roles, camp);
}

/** Whether the logged-in person may use this camp at all (see canSeeCamp). */
export async function mayAccess(camp: CampConfig): Promise<boolean> {
  return canSeeCamp(await myRoles(camp), camp);
}
