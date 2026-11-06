"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Folder, Grid, Home, Users } from "./icons";

export function Nav({ slug }: { slug: string }) {
  const path = usePathname();
  const items = [
    { href: `/${slug}`, label: "Übersicht", icon: Home, exact: true },
    { href: `/${slug}/termine`, label: "Termine", icon: Calendar },
    { href: `/${slug}/personen`, label: "Teilnehmende & Leitende", icon: Users },
    { href: `/${slug}/programm`, label: "Programm (eCamp)", icon: Grid },
    { href: `/${slug}/ablage`, label: "Ablage", icon: Folder },
  ];
  return (
    <nav className="nav" aria-label="Bereiche">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
