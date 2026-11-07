import JSZip from "jszip";

/**
 * Writes single cells into an existing .xlsx by editing the sheet XML in place.
 *
 * exceljs rewrites the whole workbook on save and silently drops what it doesn't
 * model — the Finanzjournal's category dropdown (an x14 extension), drawings,
 * some conditional formats. Here everything except the touched <c> elements stays
 * byte for byte as it was. Excel recalculates on open (fullCalcOnLoad).
 */
export type CellWrite = { ref: string; value: number | string | Date | null };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function colIndex(letters: string) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
export function colLetters(n: number) {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
function splitRef(ref: string) {
  const m = ref.toUpperCase().match(/^([A-Z]{1,3})(\d+)$/);
  if (!m) throw new Error(`Ungültige Zelle: ${ref}`);
  return { col: colIndex(m[1]), row: Number(m[2]), ref: `${m[1]}${m[2]}` };
}

/** Excel's serial day number (1900 date system) for a calendar date. */
export function excelSerial(d: Date) {
  return (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** Path of a sheet's XML part inside the zip, found via workbook.xml + its rels. */
async function sheetPath(zip: JSZip, sheetName: string) {
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  const sheet = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => m[0]).find((tag) => unesc(tag.match(/\bname="([^"]*)"/)?.[1] ?? "") === sheetName);
  if (!sheet) throw new Error(`Blatt «${sheetName}» nicht gefunden.`);
  const rid = sheet.match(/\br:id="([^"]+)"/)?.[1] ?? sheet.match(/\bid="([^"]+)"/)?.[1];
  const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`Id="${rid}"`));
  const target = rel?.match(/Target="([^"]+)"/)?.[1];
  if (!target) throw new Error(`Blatt «${sheetName}» hat keinen Inhalt.`);
  return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
}

function cellXml(ref: string, style: string, value: CellWrite["value"]) {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === "") return `<c r="${ref}"${s}/>`;
  if (value instanceof Date) return `<c r="${ref}"${s}><v>${excelSerial(value)}</v></c>`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Ungültige Zahl.");
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

const CELL = (ref: string) => new RegExp(`<c r="${ref}"(?=[\\s/>])([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`);
const ROW = (n: number) => new RegExp(`<row r="${n}"(?=[\\s/>])([^>]*?)(?:/>|>([\\s\\S]*?)</row>)`);

/** Applies the writes to one sheet's XML. Exported for tests. */
export function patchSheetXml(xml: string, writes: CellWrite[]): string {
  for (const w of writes) {
    const { col, row, ref } = splitRef(w.ref);
    const cell = xml.match(CELL(ref));
    if (cell) {
      if (/<f\b[^>]*\bt="shared"[^>]*\bref=/.test(cell[2] ?? "")) {
        throw new Error(`${ref} ist der Ursprung einer geteilten Formel und kann hier nicht überschrieben werden.`);
      }
      const style = cell[1].match(/\bs="(\d+)"/)?.[1] ?? "";
      xml = xml.replace(cell[0], cellXml(ref, style, w.value));
      continue;
    }
    const rowMatch = xml.match(ROW(row));
    if (rowMatch) {
      const attrs = rowMatch[1].replace(/\/$/, "");
      const body = rowMatch[2] ?? "";
      // the column style (from <cols>) is not copied; the row's own style is
      const style = attrs.match(/\bcustomFormat="1"/) ? attrs.match(/\bs="(\d+)"/)?.[1] ?? "" : "";
      const next = [...body.matchAll(/<c r="([A-Z]+)\d+"/g)].find((m) => colIndex(m[1]) > col);
      const insert = cellXml(ref, style, w.value);
      const newBody = next ? body.replace(next[0], insert + next[0]) : body + insert;
      xml = xml.replace(rowMatch[0], `<row r="${row}"${attrs}>${newBody}</row>`);
      continue;
    }
    const sheetData = xml.match(/<sheetData\s*\/>|<sheetData>([\s\S]*?)<\/sheetData>/);
    if (!sheetData) throw new Error("Tabellenblatt ohne <sheetData>.");
    const body = sheetData[1] ?? "";
    const newRow = `<row r="${row}">${cellXml(ref, "", w.value)}</row>`;
    const after = [...body.matchAll(/<row r="(\d+)"/g)].find((m) => Number(m[1]) > row);
    const newBody = after ? body.replace(after[0], newRow + after[0]) : body + newRow;
    xml = xml.replace(sheetData[0], `<sheetData>${newBody}</sheetData>`);
  }
  return xml;
}

/**
 * Writes cells into one sheet and returns the new workbook bytes.
 * Also drops calcChain.xml (Excel rebuilds it; a stale one triggers a repair prompt)
 * and asks Excel to recalculate every formula when the file is opened.
 */
// don't add folder entries to the zip that the original didn't have
const KEEP = { createFolders: false };

export async function patchCells(xlsx: Buffer, sheetName: string, writes: CellWrite[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(xlsx, { createFolders: false });
  const part = await sheetPath(zip, sheetName);
  const xml = await zip.file(part)!.async("string");
  zip.file(part, patchSheetXml(xml, writes), KEEP);

  let wb = await zip.file("xl/workbook.xml")!.async("string");
  if (/<calcPr\b[^>]*\bfullCalcOnLoad=/.test(wb)) wb = wb.replace(/(<calcPr\b[^>]*\bfullCalcOnLoad=")[^"]*"/, '$11"');
  else if (/<calcPr\b/.test(wb)) wb = wb.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"');
  else wb = wb.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
  zip.file("xl/workbook.xml", wb, KEEP);

  if (zip.file("xl/calcChain.xml")) {
    zip.remove("xl/calcChain.xml");
    const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
    zip.file("xl/_rels/workbook.xml.rels", rels.replace(/<Relationship\b[^>]*Target="[^"]*calcChain\.xml"[^>]*\/>/g, ""), KEEP);
    const types = await zip.file("[Content_Types].xml")!.async("string");
    zip.file("[Content_Types].xml", types.replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g, ""), KEEP);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
