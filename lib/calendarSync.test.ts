import { test } from "node:test";
import assert from "node:assert/strict";
import { eventId, planSync, terminEvent, yearEvent } from "./calendarSync.ts";

test("eventId: stable, and only the characters Google allows (0-9, a-v)", () => {
  const id = eventId("sola-27", "Termine|PBS-Anmeldung|1");
  assert.equal(id, eventId("sola-27", "Termine|PBS-Anmeldung|1"));
  assert.notEqual(id, eventId("pfila-27", "Termine|PBS-Anmeldung|1"));
  assert.match(id, /^[0-9a-v]{5,1024}$/);
});

test("terminEvent: an all-day event with the camp in the title and the invitees as guests", () => {
  const e = terminEvent({ camp: "Sola 27", was: "Lagermeldung an Coach", date: "2027-06-01", wer: "HL", anWen: "Coach", link: "https://lager.pfadis.ch/sola-27/termine" }, ["hl@pfadis.ch"]);
  assert.deepEqual(e.start, { date: "2027-06-01" });
  assert.deepEqual(e.end, { date: "2027-06-02" });
  assert.equal(e.summary, "Sola 27: Lagermeldung an Coach");
  assert.deepEqual(e.attendees, [{ email: "hl@pfadis.ch" }]);
  assert.match(e.description, /Wer: HL/);
  assert.match(e.description, /An wen: Coach/);
  assert.match(e.description, /lager\.pfadis\.ch\/sola-27\/termine/);
});

test("yearEvent: a camp spans its days, the end is exclusive", () => {
  const e = yearEvent({ name: "Sola 27", kind: "Sommerlager", start: "2027-07-19", end: "2027-07-31", link: "https://x/sola" }, []);
  assert.deepEqual([e.start, e.end], [{ date: "2027-07-19" }, { date: "2027-08-01" }]);
  assert.equal(e.summary, "Sola 27 (Sommerlager)");
});

test("planSync: only new or changed events are sent, gone ones removed, done ones kept", () => {
  const stored = { a: "h1", b: "h2", c: "h3", d: "h4" };
  const wanted = [
    { id: "a", hash: "h1" }, // unchanged
    { id: "b", hash: "h2-new" }, // date changed
    { id: "e", hash: "h5" }, // new
  ];
  const keep = ["d"]; // ticked off, stays in the calendar as it is
  const plan = planSync(stored, wanted, keep);
  assert.deepEqual(plan.send.map((w) => w.id), ["b", "e"]);
  assert.deepEqual(plan.remove, ["c"]);
});
