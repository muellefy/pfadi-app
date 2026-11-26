import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/data/config";
import { CURRENT_COOKIE, pickCurrent } from "@/lib/camps";
import { auth } from "@/auth";
import { rolesOf } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Opens the camp the person chose as current (see /lager), else the running or next one.
 * The kitchen team starts on that camp's Menüplan.
 */
export default async function Index() {
  const [config, jar, session] = await Promise.all([getConfig(), cookies(), auth()]);
  const slug = pickCurrent(config.camps, jar.get(CURRENT_COOKIE)?.value);
  if (!slug) redirect("/lager");
  const camp = config.camps.find((c) => c.slug === slug);
  const roles = camp ? rolesOf(session?.user?.email, config.roles, camp) : null;
  redirect(roles?.kueche && !roles.hauptleitung ? `/${slug}/menue` : `/${slug}`);
}
