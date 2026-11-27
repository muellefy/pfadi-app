import Link from "next/link";
import type { MenuPlan } from "@/lib/menu";
import { RECIPES_SHEET, shoppingList, type Ingredient } from "@/lib/shopping";

const AMOUNT = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });

type Props = {
  plan: MenuPlan; recipes: Ingredient[]; headcount: number;
  /** the days the list covers, shown in the head */
  span?: string;
  /** link to the print view (on the Menüplan page) */
  printHref?: string;
  /** a box to tick per line, for the printed sheet */
  checkable?: boolean;
};

/** What the kitchen has to buy for the Menüplan (or some of its days), from the «Rezepte» sheet × headcount. */
export function ShoppingList({ plan, recipes, headcount, span = "ganzes Lager", printHref, checkable }: Props) {
  const { items, missing } = shoppingList(plan, recipes, headcount);
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="card-head">
        <h2>Einkaufsliste</h2>
        <span className="small muted">für {headcount || "?"} Personen, {span}{printHref && <> · <Link href={printHref}>Zum Ausdrucken</Link></>}</span>
      </div>
      {!recipes.length ? (
        <p className="muted" style={{ margin: 0 }}>
          Noch keine Rezepte. Lege im Menüplan ein Blatt «{RECIPES_SHEET}» an mit den Spalten Gericht | Zutat | Menge pro Person | Einheit.
          Jede Mahlzeit, die den Namen eines Gerichts enthält, kommt auf die Liste.
        </p>
      ) : (
        <>
          {!headcount && <div className="notice" style={{ marginBottom: 12 }}>Personenzahl unbekannt (kein Zugriff auf TN- und Leiterliste), daher keine Mengen.</div>}
          {items.length > 0 ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr>{checkable && <th aria-label="gekauft" />}<th>Zutat</th><th className="num">Menge</th><th>Einheit</th></tr></thead>
                <tbody>
                  {items.map((i) => <tr key={`${i.item}|${i.unit}`}>{checkable && <td className="tick">☐</td>}<td>{i.item}</td><td className="num">{AMOUNT.format(i.amount)}</td><td>{i.unit}</td></tr>)}
                </tbody>
              </table>
            </div>
          ) : <p className="muted" style={{ margin: 0 }}>Keine geplante Mahlzeit passt zu einem Rezept.</p>}
          {missing.length > 0 && <p className="small muted" style={{ marginBottom: 0 }}>Ohne Rezept: {missing.join(" · ")}</p>}
        </>
      )}
    </section>
  );
}
