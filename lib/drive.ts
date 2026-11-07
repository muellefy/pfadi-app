import "server-only";
import { auth as gauth, drive as gdrive, type drive_v3 } from "@googleapis/drive";
import { Readable } from "node:stream";
import { cache } from "react";
import { auth } from "@/auth";
import { cached, forget } from "./cache";
import { googleExport, previewKind } from "./files";

/** For small metadata/table requests: a stalled call must not hold the Termine write lock forever. Not for streamed files. */
const SMALL = { timeout: 30_000 };

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: number;
  modifiedBy?: string;
  isFolder: boolean;
  /** the logged-in person may upload into this folder */
  canAddChildren: boolean;
};

export const FOLDER = "application/vnd.google-apps.folder";
const SHEET = "application/vnd.google-apps.spreadsheet";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TABLE_TYPES = [SHEET, XLSX, "text/csv", "application/vnd.ms-excel"];

export class AuthError extends Error {}

/**
 * Drive client acting as the logged-in user (their permissions, not a service account).
 * Built once per request; outside a React render (route handlers) cache() just calls through.
 */
const session = cache(async () => {
  const s = await auth();
  if (!s?.accessToken || s.error) throw new AuthError("Google-Sitzung abgelaufen – bitte neu anmelden.");
  const oauth = new gauth.OAuth2();
  oauth.setCredentials({ access_token: s.accessToken });
  return { drive: gdrive({ version: "v3", auth: oauth }), who: (s.user?.email ?? s.accessToken).toLowerCase() };
});
const client = async (): Promise<drive_v3.Drive> => (await session()).drive;

/**
 * File and folder metadata, cached *per person* (so Drive still decides who sees what):
 * fresh for 20 s, then served stale for up to 10 min while it reloads in the background.
 * Clicking around therefore never waits for Drive; a change made directly in Drive
 * shows up on the next-but-one page load at the latest.
 */
const META_TTL = 20_000;
const META_STALE = 10 * 60_000;
async function perPerson<T>(kind: string, id: string, fn: () => Promise<T>): Promise<T> {
  const { who } = await session();
  return cached(`${kind}:${who}:${id}`, META_TTL, fn, META_STALE);
}

/** Call after the app changed something in a folder or file, so the next page shows it. */
export function forgetDrive(id: string) {
  forget((k) => (k.startsWith("item:") || k.startsWith("list:")) && k.endsWith(`:${id}`));
}

const FIELDS = "id,name,mimeType,modifiedTime,webViewLink,size,lastModifyingUser(displayName),capabilities(canAddChildren)";

function toItem(f: drive_v3.Schema$File): DriveItem {
  return {
    id: f.id!,
    name: f.name ?? "(ohne Namen)",
    mimeType: f.mimeType ?? "",
    modifiedTime: f.modifiedTime ?? undefined,
    webViewLink: f.webViewLink ?? undefined,
    size: f.size ? Number(f.size) : undefined,
    modifiedBy: f.lastModifyingUser?.displayName ?? undefined,
    isFolder: f.mimeType === FOLDER,
    canAddChildren: Boolean(f.capabilities?.canAddChildren),
  };
}

export function getItem(id: string): Promise<DriveItem> {
  return perPerson("item", id, () => getItemFresh(id));
}

/** Straight from Drive, no cache: for write paths that must compare modifiedTime. */
export async function getItemFresh(id: string): Promise<DriveItem> {
  const drive = await client();
  const { data } = await drive.files.get({ fileId: id, fields: FIELDS, supportsAllDrives: true }, SMALL);
  return toItem(data);
}

export function listChildren(folderId: string): Promise<DriveItem[]> {
  return perPerson("list", folderId, () => listChildrenFresh(folderId));
}

