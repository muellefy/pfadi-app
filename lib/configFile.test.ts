import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { emailList, parseConfigFile } from "./configFile.ts";

const Schema = z.object({ roles: z.object({ al: z.array(z.string()) }) });

test("parseConfigFile: a missing comma names the file, the line and the usual cause", () => {
  const raw = '{\n  "roles": { "al": ["a@pfadis.ch"] }\n  "camps": []\n}';
  assert.throws(() => parseConfigFile(Schema, raw, "config/camps.json"), (e: Error) =>
    e.message.startsWith("config/camps.json:") && /Zeile 3/.test(e.message) && /Komma/.test(e.message));
});

test("parseConfigFile: a wrong value names its place in the file", () => {
  assert.throws(() => parseConfigFile(Schema, '{ "roles": { "al": 5 } }', "config/camps.json"), (e: Error) =>
    e.message.startsWith("config/camps.json:") && /roles\.al/.test(e.message));
});

test("parseConfigFile: valid content comes back parsed", () => {
  assert.deepEqual(parseConfigFile(Schema, '{ "roles": { "al": [] } }', "f"), { roles: { al: [] } });
});

test("emailList: one address without brackets counts as a list of one", () => {
  assert.deepEqual(emailList.parse("a@pfadis.ch"), ["a@pfadis.ch"]);
  assert.deepEqual(emailList.parse(["a@pfadis.ch", "b@pfadis.ch"]), ["a@pfadis.ch", "b@pfadis.ch"]);
  assert.deepEqual(emailList.parse(undefined), []);
});
