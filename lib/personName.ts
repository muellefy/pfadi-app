import type { PersonTable } from "./people";

/** "Vorname Nachname", else the first column: how the Personen page names someone. */
export const personName = ({ roles, columns }: PersonTable, r: Record<string, string>) =>
  [roles.vorname && r[roles.vorname], roles.nachname && r[roles.nachname]].filter(Boolean).join(" ") || r[columns[0]] || "";
