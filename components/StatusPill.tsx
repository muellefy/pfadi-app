import type { TerminStatus } from "@/lib/termine";

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
