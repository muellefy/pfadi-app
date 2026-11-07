"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Coins, Folder, Grid, Home, Pot, Users } from "./icons";

export function Nav({ slug }: { slug: string }) {
  const path = usePathname();
  const items = [
    { href: `/${slug}`, label: "Übersicht", short: "Übersicht", icon: Home, exact: true },
    { href: `/${slug}/termine`, label: "Termine", short: "Termine", icon: Calendar },
    { href: `/${slug}/personen`, label: "Teilnehmende & Leitende", short: "Personen", icon: Users },
    { href: `/${slug}/programm`, label: "Programm (eCamp)", short: "Programm", icon: Grid },
    { href: `/${slug}/menue`, label: "Menüplan", short: "Menü", icon: Pot },
    { href: `/${slug}/budget`, label: "Budget & Abrechnung", short: "Budget", icon: Coins },
    { href: `/${slug}/ablage`, label: "Ablage", short: "Ablage", icon: Folder },
  ];
  return (
    <nav className="nav" aria-label="Bereiche">
      {items.map(({ href, label, short, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon /> <span className="long">{label}</span><span className="short">{short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
