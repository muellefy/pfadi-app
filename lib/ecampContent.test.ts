import { test } from "node:test";
import assert from "node:assert/strict";
import { toBlockContent } from "./ecampContent.ts";

const node = (self: string, root: string, contentTypeName: string, data: unknown) =>
  ({ contentTypeName, data, _links: { self: { href: self }, root: { href: root } } });

test("toBlockContent: groups text nodes by their activity's root, as plain text", () => {
  const out = toBlockContent([
    node("/n/1", "/r/a", "ColumnLayout", { columns: [] }),
    node("/n/2", "/r/a", "SafetyConsiderations", { html: "<p>Helm &amp; Seil</p>" }),
    node("/n/3", "/r/a", "LearningObjectives", { html: "<p>Ziel 1</p>" }),
    node("/n/4", "/r/a", "LearningObjectives", { html: "<p>Ziel 2</p>" }),
    node("/n/5", "/r/b", "Notes", { html: "<p>Notiz</p>" }),
  ], []);
  assert.equal(out["/r/a"].safety, "Helm & Seil");
  assert.equal(out["/r/a"].goals, "Ziel 1\nZiel 2");
  assert.equal(out["/r/b"].notes, "Notiz");
  assert.equal(out["/r/b"].safety, "");
});

test("toBlockContent: storyboard sections in order, one line each", () => {
  const out = toBlockContent([node("/n/1", "/r/a", "Storyboard", { sections: {
    s2: { column1: "10'", column2Html: "<p>Spiel</p>", column3: "Kim", position: 1 },
    s1: { column1: "5'", column2Html: "<p>Einstieg</p>", column3: "", position: 0 },
  } })], []);
  assert.deepEqual(out["/r/a"].storyboard, ["5' · Einstieg", "10' · Spiel · Kim"]);
});

test("toBlockContent: checked J+S characteristics only", () => {
  const out = toBlockContent([node("/n/1", "/r/a", "YSActivityCharacteristics", { options: { play: { checked: true }, hike: { checked: false } } })], []);
  assert.deepEqual(out["/r/a"].characteristics, ["play"]);
});

test("toBlockContent: material items land on the block of their material node", () => {
  const out = toBlockContent(
    [node("/n/9", "/r/a", "Material", null)],
    [{ article: "Seil", quantity: 2, unit: "Stk", _links: { materialNode: { href: "/n/9" } } }, { article: "Ball", _links: { materialNode: { href: "/n/9" } } }],
  );
  assert.deepEqual(out["/r/a"].material, ["2 Stk Seil", "Ball"]);
});
