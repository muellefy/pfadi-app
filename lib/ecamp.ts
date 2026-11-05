import "server-only";

/**
 * Read-only client for the eCamp v3 HAL+JSON API (https://app.ecamp3.ch/api).
 *
 * Uses one technical eCamp account (ECAMP_EMAIL / ECAMP_PASSWORD) that you invite
 * to each camp as "Gast" (guest) — read access is all it needs.
 * Login: POST /api/authentication_token {identifier, password} sets the split
 * JWT cookies (…jwt_hp + …jwt_s), which we forward on every request.
 */
const BASE = (process.env.ECAMP_URL ?? "https://app.ecamp3.ch").replace(/\/$/, "");
// eCamp sits behind Cloudflare, which blocks Node's default user agent with a 403.
const USER_AGENT = "pfadi-app (+https://github.com/muellefy/pfadi-app)";

type Hal = Record<string, any> & { _links?: Record<string, { href: string }>; _embedded?: Record<string, any> };

let session: { cookie: string; until: number } | null = null;

export const ecampConfigured = () => Boolean(process.env.ECAMP_EMAIL && process.env.ECAMP_PASSWORD);

async function login() {
  const res = await fetch(`${BASE}/api/authentication_token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/hal+json", "user-agent": USER_AGENT },
    body: JSON.stringify({ identifier: process.env.ECAMP_EMAIL, password: process.env.ECAMP_PASSWORD }),
    redirect: "manual",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`eCamp-Login fehlgeschlagen (${res.status}). Stimmen ECAMP_EMAIL/ECAMP_PASSWORD?`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("eCamp hat kein Login-Cookie gesetzt.");
  session = { cookie, until: Date.now() + 45 * 60_000 };
}

async function get(pathOrHref: string, retry = true): Promise<Hal> {
  if (!session || Date.now() > session.until) await login();
  const url = pathOrHref.startsWith("http") ? pathOrHref : `${BASE}${pathOrHref}`;
  const res = await fetch(url, {
    headers: { accept: "application/hal+json", "user-agent": USER_AGENT, cookie: session!.cookie },
    next: { revalidate: 120 },
  });
  if (res.status === 401 && retry) { session = null; return get(pathOrHref, false); }
  if (!res.ok) throw new Error(`eCamp ${res.status} bei ${new URL(url).pathname}`);
  return res.json();
}

const items = (h: Hal): Hal[] => h._embedded?.items ?? [];
const href = (h: Hal, rel: string) => h._links?.[rel]?.href;

export type EcampEntry = {
  id: string; start: string; end: string; number?: string;
  title: string; location: string; category: string; categoryShort: string; color: string;
  progress?: string; url: string;
};
export type EcampProgram = {
  title: string; motto?: string; url: string;
  periods: { id: string; description: string; start: string; end: string }[];
  categories: { short: string; name: string; color: string; count: number }[];
  entries: EcampEntry[];
  team: { name: string; role: string; status: string; abbreviation?: string; color?: string }[];
};

const ROLE: Record<string, string> = { manager: "Lagerleitung", member: "Leiter*in", guest: "Gast" };

export async function getProgram(campId: string): Promise<EcampProgram> {
  const campHref = `/api/camps/${campId}`;
  const q = encodeURIComponent(campHref);
  const [camp, periods, categories, activities, collabs, labels] = await Promise.all([
    get(campHref),
    get(`/api/periods?camp=${q}`),
    get(`/api/categories?camp=${q}`),
    get(`/api/activities?camp=${q}`),
    get(`/api/camp_collaborations?camp=${q}`),
    get(`/api/camps/${campId}/activity_progress_labels`).catch(() => ({}) as Hal),
  ]);

  const catByHref = new Map(items(categories).map((c) => [href(c, "self"), c]));
  const actByHref = new Map(items(activities).map((a) => [href(a, "self"), a]));
  const labelByHref = new Map(items(labels).map((l) => [href(l, "self"), l.title as string]));

  const entryLists = await Promise.all(
    items(periods).map((p) => get(`/api/schedule_entries?period=${encodeURIComponent(href(p, "self")!)}`)),
  );

  const entries: EcampEntry[] = entryLists.flatMap(items).map((e) => {
    const act = actByHref.get(href(e, "activity")) ?? e._embedded?.activity ?? {};
    const cat = catByHref.get(href(act, "category")) ?? {};
    const id = String(href(e, "self") ?? "").split("/").pop()!;
    return {
      id,
      start: e.start,
      end: e.end,
      number: e.number,
      title: act.title ?? "(ohne Titel)",
      location: act.location ?? "",
      category: cat.name ?? "",
      categoryShort: cat.short ?? "",
      color: cat.color ?? "#94a3b8",
      progress: labelByHref.get(href(act, "progressLabel")),
      url: `${BASE}/camps/${campId}/program/activities/${id}`,
    };
  });
  entries.sort((a, b) => a.start.localeCompare(b.start));

  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.categoryShort, (counts.get(e.categoryShort) ?? 0) + 1);

  const team = items(collabs)
    .filter((c) => c.status !== "inactive")
    .map((c) => {
      const user = c._embedded?.user ?? {};
      return {
        name: user.displayName ?? c.inviteEmail ?? "Eingeladen",
        role: ROLE[c.role] ?? c.role,
        status: c.status,
        abbreviation: c.abbreviation ?? undefined,
        color: c.color ?? undefined,
      };
    });

  return {
    title: camp.title,
    motto: camp.motto ?? undefined,
    url: `${BASE}/camps/${campId}`,
    periods: items(periods).map((p) => ({
      id: String(href(p, "self")).split("/").pop()!,
      description: p.description ?? "",
      start: p.start,
      end: p.end,
    })),
    categories: items(categories).map((c) => ({
      short: c.short, name: c.name, color: c.color, count: counts.get(c.short) ?? 0,
    })),
    entries,
    team,
  };
}
