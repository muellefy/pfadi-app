import ExcelJS from "exceljs";
import { Evaluator, FormulaError, type Scalar, type Sheets } from "./formula.ts";

/**
 * Reads a camp budget workbook in the layout of the PBS / Region Seldwyla template
 * ("Lagerbudget_Lagerabrechnung" + "Finanzjournal" + "Referenzen"), or the similar
 * Google-Sheets one ("Lagerbudget" + "Finanzjournal" + "Berechnung", labels in column D,
 * no grey group rows, Abrechnung computed from the journal):
 *
 * - budget sheet: label in the column of the "Ausgaben" cell (A or D), budget ("Budget"/"provisorisch") and
 *   Abrechnung ("Abrechnung"/"definitiv") columns found by their header,
 *   a rate column (CHF per day, Lagerbeitrag …) right before the budget column.
 *   Input cells are the coloured ones: blue = budget, green = Abrechnung.
 * - journal: Nr. | Datum | Text | Kategorie | Einnahme | Ausgabe
 *   (or Datum | Beleg Nr. | Bemerkung | Leiter | Kategorie | Eingang | Ausgang)
 * - categories: column A of the Referenzen sheet, else the journal's category dropdown list
 *
 * All formulas are evaluated here (see formula.ts) because saved files often
 * carry no cached results.
 */

export type BudgetCell = {
  ref: string;
  value: number | string | null;
  /** editable in the app: "plan" (blue), "actual" (green) */
  input?: "plan" | "actual";
  formula?: boolean;
  money: boolean;
};
export type BudgetRow = {
  row: number;
  label: string;
  kind: "group" | "heading" | "line" | "total";
  rate?: BudgetCell;
  plan?: BudgetCell;
  actual?: BudgetCell;
};
export type Booking = {
  row: number;
  nr: string;
  date: string | null; // ISO
  text: string;
  category: string;
  income: number | null;
  expense: number | null;
};
export type BudgetSection = { title: string; plan: number; actual: number };
export type Budget = {
  sheet: string;
  meta: { label: string; value: string }[];
  rows: BudgetRow[];
  sections: BudgetSection[];
  summary: { expensesPlan: number; expensesActual: number; incomePlan: number; incomeActual: number; balancePlan: number; balanceActual: number };
  journal: {
    sheet: string;
    cols: { date: string; text: string; category: string; income: string; expense: string };
    bookings: Booking[];
    freeRows: number[];
  };
  categories: string[];
};

const PLAN_FILLS = ["FFDAEEF3", "FFCEDBE6"];
const ACTUAL_FILL = "FFEAF1DD";
const GROUP_FILL = "FF7F7F7F";

type Raw = { value: Scalar; formula?: string; fill?: string; numFmt?: string };

function scalarOf(v: ExcelJS.CellValue): Scalar {
  if (v == null) return null;
  if (v instanceof Date) return (Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86_400_000;
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return scalarOf(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text ?? "");
    if ("error" in v) return null;
    return null;
  }
  return v as Scalar;
}

/** exceljs workbook → plain cell map (formulas kept as text) */
function readSheets(wb: ExcelJS.Workbook) {
  const raw = new Map<string, Map<string, Raw>>();
  for (const ws of wb.worksheets) {
    const cells = new Map<string, Raw>();
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (c) => {
        // merged cells repeat the master's value in exceljs; only the master is real
        if (c.isMerged && c.master.address !== c.address) return;
        const formula = c.type === ExcelJS.ValueType.Formula ? c.formula : undefined;
        const fill = c.fill?.type === "pattern" ? c.fill.fgColor?.argb : undefined;
        cells.set(c.address, { value: scalarOf(c.value), formula: formula || undefined, fill, numFmt: c.numFmt });
      });
    });
    raw.set(ws.name, cells);
  }
  const sheets: Sheets = new Map([...raw].map(([name, cells]) => [name, new Map([...cells].map(([ref, c]) => [ref, { value: c.value, formula: c.formula }]))]));
  return { raw, sheets };
}

const text = (v: Scalar | undefined) => (v == null ? "" : String(v)).trim();
const isMoney = (fmt?: string) => /CHF|Fr\./.test(fmt ?? "");
const toNum = (v: Scalar) => (typeof v === "number" ? v : null);
const fromSerial = (n: number) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000).toISOString().slice(0, 10);

