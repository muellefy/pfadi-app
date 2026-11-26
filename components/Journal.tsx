"use client";
import { useMemo, useState, type FormEvent } from "react";
import type { Booking, Budget } from "@/lib/budget";
import { money } from "@/lib/money";
import { receiptName } from "@/lib/receipt";
import { deleteBooking, saveBooking, type Result } from "@/app/[camp]/budget/actions";

const DATE = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
/** "Ausgaben - Höcks" → "Höcks" for display; the sheet keeps the full name */
const shortCat = (c: string) => c.replace(/^(ausgaben|einnahmen)\s*-\s*/i, "");

/** Uploads the receipt into the budget folder (same route as the Ablage); returns an error text or null. */
async function uploadReceipt(folderId: string, name: string, file: File): Promise<string | null> {
  const res = await fetch(`/api/drive/upload?folder=${encodeURIComponent(folderId)}`, {
    method: "POST", body: file, headers: { "x-file-name": encodeURIComponent(name), "content-type": file.type || "application/octet-stream" },
  });
  return res.ok ? null : `Beleg nicht hochgeladen: ${await res.text()}`;
}

type JournalProps = {
  slug: string; budget: Budget; editable: boolean; pending: boolean;
  run: (fn: () => Promise<Result>, after?: () => void) => void;
  /** where receipts go; no field without it */
  receiptFolderId?: string;
};

export function Journal({ slug, budget, editable, pending, run, receiptFolderId }: JournalProps) {
  const [editing, setEditing] = useState<Booking | null>(null);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const c of budget.categories) {
      const key = /^einnahme/i.test(c) ? "Einnahmen" : /^ausgabe/i.test(c) ? "Ausgaben" : "Weitere";
      g.set(key, [...(g.get(key) ?? []), c]);
    }
    return [...g];
  }, [budget.categories]);
  const shown = budget.journal.bookings.filter((b) => (!filter || b.category === filter) && (!q || b.text.toLowerCase().includes(q.toLowerCase())));
  const totals = shown.reduce((t, b) => ({ in: t.in + (b.income ?? 0), out: t.out + (b.expense ?? 0) }), { in: 0, out: 0 });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const input = {
      date: String(f.get("date")), text: String(f.get("text")), category: String(f.get("category")),
      amount: Number(String(f.get("amount")).replace(/['’\s]/g, "").replace(",", ".")),
    };
    const existing = editing ? { row: editing.row, text: editing.text } : undefined;
    const receipt = f.get("receipt");
    run(async () => {
      if (receiptFolderId && receipt instanceof File && receipt.size > 0) {
        const failed = await uploadReceipt(receiptFolderId, receiptName(input.date, input.text, receipt.name), receipt);
        if (failed) return { ok: false, error: failed };
        // uploaded: a retry after a failed booking must not upload it twice
        (form.elements.namedItem("receipt") as HTMLInputElement).value = "";
        const res = await saveBooking(slug, input, existing);
        return res.ok ? res : { ok: false, error: `${res.error} (Der Beleg ist schon im Drive gespeichert.)` };
      }
      return saveBooking(slug, input, existing);
    }, () => { setEditing(null); form.reset(); });
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      {editable && (
        <form className="card form booking" onSubmit={submit} key={editing?.row ?? "new"}>
          <div className="card-head" style={{ margin: 0 }}>
            <h2>{editing ? `Buchung ${editing.nr} ändern` : "Neue Buchung"}</h2>
            {editing && <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Abbrechen</button>}
          </div>
          <div className="row">
            <label>Datum<input type="date" name="date" required defaultValue={editing?.date ?? new Date().toISOString().slice(0, 10)} /></label>
            <label>Betrag (CHF)<input name="amount" required inputMode="decimal" placeholder="0.00" defaultValue={editing ? String(editing.expense ?? editing.income ?? "") : ""} /></label>
          </div>
          <label>Text<input name="text" required maxLength={200} placeholder="z. B. Einkauf Landi, Beleg 12" defaultValue={editing?.text} /></label>
          <label>Kategorie
            <select name="category" required defaultValue={editing?.category ?? ""}>
              <option value="" disabled>Kategorie wählen</option>
              {groups.map(([g, cats]) => (
                <optgroup key={g} label={g}>{cats.map((c) => <option key={c} value={c}>{shortCat(c)}</option>)}</optgroup>
              ))}
            </select>
            <small className="muted">Einnahmen-Kategorien werden als Einnahme gebucht, alle anderen als Ausgabe.</small>
          </label>
          {receiptFolderId && (
            <label>Beleg (Foto oder PDF, optional)
              <input type="file" name="receipt" accept="image/*,application/pdf" />
              <small className="muted">Wird im Budget-Ordner im Drive gespeichert.</small>
            </label>
          )}
          <div><button className="btn primary" disabled={pending}>{editing ? "Änderung speichern" : "Buchen"}</button></div>
        </form>
      )}

      <section>
        <div className="toolbar">
          <input className="search" type="search" placeholder="Buchungen durchsuchen" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="search" style={{ flex: "0 1 280px" }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Kategorie">
            <option value="">Alle Kategorien</option>
            {budget.categories.map((c) => <option key={c} value={c}>{shortCat(c)}</option>)}
          </select>
        </div>
        {shown.length === 0 ? <p className="notice">Noch keine Buchungen{filter || q ? " in dieser Ansicht" : ""}.</p> : (
          <div className="table-wrap">
            <table className="data journal">
              <thead><tr><th>Nr.</th><th>Datum</th><th>Text</th><th>Kategorie</th><th className="num">Einnahme</th><th className="num">Ausgabe</th>{editable && <th />}</tr></thead>
              <tbody>
                {shown.map((b) => (
                  <tr key={b.row}>
                    <td>{b.nr}</td>
                    <td>{b.date ? DATE.format(new Date(b.date)) : ""}</td>
                    <td title={b.text}>{b.text}</td>
                    <td title={b.category}>{shortCat(b.category)}</td>
                    <td className="num in">{b.income != null ? money(b.income) : ""}</td>
                    <td className="num">{b.expense != null ? money(b.expense) : ""}</td>
                    {editable && (
                      <td className="actions">
                        <button className="btn ghost" disabled={pending} onClick={() => { setEditing(b); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Ändern</button>
                        <button className="btn ghost" disabled={pending} onClick={() => { if (confirm(`Buchung «${b.text}» löschen?`)) run(() => deleteBooking(slug, b.row, b.text)); }}>Löschen</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4}>Total {filter || q ? "(Auswahl)" : ""}</td><td className="num in">{money(totals.in)}</td><td className="num">{money(totals.out)}</td>{editable && <td />}</tr></tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
