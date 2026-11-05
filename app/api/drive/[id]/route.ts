import { Readable } from "node:stream";
import { fileErrorResponse, openFile } from "@/lib/drive";

/** RFC 6266 header that keeps umlauts in file names intact. */
function disposition(type: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * GET /api/drive/<id>            → preview (PDF/image inline, Google files as PDF)
 * GET /api/drive/<id>?download=1 → download as attachment
 * Runs as the logged-in person, so Drive's sharing decides what they get.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const download = new URL(req.url).searchParams.has("download");
  try {
    const file = await openFile(id, download ? "download" : "preview");
    const headers = new Headers({
      "content-type": file.mimeType,
      "content-disposition": disposition(file.inline ? "inline" : "attachment", file.name),
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    });
    if (file.size != null) headers.set("content-length", String(file.size));
    return new Response(Readable.toWeb(file.stream) as ReadableStream, { headers });
  } catch (e) {
    return fileErrorResponse(e);
  }
}
