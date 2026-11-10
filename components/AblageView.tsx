"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DriveItem } from "@/lib/data/drive";
import { downloadable, fileUrl, previewKind } from "@/lib/files";
import { Close, Download, External, Eye, FileIcon, Folder, Sheet, Upload } from "./icons";

type Props = { slug: string; path: string[]; folderId: string; items: DriveItem[]; canUpload: boolean };
type UploadState = { key: string; name: string; progress: number; error?: string };

function Icon({ item }: { item: DriveItem }) {
  if (item.isFolder) return <Folder />;
  if (/sheet|csv|excel/.test(item.mimeType)) return <Sheet />;
  return <FileIcon />;
}

const fmtSize = (n?: number) => (n == null ? "" : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);

/** XHR instead of fetch: it reports upload progress. */
function uploadOne(folderId: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/drive/upload?folder=${encodeURIComponent(folderId)}`);
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `Fehler ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Verbindung unterbrochen."));
    xhr.send(file);
  });
}

export function AblageView({ slug, path, folderId, items, canUpload }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<DriveItem | null>(null);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (preview) dialog.current?.showModal();
    else dialog.current?.close();
  }, [preview]);

  const busy = uploads.some((u) => !u.error && u.progress < 1);

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    const batch = list.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, progress: 0 }));
    setUploads((u) => [...u.filter((x) => x.error), ...batch]);
    const set = (key: string, patch: Partial<UploadState>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    for (const [i, file] of list.entries()) {
      const { key } = batch[i];
      try {
        await uploadOne(folderId, file, (progress) => set(key, { progress }));
        set(key, { progress: 1 });
      } catch (e) {
        set(key, { error: e instanceof Error ? e.message : "Hochladen fehlgeschlagen." });
      }
    }
    router.refresh();
    // keep failures visible, drop the finished ones
    setUploads((u) => u.filter((x) => x.error));
  }

  const dropProps = canUpload
    ? {
        onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } },
        onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); },
        onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); },
      }
    : {};

  return (
    <div {...dropProps} className={dragging ? "dropzone active" : "dropzone"}>
      {canUpload && (
        <div className="toolbar">
          <button className="btn primary" onClick={() => input.current?.click()} disabled={busy}>
            <Upload size={16} /> {busy ? "Wird hochgeladen …" : "Dateien hochladen"}
          </button>
          <span className="small muted drop-hint">oder Dateien hierher ziehen</span>
          <input ref={input} type="file" multiple hidden onChange={(e) => { upload(e.target.files ?? []); e.target.value = ""; }} />
        </div>
      )}

      {uploads.length > 0 && (
        <div className="card uploads" style={{ marginBottom: 14 }}>
          {uploads.map((u) => (
            <div key={u.key} className="upload-row">
              <span className="name">{u.name}</span>
              {u.error ? (
                <span className="small" style={{ color: "var(--rust)" }}>{u.error}</span>
              ) : (
                <progress value={u.progress} max={1} aria-label={`${u.name} hochladen`} />
              )}
              {u.error && (
                <button className="btn ghost" aria-label="Meldung schliessen" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>
                  <Close size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="notice">Dieser Ordner ist leer.{canUpload && " Zieh Dateien hierher, um sie hochzuladen."}</div>
      ) : (
        <div className="card" style={{ padding: "6px 12px" }}>
          <table className="files">
            <tbody>
              {items.map((it) => {
                const kind = it.isFolder ? null : previewKind(it.mimeType);
                const canDownload = !it.isFolder && downloadable(it.mimeType);
                return (
                  <tr key={it.id}>
                    <td>
                      {it.isFolder ? (
                        <Link href={`/${slug}/ablage/${[...path, it.id].join("/")}`}><Icon item={it} /><span>{it.name}</span></Link>
                      ) : kind ? (
                        <button className="file-link" onClick={() => setPreview(it)}><Icon item={it} /><span>{it.name}</span></button>
                      ) : (
                        <a href={it.webViewLink} target="_blank" rel="noreferrer"><Icon item={it} /><span>{it.name}</span></a>
                      )}
                    </td>
                    <td className="small muted hide-sm" style={{ whiteSpace: "nowrap" }}>{it.modifiedBy}</td>
                    <td className="small muted hide-sm" style={{ whiteSpace: "nowrap" }}>
                      {it.modifiedTime && new Date(it.modifiedTime).toLocaleDateString("de-CH")}
                    </td>
                    <td className="small muted" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmtSize(it.size)}</td>
                    <td className="actions">
                      {kind && (
                        <button className="btn ghost" title="Vorschau" aria-label={`Vorschau: ${it.name}`} onClick={() => setPreview(it)}><Eye size={16} /></button>
                      )}
                      {canDownload && (
                        <a className="btn ghost" title="Herunterladen" aria-label={`Herunterladen: ${it.name}`} href={fileUrl(it.id, true)} download><Download size={16} /></a>
                      )}
                      {!it.isFolder && it.webViewLink && (
                        <a className="btn ghost" title="Im Drive öffnen" aria-label={`Im Drive öffnen: ${it.name}`} href={it.webViewLink} target="_blank" rel="noreferrer"><External size={16} /></a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <dialog ref={dialog} className="preview" onClose={() => setPreview(null)} onClick={(e) => e.target === e.currentTarget && setPreview(null)}>
        {preview && (
          <div className="preview-box">
            <header>
              <b>{preview.name}</b>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <a className="btn" href={fileUrl(preview.id)} target="_blank" rel="noreferrer">Neuer Tab <External size={14} /></a>
                {downloadable(preview.mimeType) && <a className="btn" href={fileUrl(preview.id, true)} download><Download size={14} /> Herunterladen</a>}
                <button className="btn" onClick={() => setPreview(null)} aria-label="Vorschau schliessen"><Close size={14} /></button>
              </div>
            </header>
            {previewKind(preview.mimeType) === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(preview.id)} alt={preview.name} />
            ) : (
              <iframe src={fileUrl(preview.id)} title={preview.name} />
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
