import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("getConfig: a camps.json without roles still loads, with nobody in a role", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cfg-"));
  writeFileSync(path.join(dir, "camps.json"), JSON.stringify({ camps: [] }));
  process.env.CAMPS_CONFIG = path.join(dir, "camps.json");
  process.env.DATA_DIR = dir;
  const { getConfig } = await import("./config.ts");
  assert.deepEqual((await getConfig()).roles, { al: [], coach: [] });
});
