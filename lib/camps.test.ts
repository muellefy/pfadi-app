import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFiles, driveId, ecampId, pickCurrent, slugify, type CopiedEntry } from "./camps.ts";

const camps = [
  { slug: "pfila-26", start: "2026-05-23", end: "2026-05-25" },
  { slug: "sola-27", start: "2027-07-19", end: "2027-07-31" },
  { slug: "hela-27", start: "2027-10-04", end: "2027-10-09" },
];

test("pickCurrent: the chosen camp wins if it still exists", () => {
  assert.equal(pickCurrent(camps, "hela-27", "2026-11-07"), "hela-27");
  assert.equal(pickCurrent(camps, "gone", "2026-11-07"), "sola-27");
});

test("pickCurrent: running, then next upcoming, then most recent", () => {
  assert.equal(pickCurrent(camps, undefined, "2027-07-20"), "sola-27");
  assert.equal(pickCurrent(camps, undefined, "2026-11-07"), "sola-27");
  assert.equal(pickCurrent(camps, undefined, "2028-01-01"), "hela-27");
  assert.equal(pickCurrent([{ slug: "x" }], undefined), "x");
});

test("driveId: links and bare ids", () => {
  assert.equal(driveId("https://drive.google.com/drive/folders/16wJJ3LUI1X0YbNH9eXwPBJUTsgmlCHnq?usp=sharing"), "16wJJ3LUI1X0YbNH9eXwPBJUTsgmlCHnq");
  assert.equal(driveId("https://drive.google.com/file/d/1hR78kUWhl4OOX4D5S77FMhZNEO095zmx/view"), "1hR78kUWhl4OOX4D5S77FMhZNEO095zmx");
  assert.equal(driveId(" 19-FYgvVAPA2jocUDauAh4FdKp8Nz_vqR "), "19-FYgvVAPA2jocUDauAh4FdKp8Nz_vqR");
  assert.equal(driveId("not a link"), null);
});

test("ecampId and slugify", () => {
  assert.equal(ecampId("https://app.ecamp3.ch/camps/68c90dc8e4ff/program"), "68c90dc8e4ff");
  assert.equal(ecampId(""), null);
  assert.equal(slugify("Herbstlager «Über alle Berge» 27"), "herbstlager-ueber-alle-berge-27");
});

test("detectFiles: finds Lagerdaten and the people lists by name", () => {
  const e = (name: string, isFolder = false, mimeType = ""): CopiedEntry => ({ path: [], id: name, name, isFolder, mimeType });
  const found = detectFiles([
    e("01_Hauptleitung", true), e("Lagerdaten.xlsx"), e("12_TN - Infos", true), e("121_TN Liste", true), e("Leiterliste", true),
    e("09_Lagerbudget", true), e("08_Küche", true),
  ]);
  assert.deepEqual(found, {
    termineFileId: "Lagerdaten.xlsx", tnFileId: "121_TN Liste", leiterFileId: "Leiterliste", budgetFileId: "09_Lagerbudget", menuFileId: "08_Küche",
  });
});
