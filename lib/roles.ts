/**
 * Who is AL or J+S Coach (whole Abteilung, top-level lists in camps.json) and who is
 * Hauptleitung, Küche or Leiter of a camp (that camp's own lists). Roles never widen Drive access.
 */
export type RoleLists = { al: string[]; coach: string[] };
export type Roles = { al: boolean; coach: boolean; hauptleitung: boolean; kueche: boolean; leiter: boolean };

const norm = (s: string) => s.trim().toLowerCase();

export function rolesOf(email: string | null | undefined, lists: RoleLists, camp?: { hauptleitung: string[]; kueche: string[]; leiter?: string[] }): Roles {
  if (!email) return { al: false, coach: false, hauptleitung: false, kueche: false, leiter: false };
  const me = norm(email);
  const has = (list: string[]) => list.some((e) => norm(e) === me);
  return { al: has(lists.al), coach: has(lists.coach), hauptleitung: has(camp?.hauptleitung ?? []), kueche: has(camp?.kueche ?? []), leiter: has(camp?.leiter ?? []) };
}

/**
 * Who may open the Coach page. It shows eCamp block contents (notes, safety texts) that
 * come through the shared eCamp account, not the person's own access, so it stays narrow.
 */
export const canReview = (r: Roles) => r.al || r.coach || r.hauptleitung;

/**
 * Who sees a camp in the app. Without Leiter it's open to everyone (as before roles); once the
 * Hauptleitung added Leiter, only its members and the AL/Coach. Hides, doesn't lock: Drive decides files.
 */
export const canSeeCamp = (r: Roles, camp: { leiter: string[] }) =>
  camp.leiter.length === 0 || r.al || r.coach || r.hauptleitung || r.kueche || r.leiter;

/**
 * The camp behind a URL slug, if this person may see it; undefined otherwise. Every camp page and
 * action goes through this: a layout alone can't hide a page, Next renders pages next to it.
 */
export function visibleCamp<C extends { slug: string; hauptleitung: string[]; kueche: string[]; leiter: string[] }>(
  camps: C[], lists: RoleLists, slug: string, email: string | null | undefined,
): C | undefined {
  const camp = camps.find((c) => c.slug === slug);
  return camp && canSeeCamp(rolesOf(email, lists, camp), camp) ? camp : undefined;
}

/** Who may assign the roles of a camp: its Hauptleitung (the camp's admin) and the AL. */
export const canManageRoles = (r: Roles) => r.al || r.hauptleitung;

/**
 * Who may change the Menüplan and kitchen bookings. A camp without a Küche team works as
 * before (Drive rights decide); once someone is Küche, only Küche, Hauptleitung and AL.
 */
export const canCook = (r: Roles, camp: { kueche: string[] }) => camp.kueche.length === 0 || r.kueche || r.hauptleitung || r.al;

const KITCHEN_WORD = /^(essen|küche|kueche|verpflegung|lebensmittel)$/;

/**
 * Budget categories that belong to the kitchen. Template names are "Section: Item", and only
 * the section counts ("Verpflegung: weiteres" yes, "Rekognoszierung: Reise, Verpflegung" no);
 * names without a section match on whole words ("Ausgaben - Essen").
 */
export function isKitchenCategory(category: string): boolean {
  const name = category.normalize("NFC").toLowerCase();
  const section = name.includes(":") ? name.slice(0, name.indexOf(":")) : name;
  return section.split(/[^a-zäöüß]+/).some((w) => KITCHEN_WORD.test(w));
}

/** A booking change someone outside the kitchen may not make: writing a kitchen category, or overwriting one. */
export const kitchenBlocked = (cook: boolean, category: string, before?: string) =>
  !cook && (isKitchenCategory(category) || (before !== undefined && isKitchenCategory(before)));

export const NO_ACCESS = "Du bist in diesem Lager nicht als Leiter eingetragen. Die Hauptleitung kann dich unter «Rollen im Lager» hinzufügen.";

export const KITCHEN_ONLY = "Das dürfen nur das Küchenteam, die Hauptleitung und die Abteilungsleitung ändern (Rollen im Lager).";