async function listChildrenFresh(folderId: string): Promise<DriveItem[]> {
  const drive = await client();
  const out: DriveItem[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await drive.files.list({
      q: `'${folderId.replace(/'/g, "")}' in parents and trashed = false`,
      fields: `nextPageToken, files(${FIELDS})`,
      orderBy: "folder,name_natural",
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
    });
    out.push(...(data.files ?? []).map(toItem));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

/**
 * A file id is used as-is; a folder id resolves to the most recently changed
 * spreadsheet/CSV in that folder (handy for "121_TN Liste" where new exports land).
 */
export async function resolveTableFile(id: string): Promise<DriveItem | null> {
  const item = await getItem(id);
  if (!item.isFolder) return item;
  const tables = (await listChildren(id)).filter((f) => TABLE_TYPES.includes(f.mimeType) || /\.(csv|xlsx)$/i.test(f.name));
  tables.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
  return tables[0] ?? null;
}

export type Downloaded = { buffer: Buffer; format: "xlsx" | "csv" };

export async function download(item: DriveItem): Promise<Downloaded> {
  const drive = await client();
  if (item.mimeType === SHEET) {
    const res = await drive.files.export({ fileId: item.id, mimeType: XLSX }, { ...SMALL, responseType: "arraybuffer" });
    return { buffer: Buffer.from(res.data as ArrayBuffer), format: "xlsx" };
  }
  const res = await drive.files.get({ fileId: item.id, alt: "media", supportsAllDrives: true }, { ...SMALL, responseType: "arraybuffer" });
  const format = item.mimeType === "text/csv" || item.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
  return { buffer: Buffer.from(res.data as ArrayBuffer), format };
}

export class FileError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Maps auth/Drive errors of the file routes to a plain-text response. */
export function fileErrorResponse(e: unknown): Response {
  const text = (msg: string, status: number) =>
    new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (e instanceof AuthError) return text(e.message, 401);
  if (e instanceof FileError) return text(e.message, e.status);
  const status = Number((e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code);
  if (status === 404) return text("Datei nicht gefunden oder kein Zugriff.", 404);
  if (status === 403) return text("Kein Zugriff – im Drive fehlt die Berechtigung dafür.", 403);
  console.error("drive file route:", e);
  return text(e instanceof Error ? e.message : "Unbekannter Fehler.", 502);
}

export type OpenedFile ={ stream: Readable; name: string; mimeType: string; size?: number; inline: boolean };

/**
 * Streams a file for the Ablage. "preview" serves PDFs and images inline and
 * renders Google Docs/Sheets/Slides as PDF; "download" (or anything that can't
 * be previewed) is an attachment, with Google files exported to Office formats.
 */
export async function openFile(id: string, mode: "preview" | "download"): Promise<OpenedFile> {
  const item = await getItem(id);
  if (item.isFolder) throw new FileError("Ordner können nicht heruntergeladen werden.", 400);
  const drive = await client();
  const exp = googleExport(item.mimeType);
  const kind = mode === "preview" ? previewKind(item.mimeType) : null;

  if (exp || item.mimeType.startsWith("application/vnd.google-apps.")) {
    if (!exp) throw new FileError("Dieser Dateityp kann nur im Drive geöffnet werden.", 415);
    const mimeType = kind ? "application/pdf" : exp.mimeType;
    const ext = kind ? "pdf" : exp.ext;
    const res = await drive.files.export({ fileId: id, mimeType }, { responseType: "stream" });
    return { stream: res.data as Readable, name: `${item.name}.${ext}`, mimeType, inline: Boolean(kind) };
  }
  const res = await drive.files.get({ fileId: id, alt: "media", supportsAllDrives: true }, { responseType: "stream" });
  return { stream: res.data as Readable, name: item.name, mimeType: item.mimeType || "application/octet-stream", size: item.size, inline: Boolean(kind) };
}

/** Uploads a new file into a folder; Drive decides whether the person may write there. */
export async function uploadFile(folderId: string, name: string, mimeType: string, body: Readable): Promise<DriveItem> {
  const drive = await client();
  const { data } = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body },
    fields: FIELDS,
    supportsAllDrives: true,
  });
  forgetDrive(folderId);
  return toItem(data);
}

/** Uploads a new revision of an existing xlsx (Drive keeps the old version in its history). */
export async function uploadNewRevision(id: string, buffer: Buffer) {
  const drive = await client();
  await drive.files.update({
    fileId: id,
    supportsAllDrives: true,
    media: { mimeType: XLSX, body: Readable.from(buffer) },
  }, SMALL);
  forgetDrive(id);
}

/** "06_Lagerbauten (Kenai)" → { nr: "06", title: "Lagerbauten", owner: "Kenai" } */
export function parseRessort(name: string) {
  const m = name.match(/^(\d+)[_\s-]*(.*?)\s*(?:\(([^)]+)\))?\s*$/);
  if (!m) return { nr: undefined, title: name, owner: undefined };
  return { nr: m[1], title: m[2].replace(/_/g, " ").trim() || name, owner: m[3]?.trim() };
}
