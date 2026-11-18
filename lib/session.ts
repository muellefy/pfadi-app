/**
 * /api/auth/session is readable by browser JS, so the Google access token
 * (full Drive scope) is removed there; server code still gets it from auth().
 */
export async function withoutAccessToken(res: Response): Promise<Response> {
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) return res;
  const session = await res.json();
  if (session) delete session.accessToken;
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return Response.json(session, { status: res.status, headers });
}
