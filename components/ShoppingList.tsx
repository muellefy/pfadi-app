import type { MenuPlan } from "@/lib/menu";
import { RECIPES_SHEET, shoppingList, type Ingredient } from "@/lib/shopping";

const AMOUNT = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });

/** What the kitchen has to buy for the whole Menüplan, from the «Rezepte» sheet × headcount. */
export function ShoppingList({ plan, recipes, headcount }: { plan: MenuPlan; recipes: Ingredient[]; headcount: number }) {
  const { items, missing } = shoppingList(plan, recipes, headcount);
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="card-head"><h2>Einkaufsliste</h2><span className="small muted">für {headcount || "?"} Personen, ganzes Lager</span></div>
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
                <thead><tr><th>Zutat</th><th className="num">Menge</th><th>Einheit</th></tr></thead>
                <tbody>
                  {items.map((i) => <tr key={`${i.item}|${i.unit}`}><td>{i.item}</td><td className="num">{AMOUNT.format(i.amount)}</td><td>{i.unit}</td></tr>)}
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
