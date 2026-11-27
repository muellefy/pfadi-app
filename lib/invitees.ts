/**
 * Who gets a calendar invitation for a Termin: the «Wer» cell of Lagerdaten.xlsx turned into
 * addresses. It may name roles (Coach, AL, HL/Lagerleitung, Küche, Alle), people from the
 * Leiter list, or addresses; everything else comes back as unknown so the page can say so.
 */
export type InviteContext = {
  al: string[]; coach: string[]; hauptleitung: string[]; kueche: string[]; leiter: string[];
  /** Leiter list rows: the names someone goes by, and their address (may be empty) */
  people: { names: string[]; email: string }[];
  /** ALLOWED_DOMAIN: addresses typed into «Wer» must be from here or already known to the app */
  domain: string;
};

const norm = (s: string) => s.trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function roleEmails(word: string, c: InviteContext): string[] | undefined {
  switch (word) {
    case "al": case "abteilungsleitung": return c.al;
    case "coach": case "j+s coach": case "j+s-coach": return c.coach;
    case "hl": case "hauptleitung": case "lagerleitung": case "ll": return c.hauptleitung;
    case "küche": case "kueche": case "küchenteam": return c.kueche;
    case "alle": case "leitende": case "leiter": case "leitungsteam": case "team": return [...c.hauptleitung, ...c.kueche, ...c.leiter];
  }
}

/**
 * Anyone who can edit the sheet can write into «Wer», but the invitations go out from the
 * Hauptleitung's account: so a typed address only counts if it's from the Abteilung's domain
 * or already in the roles or the Leiter list. Others come back as unknown.
 */
export function invitees(wer: string, c: InviteContext): { emails: string[]; unknown: string[] } {
  const known = new Set([...c.al, ...c.coach, ...c.hauptleitung, ...c.kueche, ...c.leiter, ...c.people.map((p) => p.email)].map(norm));
  const allowed = (e: string) => known.has(e) || e.endsWith(`@${c.domain.toLowerCase()}`);
  const emails: string[] = [];
  const unknown: string[] = [];
  for (const part of wer.split(/\s*(?:[,;/&\n]|\s\+\s|\bund\b)\s*/i)) {
    const word = norm(part);
    if (!word) continue;
    const found = EMAIL.test(word) ? (allowed(word) ? [word] : [])
      : roleEmails(word, c) ?? c.people.filter((p) => p.email && p.names.some((n) => norm(n) === word)).map((p) => p.email);
    if (found.length) emails.push(...found.map(norm));
    else unknown.push(part.trim());
  }
  return { emails: [...new Set(emails)], unknown };
}

/** The Leiter list as people to invite: the names someone goes by (Pfadiname, Vorname, full name) and their address. */
export function contactsOf(t: import("./people").PersonTable): InviteContext["people"] {
  const { roles: c } = t;
  return t.rows.map((r) => {
    const first = c.vorname ? r[c.vorname] ?? "" : "";
    const full = [first, c.nachname ? r[c.nachname] ?? "" : ""].filter(Boolean).join(" ");
    return { names: [c.pfadiname ? r[c.pfadiname] ?? "" : "", first, full].filter(Boolean), email: c.email ? (r[c.email] ?? "").trim() : "" };
  });
}
