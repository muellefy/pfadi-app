import { test } from "node:test";
import assert from "node:assert/strict";
import { serialize } from "./lock.ts";

const tick = () => new Promise((r) => setTimeout(r, 5));

test("serialize: calls with the same key never overlap", async () => {
  const log: string[] = [];
  const job = (name: string) => async () => { log.push(`${name} start`); await tick(); log.push(`${name} end`); return name; };
  const results = await Promise.all([serialize("file", job("a")), serialize("file", job("b"))]);
  assert.deepEqual(results, ["a", "b"]);
  assert.deepEqual(log, ["a start", "a end", "b start", "b end"]);
});

test("serialize: a failing call does not block the next one", async () => {
  const failed = serialize("f2", async () => { throw new Error("boom"); });
  await assert.rejects(failed, /boom/);
  assert.equal(await serialize("f2", async () => "ok"), "ok");
});
