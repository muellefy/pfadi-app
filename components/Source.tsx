import type { DriveItem } from "@/lib/data/drive";
import { External } from "./icons";

/** "Quelle: <file> · geändert …" line under a Drive-backed page. */
export function Source({ item }: { item?: DriveItem }) {
  if (!item) return null;
  const when = item.modifiedTime ? new Date(item.modifiedTime).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" }) : "";
  return (
    <p className="source">
      Quelle:{" "}
      {item.webViewLink ? <a href={item.webViewLink} target="_blank" rel="noreferrer">{item.name} <External size={11} /></a> : item.name}
      {when && <> · geändert {when}{item.modifiedBy ? ` von ${item.modifiedBy}` : ""}</>}
    </p>
  );
}
