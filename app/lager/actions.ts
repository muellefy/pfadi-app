"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { addCamp, getCamp, getConfig, RESERVED_SLUGS } from "@/lib/data/config";
import { CURRENT_COOKIE, detectFiles, driveId, ecampId, slugify } from "@/lib/camps";
import { serialize } from "@/lib/lock";
import { copyTemplate } from "@/lib/data/template";

const YEAR = 365 * 86_400;

/** Remembers the camp "/" opens, per person (a cookie, nothing is stored on the server). */
export async function chooseCamp(slug: string) {
  if (!(await getCamp(slug))) return;
  (await cookies()).set(CURRENT_COOKIE, slug, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: true });
}

export type CreateState = { error?: string; values?: Record<string, string> };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Creates a camp: copies the template folder tree into the chosen Drive folder,
 * finds Lagerdaten / TN- and Leiterliste in the copy, saves the camp and opens it.
 */
export async function createCamp(_prev: CreateState, form: FormData): Promise<CreateState> {
  const v = Object.fromEntries([...form.entries()].map(([k, x]) => [k, String(x).trim()]));
  const fail = (error: string): CreateState => ({ error, values: v });

  if (!(await auth())?.user) return fail("Bitte neu anmelden.");
  if (!v.name) return fail("Der Lagername fehlt.");
  const slug = slugify(v.slug || v.name);
  if (!slug || RESERVED_SLUGS.includes(slug)) return fail("Bitte einen anderen Kurznamen wählen.");
  if (await getCamp(slug)) return fail(`Es gibt schon ein Lager mit dem Kurznamen «${slug}».`);
  if ((v.start && !ISO.test(v.start)) || (v.end && !ISO.test(v.end))) return fail("Ungültiges Datum.");
  if (v.start && v.end && v.end < v.start) return fail("Das Lagerende liegt vor dem Lagerbeginn.");
  const parent = driveId(v.parent ?? "");
  if (!parent) return fail("Bitte den Zielordner als Drive-Link oder ID angeben.");
  const template = driveId(v.template ?? "") ?? (await getConfig()).templateFolderId;
  if (!template) return fail("Bitte den Vorlage-Ordner als Drive-Link oder ID angeben.");
  const ecamp = v.ecamp ? ecampId(v.ecamp) : null;
  if (v.ecamp && !ecamp) return fail("Die eCamp-Adresse ist ungültig (erwartet: app.ecamp3.ch/camps/<ID>/…).");

  let failed: string[] = [];
  try {
    // one camp creation at a time, so two people can't take the same slug
    await serialize("create-camp", async () => {
      if (await getCamp(slug)) throw new Error(`Es gibt schon ein Lager mit dem Kurznamen «${slug}».`);
      const copy = await copyTemplate(template, parent, v.folder || v.name);
      failed = copy.failed;
      await addCamp({
        slug,
        name: v.name,
        kind: v.kind || "Lager",
        motto: v.motto || undefined,
        start: v.start || undefined,
        end: v.end || undefined,
        drive: { rootFolderId: copy.root.id, ...detectFiles(copy.entries) },
        ecampCampId: ecamp ?? undefined,
        writeBack: true,
      });
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Das Lager konnte nicht angelegt werden.");
  }
  await chooseCamp(slug);
  if (failed.length) console.warn(`camp ${slug}: not copied:`, failed);
  redirect(`/${slug}`);
}
