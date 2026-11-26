import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getCamp, getConfig } from "@/lib/data/config";
import { Nav } from "@/components/Nav";
import { Tent } from "@/components/icons";
import { canReview, canSeeCamp, NO_ACCESS, rolesOf } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function CampLayout({ children, params }: { children: React.ReactNode; params: Promise<{ camp: string }> }) {
  const { camp: slug } = await params;
  const [config, camp, session] = await Promise.all([getConfig(), getCamp(slug), auth()]);
  if (!camp) notFound();
  const roles = rolesOf(session?.user?.email, config.roles, camp);
  const email = session?.user?.email;
  const visible = config.camps.filter((c) => canSeeCamp(rolesOf(email, config.roles, c), c));
  const allowed = canSeeCamp(roles, camp);

  return (
    <div className="shell">
      <aside className="side">
        <Link href="/lager" className="brand"><Tent size={22} /> {config.organisation}</Link>
        <nav className="camp-switch" aria-label="Lager">
          <span className="label">Lager</span>
          {visible.map((c) => (
            <Link key={c.slug} href={`/${c.slug}`} aria-current={c.slug === slug}>{c.name}</Link>
          ))}
          <Link href="/lager" className="all">Alle Lager / neues Lager</Link>
        </nav>
        {allowed && <Nav slug={slug} coach={canReview(roles)} kitchenFirst={roles.kueche && !roles.hauptleitung} />}
        <div className="me">
          <span>
            {session?.user?.name ?? session?.user?.email}
            {roles.al && <span className="pill" style={{ marginLeft: 6 }}>AL</span>}
            {roles.coach && <span className="pill" style={{ marginLeft: 6 }}>Coach</span>}
            {roles.hauptleitung && <span className="pill" style={{ marginLeft: 6 }}>Hauptleitung</span>}
            {roles.kueche && <span className="pill" style={{ marginLeft: 6 }}>Küche</span>}
            {roles.leiter && !roles.hauptleitung && <span className="pill" style={{ marginLeft: 6 }}>Leiter</span>}
          </span>
          {allowed && <Link href={`/${slug}/rollen`} className="small">Rollen im Lager</Link>}
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
        {/* a camp with Leiter shows nothing of itself to people who aren't in it */}
        {allowed ? children : (
          <div className="notice">
            <b>Kein Zugang zu «{camp.name}».</b> {NO_ACCESS} <Link href="/lager">Zu deinen Lagern</Link>
          </div>
        )}
      </main>
    </div>
  );
}
