/**
 * Per-camp roles (Hauptleitung, Küche): the lists in camps.json plus the ones the
 * Hauptleitung manages in the app ($DATA_DIR/roles.json). Pure rules, no file access.
 */
import { canManageRoles, type Roles } from "./roles.ts";

export const CAMP_ROLES = ["hauptleitung", "kueche"] as const;
export type CampRole = (typeof CAMP_ROLES)[number];
export type CampRoleLists = Record<CampRole, string[]>;

export const ROLE_LABEL: Record<CampRole, string> = { hauptleitung: "Hauptleitung", kueche: "Küche" };

const norm = (s: string) => s.trim().toLowerCase();
const uniq = (list: string[]) => [...new Set(list.map(norm).filter(Boolean))];

export function mergeRoles(base: Partial<CampRoleLists>, stored?: Partial<CampRoleLists>): CampRoleLists {
  return {
    hauptleitung: uniq([...(base.hauptleitung ?? []), ...(stored?.hauptleitung ?? [])]),
    kueche: uniq([...(base.kueche ?? []), ...(stored?.kueche ?? [])]),
  };
}

/** null when the address may get a role, else the reason. */
export function checkRoleEmail(email: string, domain: string): string | null {
  const e = norm(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "Bitte eine gültige E-Mail-Adresse eingeben.";
  if (!e.endsWith(`@${domain.toLowerCase()}`)) return `Nur Adressen mit @${domain} können sich anmelden.`;
  return null;
}

/** Adds or removes `email` in the app's lists; `base` are the fixed lists from camps.json. */
export function changeRole(stored: CampRoleLists, base: CampRoleLists, role: CampRole, email: string, add: boolean):
  { stored: CampRoleLists } | { error: string } {
  const e = norm(email);
  if (add) return { stored: { ...stored, [role]: uniq([...stored[role], e]) } };
  if (base[role].map(norm).includes(e)) return { error: "Diese Person steht fest in der Lager-Konfiguration (config/camps.json oder, bei in der App angelegten Lagern, data/camps.json) und kann nur dort entfernt werden." };
  const next = { ...stored, [role]: stored[role].filter((x) => norm(x) !== e) };
  if (role === "hauptleitung" && mergeRoles(base, next).hauptleitung.length === 0) {
    return { error: "Die letzte Hauptleitung kann nicht entfernt werden. Zuerst eine andere Person eintragen." };
  }
  return { stored: next };
}

/** null when this person may make this change, else the reason. `role` comes from the browser: check it. */
export function authorizeRoleChange(roles: Roles, role: string, email: string, add: boolean, domain: string): string | null {
  if (!(CAMP_ROLES as readonly string[]).includes(role)) return "Unbekannte Rolle.";
  if (!canManageRoles(roles)) return "Nur die Hauptleitung dieses Lagers und die Abteilungsleitung dürfen Rollen vergeben.";
  return add ? checkRoleEmail(email, domain) : null;
}
