/** Who is AL or J+S Coach, from the email lists in camps.json. Roles never widen Drive access. */
export type RoleLists = { al: string[]; coach: string[] };
export type Roles = { al: boolean; coach: boolean };

const norm = (s: string) => s.trim().toLowerCase();

export function rolesOf(email: string | null | undefined, lists: RoleLists): Roles {
  if (!email) return { al: false, coach: false };
  const me = norm(email);
  return { al: lists.al.some((e) => norm(e) === me), coach: lists.coach.some((e) => norm(e) === me) };
}
