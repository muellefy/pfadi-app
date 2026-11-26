"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateRole } from "@/app/[camp]/rollen/actions";
import type { CampRole } from "@/lib/campRoles";

type Props = { slug: string; role: CampRole; label: string; hint: string; emails: string[]; fixed: string[]; editable: boolean };

/** One camp role: who has it, and (for the Hauptleitung/AL) add and remove. */
export function RoleEditor({ slug, role, label, hint, emails, fixed, editable }: Props) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const change = (email: string, add: boolean, done?: () => void) =>
    start(async () => {
      setError("");
      const res = await updateRole(slug, role, email, add).catch(() => ({ ok: false as const, error: "Keine Verbindung." }));
      if (!res.ok) { setError(res.error); return; }
      done?.();
      router.refresh();
    });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    change(String(new FormData(form).get("email") ?? ""), true, () => form.reset());
  };

  return (
    <section className="card">
      <div className="card-head"><h2>{label}</h2><span className="small muted">{emails.length}</span></div>
      <p className="small muted" style={{ marginTop: 0 }}>{hint}</p>
      {emails.length === 0 ? <p className="muted">Noch niemand.</p> : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {emails.map((e) => (
            <li key={e} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span>{e}{fixed.includes(e) && <span className="small muted"> · fest in camps.json</span>}</span>
              {editable && !fixed.includes(e) && (
                <button className="btn ghost small" disabled={pending} onClick={() => { if (confirm(`${e} als ${label} entfernen?`)) change(e, false); }}>Entfernen</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form className="form" onSubmit={submit} style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input name="email" type="email" required placeholder="name@pfadis.ch" aria-label={`E-Mail für ${label}`} style={{ flex: "1 1 200px" }} />
          <button className="btn primary" disabled={pending}>Hinzufügen</button>
        </form>
      )}
      {error && <div className="notice error" style={{ marginTop: 10 }} role="alert">{error}</div>}
    </section>
  );
}
