import "server-only";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** A file in $DATA_DIR, where the app keeps what it writes itself (camps, roles). */
export const dataPath = (name: string) =>
  path.join(process.env.DATA_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data"), name);

/** Writes JSON atomically (temp file + rename), so a crash never leaves half a file. */
export async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(`${file}.tmp`, file);
}
