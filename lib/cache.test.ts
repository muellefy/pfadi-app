import { test } from "node:test";
import assert from "node:assert/strict";
import { cached } from "./cache.ts";

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
