import "server-only";
import { auth } from "@/auth";
import { rolesOf, visibleCamp, type Roles } from "../roles";
import { getConfig, type CampConfig } from "./config";

/** The logged-in person's roles in this camp (plus AL/Coach). */
export async function myRoles(camp: CampConfig): Promise<Roles> {
  const [session, config] = await Promise.all([auth(), getConfig()]);
  return rolesOf(session?.user?.email, config.roles, camp);
}

/**
 * The camp for this URL, or undefined if it doesn't exist or this person may not see it
 * (see visibleCamp). Every camp page and action loads its camp through here.
 */
export async function getMyCamp(slug: string): Promise<CampConfig | undefined> {
  const [session, config] = await Promise.all([auth(), getConfig()]);
  return visibleCamp(config.camps, config.roles, String(slug), session?.user?.email);
}
