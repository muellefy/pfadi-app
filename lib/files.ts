/**
 * Which Drive files the Ablage can preview or download, shared by the server
 * route (what it sends) and the client (which buttons it shows).
 */
export const GOOGLE_PREFIX = "application/vnd.google-apps.";

/** Google Docs/Sheets/Slides have no file to download; Drive exports them. */
const GOOGLE_EXPORT: Record<string, { mimeType: string; ext: string; preview: boolean }> = {
  "application/vnd.google-apps.document": {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", preview: true,
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", preview: true,
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: "pptx", preview: true,
  },
  "application/vnd.google-apps.drawing": { mimeType: "application/pdf", ext: "pdf", preview: true },
};

/** Only types the browser renders safely are ever served inline (never HTML or SVG). */
const INLINE_IMAGES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export const googleExport = (mimeType: string) => GOOGLE_EXPORT[mimeType];

export function previewKind(mimeType: string): "pdf" | "image" | null {
  if (mimeType === "application/pdf" || GOOGLE_EXPORT[mimeType]?.preview) return "pdf";
  if (INLINE_IMAGES.includes(mimeType)) return "image";
  return null;
}

/** Folders, Forms, shortcuts etc. have nothing to download. */
export const downloadable = (mimeType: string) => !mimeType.startsWith(GOOGLE_PREFIX) || Boolean(GOOGLE_EXPORT[mimeType]);

export const fileUrl = (id: string, download = false) => `/api/drive/${encodeURIComponent(id)}${download ? "?download=1" : ""}`;
