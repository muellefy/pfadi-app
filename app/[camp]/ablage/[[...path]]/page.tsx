import Link from "next/link";
import { notFound } from "next/navigation";
import { getCamp } from "@/lib/config";
import { getItem, listChildren, parseRessort, type DriveItem } from "@/lib/drive";
import { ErrorNotice } from "@/components/Bits";
import { Avatar, External, FileIcon, Folder, Sheet } from "@/components/icons";

export const metadata = { title: "Ablage" };

function Icon({ item }: { item: DriveItem }) {
  if (item.isFolder) return <Folder />;
  if (/sheet|csv|excel/.test(item.mimeType)) return <Sheet />;
  return <FileIcon />;
}

const fmtSize = (n?: number) => (n == null ? "" : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);

export default async function AblagePage({ params }: { params: Promise<{ camp: string; path?: string[] }> }) {
  const { camp: slug, path = [] } = await params;
  const camp = await getCamp(slug);
  if (!camp) notFound();

  // path = chain of folder ids below the camp root; this keeps navigation inside the camp
  const folderId = path.at(-1) ?? camp.drive.rootFolderId;
  let items: DriveItem[] = [];
  let crumbs: DriveItem[] = [];
  let error = "";
  try {
    [items, crumbs] = await Promise.all([listChildren(folderId), Promise.all(path.map(getItem))]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const current = crumbs.at(-1);
  const ressort = current ? parseRessort(current.name) : null;

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{camp.name}</div>
          <h1>{ressort ? ressort.title : "Ablage"}</h1>
          {ressort?.owner && <p style={{ display: "flex", gap: 8, alignItems: "center" }}><Avatar name={ressort.owner} /> Verantwortlich: {ressort.owner}</p>}
        </div>
        <a className="btn" href={current?.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`} target="_blank" rel="noreferrer">
          Im Drive öffnen <External size={14} />
        </a>
      </header>
      <nav className="crumbs" aria-label="Pfad">
        <Link href={`/${slug}/ablage`}>{camp.name}</Link>
        {crumbs.map((c, i) => (
          <span key={c.id}> / <Link href={`/${slug}/ablage/${path.slice(0, i + 1).join("/")}`}>{c.name}</Link></span>
        ))}
      </nav>
      {error ? (
        <ErrorNotice error={error} />
      ) : items.length === 0 ? (
        <div className="notice">Dieser Ordner ist leer.</div>
      ) : (
        <div className="card" style={{ padding: "6px 12px" }}>
          <table className="files">
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.isFolder ? (
                      <Link href={`/${slug}/ablage/${[...path, it.id].join("/")}`}><Icon item={it} /><span>{it.name}</span></Link>
                    ) : (
                      <a href={it.webViewLink} target="_blank" rel="noreferrer"><Icon item={it} /><span>{it.name}</span></a>
                    )}
                  </td>
                  <td className="small muted" style={{ whiteSpace: "nowrap" }}>{it.modifiedBy}</td>
                  <td className="small muted" style={{ whiteSpace: "nowrap" }}>
                    {it.modifiedTime && new Date(it.modifiedTime).toLocaleDateString("de-CH")}
                  </td>
                  <td className="small muted" style={{ textAlign: "right" }}>{fmtSize(it.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
