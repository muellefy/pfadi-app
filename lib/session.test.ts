import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutAccessToken } from "./session.ts";

test("withoutAccessToken: drops the token, keeps the rest and the cookies", async () => {
  const res = Response.json({ user: { email: "a@pfadis.ch" }, accessToken: "ya29.secret" }, { headers: { "set-cookie": "s=1" } });
  const out = await withoutAccessToken(res);
  assert.deepEqual(await out.json(), { user: { email: "a@pfadis.ch" } });
  assert.equal(out.headers.get("set-cookie"), "s=1");
});

test("withoutAccessToken: no session stays null, non-JSON passes through", async () => {
  assert.equal(await (await withoutAccessToken(Response.json(null))).json(), null);
  const redirect = new Response(null, { status: 302, headers: { location: "/login" } });
  assert.equal(await withoutAccessToken(redirect), redirect);
});