export async function parseBudget(xlsx: Buffer): Promise<Budget> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx as unknown as ArrayBuffer);
  const { raw, sheets } = readSheets(wb);
  const ev = new Evaluator(sheets);
  const names = [...raw.keys()];
  const budgetName = names.find((n) => /budget|abrechnung/i.test(n)) ?? names[0];
  const journalName = names.find((n) => /journal/i.test(n));
  const refName = names.find((n) => /referenz/i.test(n));
  if (!budgetName) throw new Error("Die Datei enthält kein Tabellenblatt.");
  const B = raw.get(budgetName)!;

  const valueOf = (sheet: string, ref: string, cell: Raw): Scalar => {
    if (!cell.formula) return cell.value;
    try { return ev.cell(sheet, ref); } catch (e) { if (e instanceof FormulaError) return cell.value; throw e; }
  };

  // columns: header row with "Budget" and "Abrechnung"
  let planCol = "D", actualCol = "F";
  for (const [ref, c] of B) {
    if (/^budget$/i.test(text(c.value))) planCol = ref.replace(/\d+/, "");
    if (/^abrechnung$/i.test(text(c.value))) actualCol = ref.replace(/\d+/, "");
  }
  const rateCol = String.fromCharCode(planCol.charCodeAt(0) - 1);
  // PBS template: grey group rows, labels in A. Without them (Google-Sheets template) the labels
  // sit in the column of "Ausgaben", and plain "Ausgaben" / "Einnahmen" / "Bilanz" are the groups.
  const hasGroupFill = [...B.values()].some((c) => c.fill === GROUP_FILL);
  const labelCol = hasGroupFill ? "A" : [...B].find(([, c]) => /^ausgaben$/i.test(text(c.value)))?.[0].replace(/\d+/, "") ?? "A";
  const valueCol = String.fromCharCode(labelCol.charCodeAt(0) + 1);

  const maxRow = Math.max(0, ...[...B.keys()].map((r) => Number(r.replace(/\D+/, ""))));
  const rows: BudgetRow[] = [];
  const meta: Budget["meta"] = [];
  let inBody = false;
  for (let r = 1; r <= maxRow; r++) {
    const a = B.get(`${labelCol}${r}`);
    const label = text(a?.value);
    if (!label) continue;
    const cellAt = (col: string): BudgetCell | undefined => {
      const c = B.get(`${col}${r}`);
      if (!c) return undefined;
      const input = PLAN_FILLS.includes(c.fill ?? "") ? "plan" : c.fill === ACTUAL_FILL ? "actual" : undefined;
      const value = valueOf(budgetName, `${col}${r}`, c);
      if (!input && (value == null || value === "")) return undefined;
      if (typeof value === "string" && !input) return undefined; // headers like "provisorisch", repeated labels
      return { ref: `${col}${r}`, value: typeof value === "boolean" ? Number(value) : value, input, formula: Boolean(c.formula), money: isMoney(c.numFmt) };
    };
    const isGroup = hasGroupFill ? a?.fill === GROUP_FILL : /^(ausgaben|einnahmen|bilanz)$/i.test(label);
    if (isGroup && /^ausgaben/i.test(label)) inBody = true;
    if (isGroup && inBody) { rows.push({ row: r, label, kind: "group" }); continue; }
    if (isGroup) continue; // "Lagerkonto", "J+S-Leihmaterial": headings of the info block
    const plan = cellAt(planCol), actual = cellAt(actualCol), rate = cellAt(rateCol);
    // above "Ausgaben": camp info ("Lagername | Abteilungs-SoLa 2027") and the
    // key figures (people, days, J+S material) that the formulas below use
    if (!inBody) {
      // "Lager: | name … Lagertage: | 3" rows are info even if a cell in a value column is filled
      const info = !hasGroupFill && label.endsWith(":");
      if ((plan || actual || rate) && !info) {
        if (!rows.length) rows.push({ row: 0, label: "Eckdaten", kind: "group" });
        rows.push({ row: r, label, kind: "line", plan, actual, rate });
      } else {
        const v = text(valueOf(budgetName, `${valueCol}${r}`, B.get(`${valueCol}${r}`) ?? { value: null }));
        if (v && v !== label) meta.push({ label: label.replace(/:$/, ""), value: v });
        for (const [ref, c] of info ? B : []) {
          const [, col, n] = ref.match(/^([A-Z]+)(\d+)$/)!;
          if (Number(n) !== r || col <= labelCol || !/:$/.test(text(c.value))) continue;
          const w = text(B.get(`${String.fromCharCode(col.charCodeAt(0) + 1)}${r}`)?.value);
          if (w) meta.push({ label: text(c.value).replace(/:$/, ""), value: w });
        }
      }
      continue;
    }
    if (!plan && !actual && !rate) { rows.push({ row: r, label, kind: "heading" }); continue; }
    const kind = /^(zwischen)?total|überschuss|defizit/i.test(label) ? "total" : "line";
    rows.push({ row: r, label, kind, plan, actual, rate });
  }

  // a section is a heading followed by lines and closed by its "Zwischentotal"
  const sections: BudgetSection[] = [];
  let title = "";
  for (const row of rows) {
    if (row.kind === "heading") title = row.label;
    if (row.kind === "total" && /^zwischentotal/i.test(row.label) && title) {
      sections.push({ title, plan: toNum(row.plan?.value ?? null) ?? 0, actual: toNum(row.actual?.value ?? null) ?? 0 });
      title = "";
    }
  }
  const find = (re: RegExp) => rows.filter((x) => re.test(x.label)).at(-1);
  const pa = (row?: BudgetRow) => [toNum(row?.plan?.value ?? null) ?? 0, toNum(row?.actual?.value ?? null) ?? 0];
  const [expensesPlan, expensesActual] = pa(find(/^total ausgaben/i));
  const [incomePlan, incomeActual] = pa(find(/^total einnahmen/i));
  const [balancePlan, balanceActual] = pa(find(/überschuss|defizit/i));

  const journal = journalName ? parseJournal(journalName, raw, sheets) : { sheet: "", cols: { date: "B", text: "C", category: "D", income: "E", expense: "F" }, bookings: [], freeRows: [] };
  return {
    sheet: budgetName,
    meta,
    rows,
    sections,
    summary: { expensesPlan, expensesActual, incomePlan, incomeActual, balancePlan, balanceActual },
    journal,
    categories: refName
      ? [...raw.get(refName)!].filter(([ref, c]) => /^A\d+$/.test(ref) && ref !== "A1" && text(c.value)).sort(byRow).map(([, c]) => text(c.value))
      : dropdown(wb, ev, journal),
  };
}

