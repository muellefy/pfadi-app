"use client";

export default function CampError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="notice error" style={{ display: "grid", gap: 10 }}>
      <b>Da ist etwas schiefgelaufen.</b>
      <span>{error.message}</span>
      <div><button className="btn" onClick={reset}>Nochmals versuchen</button> <a className="btn" href="/login">Neu anmelden</a></div>
    </div>
  );
}
