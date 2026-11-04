import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Index() {
  const { camps } = await getConfig();
  redirect(`/${camps[0].slug}`);
}
