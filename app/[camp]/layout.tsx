import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getCamp, getConfig } from "@/lib/config";
import { Nav } from "@/components/Nav";
import { Tent } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function CampLayout({ children, params }: { children: React.ReactNode; params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const [config, camp, session] = await Promise.all([getConfig(), getCamp(slug), auth()]);
  if (!camp) notFound();

  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="brand"><Tent size={22} /> {config.organisation}</Link>
        {config.camps.length > 1 && (
          <div className="camp-switch">
            <span className="label">Lager</span>
            {config.camps.map((c) => (
              <Link key={c.slug} href={`/${c.slug}`} aria-current={c.slug === slug}>{c.name}</Link>
            ))}
          </div>
        )}
        <Nav slug={slug} />
        <div className="me">
          <span>{session?.user?.name ?? session?.user?.email}</span>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="btn ghost small" style={{ paddingLeft: 0 }}>Abmelden</button>
          </form>
        </div>
      </aside>
      <main className="main">
        {session?.error && (
          <div className="notice error" style={{ marginBottom: 16 }}>
            Deine Google-Sitzung ist abgelaufen. <Link href="/login">Neu anmelden</Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
