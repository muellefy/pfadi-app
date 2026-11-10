import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/data/config";
import { CURRENT_COOKIE, pickCurrent } from "@/lib/camps";

export const dynamic = "force-dynamic";

/** Opens the camp the person chose as current (see /lager), else the running or next one. */
export default async function Index() {
  const [{ camps }, jar] = await Promise.all([getConfig(), cookies()]);
  const slug = pickCurrent(camps, jar.get(CURRENT_COOKIE)?.value);
  redirect(slug ? `/${slug}` : "/lager");
}
