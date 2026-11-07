import { test } from "node:test";
import assert from "node:assert/strict";
import { cached, forget } from "./cache.ts";

test("cached: concurrent and repeated calls share one result", async () => {
  let calls = 0;
  const fn = async () => ++calls;
  const [a, b] = await Promise.all([cached("k1", 1000, fn), cached("k1", 1000, fn)]);
  assert.deepEqual([a, b, await cached("k1", 1000, fn)], [1, 1, 1]);
  assert.equal(calls, 1);
});

test("cached: runs again once the entry expired", async () => {
  let calls = 0;
  const fn = async () => ++calls;
  await cached("k2", 0, fn);
  assert.equal(await cached("k2", 0, fn), 2);
});

test("cached: a failure is not kept", async () => {
  await assert.rejects(cached("k3", 1000, async () => { throw new Error("boom"); }), /boom/);
  assert.equal(await cached("k3", 1000, async () => "ok"), "ok");
});

test("cached: serves a stale result at once and refreshes it in the background", async () => {
  let calls = 0;
  const fn = async () => ++calls;
  assert.equal(await cached("k4", 0, fn, 60_000), 1);
  assert.equal(await cached("k4", 0, fn, 60_000), 1); // stale, refresh started
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await cached("k4", 0, fn, 60_000), 2); // the refreshed value
  assert.equal(calls, 3);
});

test("cached: a failed background refresh drops the stale result", async () => {
  let fail = false;
  const fn = async () => { if (fail) throw new Error("revoked"); return "data"; };
  await cached("k5", 0, fn, 60_000);
  fail = true;
  assert.equal(await cached("k5", 0, fn, 60_000), "data");
  await new Promise((r) => setTimeout(r, 5));
  await assert.rejects(cached("k5", 0, fn, 60_000), /revoked/);
});

test("forget: drops matching keys", async () => {
  let calls = 0;
  const fn = async () => ++calls;
  await cached("list:a:folder1", 60_000, fn);
  forget((k) => k.endsWith(":folder1"));
  assert.equal(await cached("list:a:folder1", 60_000, fn), 2);
});
