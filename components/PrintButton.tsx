"use client";

/** Opens the browser's print dialog (or "Als PDF sichern" on the phone). */
export function PrintButton() {
  return <button type="button" className="btn primary no-print" onClick={() => window.print()}>Drucken</button>;
}
