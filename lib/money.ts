const CHF = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });
/** "CHF 1’234.50", rounded to the Rappen */
export const money = (n: number) => CHF.format(Math.round(n * 100) / 100);
