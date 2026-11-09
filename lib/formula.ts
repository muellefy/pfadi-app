/**
 * A small Excel formula evaluator for the budget template.
 *
 * Files saved by Drive or by the app carry no (or stale) cached results, so the
 * app computes totals itself. Supported: numbers, strings, cell refs and ranges
 * (also on other sheets, with $, and whole columns like A:A), + - * / ^ &, comparisons, unary minus, % and
 * SUM, SUMIF, IF, MIN, MAX, ROUND, ROUNDUP, ROUNDDOWN, MROUND, ABS, AVERAGE, COUNT.
 * Anything else throws, and the caller falls back to the cached result.
 */
export type Scalar = number | string | boolean | null;
type Val = Scalar | Scalar[];

export type Sheets = Map<string, Map<string, { value: Scalar; formula?: string }>>;

export class FormulaError extends Error {}

type Tok = { t: "num" | "str" | "ref" | "fn" | "op" | "(" | ")" | ","; v: string };

// A1, A1:B2 or a whole-column range A:B (group 7), each optionally on another sheet
const REF = /^(?:(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!)?\$?([A-Z]{1,3})(?:\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?|:\$?([A-Z]{1,3})\b)/;

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let s = src.trim().replace(/^=/, "");
  while (s.length) {
    const ws = s.match(/^\s+/);
    if (ws) { s = s.slice(ws[0].length); continue; }
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/))) out.push({ t: "num", v: m[0] });
    else if ((m = s.match(/^"((?:[^"]|"")*)"/))) out.push({ t: "str", v: m[1].replace(/""/g, '"') });
    else if ((m = s.match(/^([A-Za-z][A-Za-z0-9.]*)\s*\(/))) {
      out.push({ t: "fn", v: m[1].toUpperCase() });
      out.push({ t: "(", v: "(" });
    } else if ((m = s.match(REF))) out.push({ t: "ref", v: m[0] });
    else if ((m = s.match(/^(<>|<=|>=|[-+*/^&=<>%])/))) out.push({ t: "op", v: m[0] });
    else if (s[0] === "(" || s[0] === ")" || s[0] === "," || s[0] === ";") out.push({ t: s[0] === ";" ? "," : (s[0] as "(" | ")" | ","), v: s[0] });
    else throw new FormulaError(`Unbekanntes Zeichen in Formel: ${s.slice(0, 10)}`);
    s = s.slice(m ? m[0].length : 1);
  }
  return out;
}

const num = (v: Val): number => {
  if (Array.isArray(v)) return num(v[0] ?? null);
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v.replace(/'/g, ""));
  if (Number.isNaN(n)) throw new FormulaError(`Keine Zahl: ${v}`);
  return n;
};
const flat = (args: Val[]) => args.flatMap((a) => (Array.isArray(a) ? a : [a]));
const roundTo = (x: number, d: number, f: (n: number) => number) => { const p = 10 ** d; return f(Math.abs(x) * p + 1e-9) / p * Math.sign(x); };

function criterion(c: Scalar): (v: Scalar) => boolean {
  if (typeof c === "number") return (v) => typeof v === "number" ? v === c : String(v ?? "").trim() === String(c);
  const s = String(c ?? "");
  const m = s.match(/^(<>|<=|>=|=|<|>)(.*)$/);
  const op = m?.[1] ?? "=";
  const rhs = m ? m[2] : s;
  const rn = Number(rhs);
  if (rhs !== "" && !Number.isNaN(rn) && op !== "=") {
    return (v) => {
      if (typeof v !== "number") return op === "<>";
      return op === "<" ? v < rn : op === ">" ? v > rn : op === "<=" ? v <= rn : op === ">=" ? v >= rn : v !== rn;
    };
  }
  const want = rhs.toLowerCase();
  return op === "<>" ? (v) => String(v ?? "").toLowerCase() !== want : (v) => String(v ?? "").toLowerCase() === want;
}

const FUNCS: Record<string, (args: Val[]) => Scalar> = {
  SUM: (a) => flat(a).reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0),
  MIN: (a) => Math.min(...flat(a).filter((v): v is number => typeof v === "number")),
  MAX: (a) => Math.max(...flat(a).filter((v): v is number => typeof v === "number")),
  COUNT: (a) => flat(a).filter((v) => typeof v === "number").length,
  AVERAGE: (a) => { const n = flat(a).filter((v): v is number => typeof v === "number"); return n.reduce((s, v) => s + v, 0) / (n.length || 1); },
  ABS: (a) => Math.abs(num(a[0])),
  ROUND: (a) => roundTo(num(a[0]), num(a[1] ?? 0), Math.round),
  ROUNDUP: (a) => roundTo(num(a[0]), num(a[1] ?? 0), Math.ceil),
  ROUNDDOWN: (a) => roundTo(num(a[0]), num(a[1] ?? 0), Math.floor),
  MROUND: (a) => {
    const x = num(a[0]), m = num(a[1]);
    if (m === 0) return 0;
    const decimals = (String(m).split(".")[1] ?? "").length; // keep 471.9, not 471.90000000000003
    return Number((Math.sign(x) * Math.round(Math.abs(x) / m + 1e-9) * m).toFixed(decimals));
  },
  SUMIF: (a) => {
    const range = Array.isArray(a[0]) ? a[0] : [a[0]];
    const sums = a[2] === undefined ? range : Array.isArray(a[2]) ? a[2] : [a[2]];
    const test = criterion(Array.isArray(a[1]) ? a[1][0] : a[1]);
    return range.reduce<number>((s, v, i) => (test(v) && typeof sums[i] === "number" ? s + (sums[i] as number) : s), 0);
  },
};