/** The values of the list validation on the journal's category column (e.g. Berechnung!$A$2:$A$37). */
function dropdown(wb: ExcelJS.Workbook, ev: Evaluator, journal: Budget["journal"]): string[] {
  const row = journal.freeRows[0] ?? journal.bookings[0]?.row;
  const dv = row ? wb.getWorksheet(journal.sheet)?.getCell(`${journal.cols.category}${row}`).dataValidation : undefined;
  // shortcut: only a one-column range on another sheet, extend if a template uses a literal list or a name
  const m = dv?.type === "list" ? String(dv.formulae?.[0] ?? "").match(/^'?((?:[^']|'')+?)'?!\$?([A-Z]+)\$?(\d+):\$?\2\$?(\d+)$/) : null;
  if (!m) return [];
  const out: string[] = [];
  for (let r = Number(m[3]); r <= Number(m[4]); r++) {
    try { out.push(text(ev.cell(m[1].replace(/''/g, "'"), `${m[2]}${r}`))); } catch (e) { if (!(e instanceof FormulaError)) throw e; }
  }
  return [...new Set(out.filter(Boolean))];
}

const byRow = ([a]: [string, unknown], [b]: [string, unknown]) => Number(a.slice(1)) - Number(b.slice(1));

function parseJournal(name: string, raw: Map<string, Map<string, Raw>>, sheets: Sheets): Budget["journal"] {
  const J = raw.get(name)!;
  const header = [...J].find(([, c]) => /^datum$/i.test(text(c.value)));
  const headerRow = header ? Number(header[0].replace(/\D+/, "")) : 3;
  const colOf = (re: RegExp, fallback: string) =>
    [...J].find(([ref, c]) => Number(ref.replace(/\D+/, "")) === headerRow && re.test(text(c.value)))?.[0].replace(/\d+/, "") ?? fallback;
  const cols = {
    nr: colOf(/^nr|\bnr\.?$/i, "A"), date: colOf(/^datum$/i, "B"), text: colOf(/^(text|bemerkung)$/i, "C"),
    category: colOf(/kategorie/i, "D"), income: colOf(/einnahme|eingang/i, "E"), expense: colOf(/ausgabe|ausgang/i, "F"),
  };
  // the budget only counts journal rows inside its SUMIF ranges (…$D$4:$D$265)
  let lastRow = Infinity;
  for (const cells of sheets.values()) {
    for (const c of cells.values()) {
      for (const m of c.formula?.matchAll(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'?!\\$?[A-Z]+\\$?\\d+:\\$?[A-Z]+\\$?(\\d+)`, "g")) ?? []) {
        lastRow = Math.min(lastRow, Number(m[1]));
      }
    }
  }
  const maxRow = Math.min(lastRow, Math.max(headerRow, ...[...J.keys()].map((r) => Number(r.replace(/\D+/, "")))));
  const bookings: Booking[] = [];
  const freeRows: number[] = [];
  const emptyRows: number[] = [];
  for (let r = headerRow + 1; r <= maxRow; r++) {
    const v = (col: string) => J.get(`${col}${r}`)?.value ?? null;
    const nr = text(v(cols.nr));
    const date = v(cols.date), t = text(v(cols.text)), cat = text(v(cols.category)), inc = toNum(v(cols.income)), exp = toNum(v(cols.expense));
    if (date == null && !t && !cat && inc == null && exp == null) {
      if (nr) freeRows.push(r);
      emptyRows.push(r);
      continue;
    }
    bookings.push({
      row: r, nr, text: t, category: cat, income: inc, expense: exp,
      date: typeof date === "number" ? fromSerial(date) : null,
    });
  }
  const { nr: _nr, ...rest } = cols;
  // templates with pre-numbered rows (Nr. 1…265) only offer those; others any empty row
  return { sheet: name, cols: rest, bookings, freeRows: freeRows.length ? freeRows : emptyRows };
}
