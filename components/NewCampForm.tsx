"use client";
import { useActionState, useState } from "react";
import { createCamp, type CreateState } from "@/app/lager/actions";
import { slugify } from "@/lib/camps";

const KINDS = ["Sommerlager", "Herbstlager", "Pfingstlager", "Auffahrtslager", "Weekend", "Lager"];

export function NewCampForm({ defaultTemplate }: { defaultTemplate: string }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createCamp, {});
  const v = state.values ?? {};
  const [name, setName] = useState(v.name ?? "");
  const [slug, setSlug] = useState(v.slug ?? "");

  return (
    <form action={action} className="card form" style={{ maxWidth: 720 }}>
      {state.error && <div className="notice error">{state.error}</div>}

      <fieldset>
        <legend>Lager</legend>
        <label>Name<input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Sola 28" /></label>
        <div className="row">
          <label>Art
            <select name="kind" defaultValue={v.kind ?? "Sommerlager"}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </label>
          <label>Kurzname in der Adresse
            <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(name) || "sola-28"} pattern="[a-z0-9-]*" />
          </label>
        </div>
        <label>Motto <span className="muted">(optional)</span><input name="motto" defaultValue={v.motto} /></label>
        <div className="row">
          <label>Lagerbeginn<input type="date" name="start" defaultValue={v.start} /></label>
          <label>Lagerende<input type="date" name="end" defaultValue={v.end} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Drive</legend>
        <label>Wohin soll der Lagerordner?
          <input name="parent" required defaultValue={v.parent} placeholder="https://drive.google.com/drive/folders/…" />
          <small className="muted">Link oder ID des Ordners, in dem der neue Lagerordner angelegt wird.</small>
        </label>
        <label>Name des neuen Ordners <span className="muted">(leer = Lagername)</span>
          <input name="folder" defaultValue={v.folder} placeholder={name ? `z. B. 03_${name}` : ""} />
        </label>
        <label>Vorlage
          <input name="template" defaultValue={v.template ?? defaultTemplate} required placeholder="Link oder ID des Vorlage-Ordners" />
        </label>
      </fieldset>

      <fieldset>
        <legend>eCamp <span className="muted">(optional)</span></legend>
        <label>Adresse des Lagers in eCamp
          <input name="ecamp" defaultValue={v.ecamp} placeholder="https://app.ecamp3.ch/camps/…" />
          <small className="muted">Den technischen eCamp-Account dort als Gast einladen.</small>
        </label>
      </fieldset>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary" disabled={pending}>{pending ? "Kopiere Vorlage …" : "Lager anlegen"}</button>
        {pending && <span className="muted small" role="status">Das kann je nach Vorlage eine Minute dauern.</span>}
      </div>
    </form>
  );
}
