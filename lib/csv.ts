/** Semicolon CSV with BOM, so Excel (de-CH) opens umlauts and columns correctly. */
export function toCsv(columns: string[], rows: Record<string, string>[]) {
  // Excel runs cells starting with = + - @ as formulas; a leading ' keeps them plain text.
  const cell = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
  const esc = (v: string) => { const c = cell(v); return /[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c; };
  return "﻿" + [columns.map(esc).join(";"), ...rows.map((r) => columns.map((c) => esc(r[c] ?? "")).join(";"))].join("\r\n");
}
