import "server-only";
import { google, type drive_v3 } from "googleapis";
import { auth } from "@/auth";

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: number;
  modifiedBy?: string;
  isFolder: boolean;
};

export const FOLDER = "application/vnd.google-apps.folder";
const SHEET = "application/vnd.google-apps.spreadsheet";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TABLE_TYPES = [SHEET, XLSX, "text/csv", "application/vnd.ms-excel"];

export class AuthError extends Error {}

/** Drive client acting as the logged-in user (their permissions, not a service account). */
async function client(): Promise<drive_v3.Drive> {
  const session = await auth();
  if (!session?.accessToken || session.error) throw new AuthError("Google-Sitzung abgelaufen – bitte neu anmelden.");
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: session.accessToken });
  return google.drive({ version: "v3", auth: oauth });
}

const FIELDS = "id,name,mimeType,modifiedTime,webViewLink,size,lastModifyingUser(displayName)";

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
  };
}

export async function getItem(id: string): Promise<DriveItem> {
  const drive = await client();
  const { data } = await drive.files.get({ fileId: id, fields: FIELDS, supportsAllDrives: true });
  return toItem(data);
}

export async function listChildren(folderId: string): Promise<DriveItem[]> {
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
    const res = await drive.files.export({ fileId: item.id, mimeType: XLSX }, { responseType: "arraybuffer" });
    return { buffer: Buffer.from(res.data as ArrayBuffer), format: "xlsx" };
  }
  const res = await drive.files.get({ fileId: item.id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  const format = item.mimeType === "text/csv" || item.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
  return { buffer: Buffer.from(res.data as ArrayBuffer), format };
}

/** Uploads a new revision of an existing xlsx (Drive keeps the old version in its history). */
export async function uploadNewRevision(id: string, buffer: Buffer) {
  const drive = await client();
  const { Readable } = await import("node:stream");
  await drive.files.update({
    fileId: id,
    supportsAllDrives: true,
    media: { mimeType: XLSX, body: Readable.from(buffer) },
  });
}

/** "06_Lagerbauten (Kenai)" → { nr: "06", title: "Lagerbauten", owner: "Kenai" } */
export function parseRessort(name: string) {
  const m = name.match(/^(\d+)[_\s-]*(.*?)\s*(?:\(([^)]+)\))?\s*$/);
  if (!m) return { nr: undefined, title: name, owner: undefined };
  return { nr: m[1], title: m[2].replace(/_/g, " ").trim() || name, owner: m[3]?.trim() };
}
