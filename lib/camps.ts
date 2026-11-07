/**
 * Pure helpers for choosing and creating camps (no Drive or file access, so they are unit-tested).
 */

export const CURRENT_COOKIE = "lager";

type Dated = { slug: string; start?: string; end?: string };

/**
 * Which camp "/" opens: the one the person picked (cookie), else the camp that is
 * running now, else the next one to start, else the most recent one.
 */
export function pickCurrent(camps: Dated[], chosen: string | undefined, today = new Date().toISOString().slice(0, 10)) {
  if (chosen && camps.some((c) => c.slug === chosen)) return chosen;
  const running = camps.find((c) => c.start && c.start <= today && (c.end ?? c.start) >= today);
  if (running) return running.slug;
  const upcoming = camps.filter((c) => c.start && c.start > today).sort((a, b) => a.start!.localeCompare(b.start!));
  if (upcoming.length) return upcoming[0].slug;
  const past = camps.filter((c) => c.start).sort((a, b) => b.start!.localeCompare(a.start!));
  return (past[0] ?? camps[0])?.slug;
}

/** Accepts a Drive link (folders/…, file/d/…, open?id=…) or a bare id. */
export function driveId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/folders\/([\w-]{10,})/) ?? s.match(/\/d\/([\w-]{10,})/) ?? s.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1];
  return /^[\w-]{10,}$/.test(s) ? s : null;
}

/** Accepts an eCamp link (…/camps/<id>/…) or a bare id. */
export function ecampId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/\/camps\/([a-z0-9]+)/i);
  if (m) return m[1];
  return /^[a-z0-9]+$/i.test(s) ? s : null;
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export type CopiedEntry = { path: string[]; id: string; name: string; isFolder: boolean; mimeType: string };

const TABLE = /\.(xlsx|csv)$/i;
const TN_LIST = /(^|[^a-z])tn[\s_-]*listen?\b/i; // "121_TN Liste", "TN-Liste.xlsx"
const isTable = (e: CopiedEntry) => TABLE.test(e.name) || e.mimeType === "application/vnd.google-apps.spreadsheet";

/**
 * Finds the well-known files in a freshly copied template, by name:
 * Lagerdaten (Termine), the TN and Leiter lists (a folder or a sheet).
 */
export function detectFiles(entries: CopiedEntry[]) {
  const find = (test: (e: CopiedEntry) => boolean) => entries.find(test)?.id;
  const named = (re: RegExp) => (e: CopiedEntry) => re.test(e.name);
  return {
    termineFileId: find((e) => !e.isFolder && isTable(e) && /lagerdaten|termine/i.test(e.name)),
    tnFileId: find((e) => e.isFolder && TN_LIST.test(e.name)) ?? find((e) => !e.isFolder && isTable(e) && named(TN_LIST)(e)),
    leiterFileId: find((e) => e.isFolder && /leiter.*liste|leiterliste/i.test(e.name)) ?? find((e) => !e.isFolder && isTable(e) && /leiter.*liste/i.test(e.name)),
  };
}
