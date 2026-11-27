"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Check, Coins, Folder, Grid, Home, List, Pot, Sun, Users } from "./icons";

/** `coach`: show the Coach page (see canReview); `kitchenFirst`: the Menüplan leads (Küche role) */
export function Nav({ slug, coach = false, kitchenFirst = false }: { slug: string; coach?: boolean; kitchenFirst?: boolean }) {
  const path = usePathname();
  const items = [
    { href: `/${slug}`, label: "Übersicht", short: "Übersicht", icon: Home, exact: true },
    // desk: only in the sidebar; the phone tab bar is full (Heute is a card on the Übersicht there, Ämtli linked from Heute)
    { href: `/${slug}/heute`, label: "Heute im Lager", short: "Heute", icon: Sun, desk: true },
    { href: `/${slug}/termine`, label: "Termine", short: "Termine", icon: Calendar },
    { href: `/${slug}/personen`, label: "Teilnehmende & Leitende", short: "Personen", icon: Users },
    { href: `/${slug}/programm`, label: "Programm (eCamp)", short: "Programm", icon: Grid },
    ...(coach ? [{ href: `/${slug}/coach`, label: "Coach-Durchsicht", short: "Coach", icon: Check }] : []),
    { href: `/${slug}/menue`, label: "Menüplan", short: "Menü", icon: Pot },
    { href: `/${slug}/aemtli`, label: "Ämtliplan", short: "Ämtli", icon: List, desk: true },
    { href: `/${slug}/budget`, label: "Budget & Abrechnung", short: "Budget", icon: Coins },
    { href: `/${slug}/ablage`, label: "Ablage", short: "Ablage", icon: Folder },
  ];
  if (kitchenFirst) items.unshift(...items.splice(items.findIndex((i) => i.href.endsWith("/menue")), 1));
  return (
    <nav className="nav" aria-label="Bereiche">
      {items.map(({ href, label, short, icon: Icon, exact, desk }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={desk ? "desk-only" : undefined}>
            <Icon /> <span className="long">{label}</span><span className="short">{short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
