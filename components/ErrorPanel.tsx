"use client";

/**
 * Shown when a page fails. In production Next.js hides server error texts and only passes
 * a number (digest); the full reason is in the server log under that number.
 */
export function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="notice error" style={{ display: "grid", gap: 10 }}>
      <b>Da ist etwas schiefgelaufen.</b>
      {error.digest ? (
        <span>
          Fehlernummer <code>{error.digest}</code>. Wer die App betreibt, findet den Grund im Server-Log:{" "}
          <code>docker compose logs app | grep -A5 {error.digest}</code>
        </span>
      ) : (
        <span>{error.message}</span>
      )}
      <div><button className="btn" onClick={reset}>Nochmals versuchen</button> <a className="btn" href="/login">Neu anmelden</a></div>
    </div>
  );
}
