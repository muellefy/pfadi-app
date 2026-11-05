import Link from "next/link";
import { notFound } from "next/navigation";
import { getCamp } from "@/lib/config";
import { getItem, listChildren, parseRessort, type DriveItem } from "@/lib/drive";
import { AblageView } from "@/components/AblageView";
import { ErrorNotice } from "@/components/Bits";
import { Avatar, External } from "@/components/icons";

export const metadata = { title: "Ablage" };

export default async function AblagePage({ params }: { params: Promise<{ camp: string; path?: string[] }> }) {
  const { camp: slug, path = [] } = await params;
  const camp = await getCamp(slug);
  if (!camp) notFound();

  // path = chain of folder ids below the camp root; this keeps navigation inside the camp
  const folderId = path.at(-1) ?? camp.drive.rootFolderId;
  let items: DriveItem[] = [];
  let crumbs: DriveItem[] = [];
  let folder: DriveItem | undefined;
  let error = "";
  try {
    // the root folder isn't in the crumbs, so fetch it separately for its permissions
    const [children, chain, root] = await Promise.all([
      listChildren(folderId),
      Promise.all(path.map(getItem)),
      path.length ? undefined : getItem(folderId),
    ]);
    items = children;
    crumbs = chain;
    folder = root ?? chain.at(-1);
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
      ) : (
        <AblageView slug={slug} path={path} folderId={folderId} items={items} canUpload={Boolean(folder?.canAddChildren)} />
      )}
    </>
  );
}
