import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePeople } from "./people.ts";

test("parsePeople: detects name, stufe and Hinweis columns", () => {
  const { rows, roles } = parsePeople([
    ["Vorname", "Nachname", "Pfadiname", "Stufe", "Allergien", "Telefon"],
    ["Mia", "Muster", "Kiwi", "Wölfli", "Nüsse", "079 123 45 67"],
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    [roles.vorname, roles.nachname, roles.pfadiname, roles.stufe, roles.telefon, roles.hinweise],
    ["Vorname", "Nachname", "Pfadiname", "Stufe", "Telefon", ["Allergien"]],
  );
});

test("parsePeople: a \"Wer bisch duu?\" form column is the name", () => {
  const { roles } = parsePeople([
    ["Zeitstempel", "Wer bisch duu?", "Natel", "Allergien"],
    ["18.11.2026 13:09", "Kiwi", "079 123 45 67", "keine"],
  ]);
  assert.equal(roles.vorname, "Wer bisch duu?");
});
