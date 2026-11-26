import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSecurityPolicy, newNonce } from "./csp.ts";

test("scripts need the nonce", () => {
  const csp = contentSecurityPolicy("abc");
  assert.match(csp, /script-src 'self' 'nonce-abc' 'strict-dynamic'(;|$)/);
  assert.doesNotMatch(csp, /unsafe-eval|unsafe-inline/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
});

test("dev mode allows eval for React's debugging", () => {
  assert.match(contentSecurityPolicy("abc", true), /'unsafe-eval'/);
});

test("every nonce is new", () => {
  assert.notEqual(newNonce(), newNonce());
  assert.match(newNonce(), /^[A-Za-z0-9+/]+=*$/);
});
