import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getConfig } from "@/lib/config";
import { Tent } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Frame for the camp overview and "Neues Lager": no camp sidebar, just the brand and sign-out. */
export default async function LagerLayout({ children }: { children: React.ReactNode }) {
  const [config, session] = await Promise.all([getConfig(), auth()]);
  return (
    <div className="solo">
      <header className="solo-head">
        <Link href="/lager" className="brand"><Tent size={22} /> {config.organisation}</Link>
        <div className="me">
          <span>{session?.user?.name ?? session?.user?.email}</span>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="btn ghost small">Abmelden</button>
          </form>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
