/**
 * Who is AL or J+S Coach (whole Abteilung, top-level lists in camps.json) and who is
 * Hauptleitung of a camp (that camp's own list). Roles never widen Drive access.
 */
export type RoleLists = { al: string[]; coach: string[] };
export type Roles = { al: boolean; coach: boolean; hauptleitung: boolean; kueche: boolean };

const norm = (s: string) => s.trim().toLowerCase();

export function rolesOf(email: string | null | undefined, lists: RoleLists, camp?: { hauptleitung: string[]; kueche: string[] }): Roles {
  if (!email) return { al: false, coach: false, hauptleitung: false, kueche: false };
  const me = norm(email);
  const has = (list: string[]) => list.some((e) => norm(e) === me);
  return { al: has(lists.al), coach: has(lists.coach), hauptleitung: has(camp?.hauptleitung ?? []), kueche: has(camp?.kueche ?? []) };
}

/**
 * Who may open the Coach page. It shows eCamp block contents (notes, safety texts) that
 * come through the shared eCamp account, not the person's own access, so it stays narrow.
 */
export const canReview = (r: Roles) => r.al || r.coach || r.hauptleitung;

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

export const KITCHEN_ONLY = "Das dürfen nur das Küchenteam, die Hauptleitung und die Abteilungsleitung ändern (Rollen im Lager).";
