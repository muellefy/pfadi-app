import { z } from "zod";

/** A list of emails; a single address without brackets is taken as a list of one. */
export const emailList = z.preprocess((v) => (typeof v === "string" ? [v] : v), z.array(z.string())).default([]);

/** Where a JSON syntax error is, as "Zeile 3, Spalte 3" (from Node's message or the position). */
function where(raw: string, message: string): string {
  const lc = message.match(/line (\d+) column (\d+)/);
  if (lc) return `Zeile ${lc[1]}, Spalte ${lc[2]}`;
  const pos = Number(message.match(/position (\d+)/)?.[1]);
  if (!Number.isFinite(pos)) return "unbekannte Stelle";
  const before = raw.slice(0, pos).split("\n");
  return `Zeile ${before.length}, Spalte ${before[before.length - 1].length + 1}`;
}

/**
 * Reads a JSON config file with a readable German error: it lands in the server log,
 * where whoever runs the app looks when a page only shows an error number.
 */
export function parseConfigFile<S extends z.ZodType>(schema: S, raw: string, file: string): z.infer<S> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${file}: kein gültiges JSON bei ${where(raw, msg)} – meist fehlt dort oder in der Zeile davor ein Komma, oder es steht eines zu viel vor } oder ]. (${msg})`);
  }
  const res = schema.safeParse(data);
  if (res.success) return res.data;
  const issues = res.error.issues.map((i) => `${i.path.join(".") || "(ganze Datei)"}: ${i.message}`).join("; ");
  throw new Error(`${file}: ungültiger Wert – ${issues}`);
}