export class Evaluator {
  private memo = new Map<string, Scalar>();
  private busy = new Set<string>();
  private sheets: Sheets;
  constructor(sheets: Sheets) { this.sheets = sheets; }

  private lastRows = new Map<string, number>();
  private lastRow(sheet: string) {
    if (!this.lastRows.has(sheet)) this.lastRows.set(sheet, Math.max(0, ...[...this.sheets.get(sheet)!.keys()].map((r) => Number(r.replace(/\D+/, "")))));
    return this.lastRows.get(sheet)!;
  }

  /** Value of a cell, evaluating its formula (and those it depends on) if it has one. */
  cell(sheet: string, ref: string): Scalar {
    const key = `${sheet}!${ref}`;
    if (this.memo.has(key)) return this.memo.get(key)!;
    const c = this.sheets.get(sheet)?.get(ref);
    if (!c) return null;
    if (!c.formula) return c.value;
    if (this.busy.has(key)) throw new FormulaError(`Zirkelbezug bei ${key}`);
    this.busy.add(key);
    try {
      const v = this.formula(c.formula, sheet);
      this.memo.set(key, v);
      return v;
    } finally {
      this.busy.delete(key);
    }
  }

  formula(src: string, sheet: string): Scalar {
    const toks = tokenize(src);
    let i = 0;
    const peek = () => toks[i];
    const take = () => toks[i++];
    const expectClose = () => { if (take()?.t !== ")") throw new FormulaError("Klammer fehlt."); };

    const resolve = (ref: string): Val => {
      const m = ref.match(REF)!;
      const sh = (m[1]?.replace(/''/g, "'") ?? m[2]) || sheet;
      if (!this.sheets.has(sh)) throw new FormulaError(`Blatt fehlt: ${sh}`);
      if (!m[5] && !m[7]) return this.cell(sh, `${m[3]}${m[4]}`);
      const out: Scalar[] = [];
      const [c1, c2] = [colNum(m[3]), colNum(m[5] ?? m[7])].sort((a, b) => a - b);
      // whole columns (A:A) run to the sheet's last filled row
      const [r1, r2] = m[7] ? [1, this.lastRow(sh)] : [Number(m[4]), Number(m[6])].sort((a, b) => a - b);
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(this.cell(sh, `${colName(c)}${r}`));
      return out;
    };

    const primary = (): Val => {
      const t = take();
      if (!t) throw new FormulaError("Formel endet unerwartet.");
      if (t.t === "num") return Number(t.v);
      if (t.t === "str") return t.v;
      if (t.t === "ref") return resolve(t.v);
      if (t.t === "(") { const v = compare(); expectClose(); return v; }
      if (t.t === "fn") {
        take(); // "("
        const args: Val[] = [];
        if (peek()?.t !== ")") {
          do { args.push(compare()); } while (peek()?.t === "," && take());
        }
        expectClose();
        if (t.v === "IF") return num(args[0]) ? (args[1] ?? true) as Scalar : (args[2] ?? false) as Scalar;
        const f = FUNCS[t.v];
        if (!f) throw new FormulaError(`Funktion ${t.v} wird nicht unterstützt.`);
        return f(args);
      }
      // like Excel, negation binds tighter than ^ (-2^2 = 4)
      if (t.t === "op" && (t.v === "-" || t.v === "+")) { const v = num(percent()); return t.v === "-" ? -v : v; }
      throw new FormulaError(`Unerwartet: ${t.v}`);
    };
    const percent = (): Val => { let v = primary(); while (peek()?.v === "%" && take()) v = num(v) / 100; return v; };
    const power = (): Val => { let v = percent(); while (peek()?.v === "^" && take()) v = num(v) ** num(percent()); return v; };
    const term = (): Val => {
      let v = power();
      while (peek()?.v === "*" || peek()?.v === "/") {
        const op = take().v, r = num(power());
        if (op === "/" && r === 0) throw new FormulaError("Division durch null.");
        v = op === "*" ? num(v) * r : num(v) / r;
      }
      return v;
    };
    const sum = (): Val => {
      let v = term();
      while (peek()?.v === "+" || peek()?.v === "-" || peek()?.v === "&") {
        const op = take().v, r = term();
        v = op === "&" ? `${scalar(v) ?? ""}${scalar(r) ?? ""}` : op === "+" ? num(v) + num(r) : num(v) - num(r);
      }
      return v;
    };
    const compare = (): Val => {
      let v = sum();
      while (peek()?.t === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(peek()!.v)) {
        const op = take().v, a = scalar(v), b = scalar(sum());
        const [x, y] = typeof a === "number" || typeof b === "number" ? [num(a), num(b)] : [String(a ?? "").toLowerCase(), String(b ?? "").toLowerCase()];
        v = op === "=" ? x === y : op === "<>" ? x !== y : op === "<" ? x < y : op === ">" ? x > y : op === "<=" ? x <= y : x >= y;
      }
      return v;
    };
    const v = compare();
    if (i < toks.length) throw new FormulaError(`Unerwartet: ${toks[i].v}`);
    return scalar(v);
  }
}

const scalar = (v: Val): Scalar => (Array.isArray(v) ? v[0] ?? null : v);
const colNum = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n: number) => { let s = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
