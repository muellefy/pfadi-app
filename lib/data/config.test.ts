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

test("getConfig: roles from roles.json are added to the camp, camps.json ones stay fixed", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cfg-"));
  const camp = { slug: "sola", name: "Sola", drive: { rootFolderId: "r" }, hauptleitung: ["fix@pfadis.ch"] };
  writeFileSync(path.join(dir, "camps.json"), JSON.stringify({ camps: [camp] }));
  writeFileSync(path.join(dir, "roles.json"), JSON.stringify({ sola: { hauptleitung: ["App@pfadis.ch"], kueche: ["k@pfadis.ch"] } }));
  process.env.CAMPS_CONFIG = path.join(dir, "camps.json");
  process.env.DATA_DIR = dir;
  const { forgetConfig, getCamp } = await import("./config.ts");
  forgetConfig();
  const sola = await getCamp("sola");
  assert.deepEqual(sola?.hauptleitung, ["fix@pfadis.ch", "app@pfadis.ch"]);
  assert.deepEqual(sola?.kueche, ["k@pfadis.ch"]);
  assert.deepEqual(sola?.fixedRoles, { hauptleitung: ["fix@pfadis.ch"], kueche: [] });
});

test("getConfig: a single email without brackets counts as a list", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cfg-"));
  writeFileSync(path.join(dir, "camps.json"), JSON.stringify({ roles: { al: "al@pfadis.ch" }, camps: [] }));
  process.env.CAMPS_CONFIG = path.join(dir, "camps.json");
  process.env.DATA_DIR = dir;
  const { forgetConfig, getConfig } = await import("./config.ts");
  forgetConfig();
  assert.deepEqual((await getConfig()).roles.al, ["al@pfadis.ch"]);
});

test("getConfig: a broken camps.json says where", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cfg-"));
  writeFileSync(path.join(dir, "camps.json"), '{\n  "roles": { "al": [] }\n  "camps": []\n}');
  process.env.CAMPS_CONFIG = path.join(dir, "camps.json");
  process.env.DATA_DIR = dir;
  const { forgetConfig, getConfig } = await import("./config.ts");
  forgetConfig();
  await assert.rejects(getConfig(), /camps\.json: kein gültiges JSON bei Zeile 3/);
});
