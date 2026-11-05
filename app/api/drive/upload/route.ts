import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileErrorResponse, uploadFile } from "@/lib/drive";

/** Only accept uploads started from this app (blocks cross-site form posts). */
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = new URL(origin).host;
  const allowed = [req.headers.get("x-forwarded-host"), req.headers.get("host")];
  if (process.env.AUTH_URL) allowed.push(new URL(process.env.AUTH_URL).host);
  return allowed.includes(host);
}

/**
 * POST /api/drive/upload?folder=<id>, body = the raw file, header x-file-name.
 * The body is streamed straight to Drive, so large files never sit in memory.
 * This path is excluded from the middleware (which would buffer the body);
 * uploadFile() checks the session itself.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Ungültige Herkunft.", { status: 403 });
  const folder = new URL(req.url).searchParams.get("folder");
  let name = "";
  try { name = decodeURIComponent(req.headers.get("x-file-name") ?? "").trim(); } catch { /* invalid encoding */ }
  if (!folder || !name || name.length > 255 || !req.body) return new Response("Ordner oder Dateiname fehlt.", { status: 400 });

  try {
    const type = req.headers.get("content-type") || "application/octet-stream";
    const item = await uploadFile(folder, name, type, Readable.fromWeb(req.body as NodeReadableStream));
    return Response.json({ ok: true, item });
  } catch (e) {
    return fileErrorResponse(e);
  }
}
