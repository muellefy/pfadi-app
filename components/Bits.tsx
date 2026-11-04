import type { DriveItem } from "@/lib/drive";
import type { TerminStatus } from "@/lib/tables";
import { External } from "./icons";

export function ErrorNotice({ error }: { error: string }) {
  return <div className="notice error">{error}</div>;
}

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

export const STATUS_LABEL: Record<TerminStatus, string> = {
  erledigt: "Erledigt",
  ueberfaellig: "Überfällig",
  bald: "Bald fällig",
  offen: "Offen",
  "ohne-datum": "Ohne Datum",
};
export const STATUS_CLASS: Record<TerminStatus, string> = {
  erledigt: "grey",
  ueberfaellig: "rust",
  bald: "amber",
  offen: "",
  "ohne-datum": "khaki",
};

export function StatusPill({ status }: { status: TerminStatus }) {
  return <span className={`pill ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

const WEEKDAY = new Intl.DateTimeFormat("de-CH", { weekday: "short", timeZone: "UTC" });
export const weekday = (iso: string) => WEEKDAY.format(new Date(iso));

export function daysUntil(iso: string) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(iso) - today) / 86_400_000);
}

export function relative(iso: string) {
  const d = daysUntil(iso);
  if (d === 0) return "heute";
  if (d === 1) return "morgen";
  if (d === -1) return "gestern";
  return d > 0 ? `in ${d} Tagen` : `vor ${-d} Tagen`;
}
