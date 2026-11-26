/** Who is AL or J+S Coach, from the email lists in camps.json. Roles never widen Drive access. */
export type RoleLists = { al: string[]; coach: string[] };
export type Roles = { al: boolean; coach: boolean };

const norm = (s: string) => s.trim().toLowerCase();

export function rolesOf(email: string | null | undefined, lists: RoleLists): Roles {
  if (!email) return { al: false, coach: false };
  const me = norm(email);
  return { al: lists.al.some((e) => norm(e) === me), coach: lists.coach.some((e) => norm(e) === me) };
}

/**
 * Who may open the Coach page. It shows eCamp block contents (notes, safety texts) that
 * come through the shared eCamp account, not the person's own access, so it stays narrow.
 */
export const canReview = (r: Roles) => r.al || r.coach;
