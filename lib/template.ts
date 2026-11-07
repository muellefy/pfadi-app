import "server-only";
import { copyFile, createFolder, getItemFresh, listChildrenFresh, type DriveItem } from "./drive";
import type { CopiedEntry } from "./camps";

const SHORTCUT = "application/vnd.google-apps.shortcut";
const PARALLEL = 4;

export type CopyResult = { root: DriveItem; entries: CopiedEntry[]; failed: string[] };

/**
 * Copies the template folder tree into `parentId` as a new folder `name`,
 * as the logged-in person (so Drive checks they may read the template and write the target).
 * Folders are recreated, files copied. A file that can't be copied (e.g. a Form) is
 * listed in `failed` instead of aborting the whole camp.
 */
export async function copyTemplate(templateId: string, parentId: string, name: string): Promise<CopyResult> {
  const [template, parent] = await Promise.all([getItemFresh(templateId), getItemFresh(parentId)]);
  if (!template.isFolder) throw new Error("Die Vorlage muss ein Ordner sein.");
  if (!parent.isFolder) throw new Error("Der Zielort muss ein Ordner sein.");
  if (!parent.canAddChildren) throw new Error(`Du darfst im Ordner «${parent.name}» nichts anlegen.`);

  const root = await createFolder(name, parentId);
  const entries: CopiedEntry[] = [];
  const failed: string[] = [];
  const queue: { src: string; dst: string; path: string[] }[] = [{ src: templateId, dst: root.id, path: [] }];

  // breadth-first, a few Drive calls at a time
  while (queue.length) {
    const batch = queue.splice(0, PARALLEL);
    await Promise.all(batch.map(async ({ src, dst, path }) => {
      const children = await listChildrenFresh(src);
      for (let i = 0; i < children.length; i += PARALLEL) {
        await Promise.all(children.slice(i, i + PARALLEL).map(async (c) => {
          const at = [...path, c.name];
          try {
            if (c.isFolder) {
              const f = await createFolder(c.name, dst);
              entries.push({ path: at, id: f.id, name: c.name, isFolder: true, mimeType: f.mimeType });
              queue.push({ src: c.id, dst: f.id, path: at });
            } else if (c.mimeType === SHORTCUT) {
              failed.push(`${at.join(" / ")} (Verknüpfung)`);
            } else {
              const f = await copyFile(c.id, c.name, dst);
              entries.push({ path: at, id: f.id, name: c.name, isFolder: false, mimeType: f.mimeType });
            }
          } catch (e) {
            failed.push(`${at.join(" / ")}${e instanceof Error ? ` (${e.message})` : ""}`);
          }
        }));
      }
    }));
  }
  return { root, entries, failed };
}
