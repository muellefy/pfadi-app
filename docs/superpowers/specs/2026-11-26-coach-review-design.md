# Coach review page

## Why
The J+S Coach reviews a camp by reading the Lagerdossier and every program block
in eCamp. Today they open each block one by one. This page shows all blocks with
their content on one page and points at what is missing.

## Goals
- One page per camp, `/<camp>/coach`, linked in the navigation as "Coach".
- Every eCamp block in program order, grouped by day, content already open:
  title, time, category, location, progress label, goals (LearningObjectives),
  safety notes (SafetyConsiderations), story context, storyboard, notes, material,
  J+S characteristics, movement time.
- Gaps highlighted per block: no safety notes, no goals, a J+S block without movement time,
  a J+S block under 30 min.
- One line per day with the J+S check: hours of J+S activity (≥ 4 h), movement time
  (≥ 2 h), parts of the day covered (≥ 2 of morning/afternoon/evening).
  First and last day are checked together, as J+S counts them as one day.
- Filter "nur Blöcke mit Lücken" (`?luecken=1`, server-side, no client code).
- Link to the Lagerdossier at the top: the newest file in the camp's root folder whose
  name contains "dossier".

## Non-goals
- No feedback, approval or comments (not a pain today; can come later).
- Nothing is written to eCamp (the app's eCamp account is a read-only guest).
- No roles: everyone logged in can open the page, like every other page.
- No camp-level checks (TN count, leader ratio, recognitions) in this step.

## Anti-goals
- eCamp text is HTML written by users: it must never be rendered as HTML.
  It is turned into plain text (paragraphs and list items become lines).

## Approaches
- A. eCamp's own print-to-PDF: no code, but the Coach still finds gaps alone.
- **B. This page (picked):** one read, gaps flagged, reuses the eCamp client and cache.
- C. Expandable blocks on the program page: still one click per block.

## How
- `lib/data/ecamp.ts` exports its `get()`; a new `lib/data/ecampBlocks.ts` fetches
  `GET /api/content_nodes?camp=<iri>` (all content of the camp in one request) and
  maps nodes to activities via each activity's `rootContentNode` link. Cached like the
  program (2 min fresh, 12 h stale). Schedule entries gain `ysPhysicalActivityDurationMinutes`.
- Pure helpers in `lib/coach.ts` (+ `lib/coach.test.ts`): HTML → text, gaps per block,
  J+S check per day.
- The J+S numbers live in `lib/js-rules.ts` (min hours, min movement, min block length,
  which category counts as non-J+S: `LP`), changed by PR when J+S changes them.
- Page `app/[camp]/coach/page.tsx`, components in `components/`, existing styles.

## Left to the builder
- Material: show the item list if eCamp returns it cheaply for the camp, otherwise
  "Material: n Einträge" or just whether the block has material.
- Exact grouping/labels of the day line; reuse existing card and pill styles.

## Calls I made (correct me)
- Lagerdossier is found by name ("dossier") in the camp root folder, no new config field.
- A block counts as J+S unless its category short name is `LP`.
- Parts of the day: morning before 12:00, afternoon 12:00–18:00, evening after 18:00.

---

# The rest of the coach/AL work (same branch of thought, separate PRs)

Asked for: "do not forget the other stuff, in the order you like, and the roles".
Order: 1 roles → 2 coach review page (above) → 3 coach checklist → 4 receipt → booking → 5 AL overview.

## 1. Roles
- `camps.json` gets an optional top-level `"roles": { "al": [emails], "coach": [emails] }`
  (hand-edited, like the rest of the file; emails compared lower-case).
- `lib/roles.ts`: `rolesOf(email, config)` → `{ al, coach }`, pure, tested.
- What a role unlocks (my call): the status details on `/lager` (part 5) for AL and Coach,
  and a small "AL"/"Coach" tag next to the name in the sidebar.
  Drive still decides who sees which file; roles never widen Drive access.
- Not now: restricting who can create camps or who sees the Coach page
  (the Lagerleitung profits from the gap list too).

## 3. Coach checklist (deadlines that follow the camp)
- A "Wann" cell in Lagerdaten.xlsx may say `7 Wochen vorher`, `6 Wochen vorher`,
  `10 Tage vorher` (counted back from the camp start) or `2 Wochen nachher`
  (counted from the camp end). Units: Tage, Wochen. The row then gets a real date and
  status like any other Termin; the cell keeps its text.
- `parseTermine` takes the camp dates (eCamp periods, else config, else "Erster Lagertag").
- The rows themselves go into the template `Lagerdaten.xlsx` by hand (the app cannot
  edit the template); the PR description lists the rows to paste, with "Wer = Coach/AL".

## 4. Receipt → booking
- The booking form on the budget page gets an optional field "Beleg (Foto oder PDF)".
- On save: the file is uploaded first (existing `/api/drive/upload`) into the folder that
  holds the budget file, named `Beleg <Datum> <Text>.<ext>`, then the booking is written
  as today. If the booking fails, the receipt stays uploaded (nothing is lost).
- The journal part of `BudgetView.tsx` moves into its own component (file size rule).

## 5. AL overview
- `/lager` cards show, for people with the AL or Coach role: overdue Termine,
  TN count, budget balance (plan vs. actual) and the number of J+S day checks that fail.
- Each card loads in its own Suspense boundary, so the page appears at once and a slow
  camp only delays its own card (the "slow" fix for this page). The cache durations stay
  as they are; a longer Drive cache is a separate decision (it trades freshness of
  Drive permissions for speed).

---

# Camp roles page and Küche role (asked 26.11.2026)

Asked for: a Küche role; a page where the Hauptleitung manages all roles of a camp;
"Hauptleitung should be like the admin for the camp". Decided by the user:
Küche opens on the Menüplan and only Küche/Hauptleitung may edit the Menüplan and
book in kitchen budget categories; the admin page manages roles only; one release after both.

## Roles page (`/<camp>/rollen`)
- Per-camp roles: `hauptleitung`, `kueche`. AL and Coach stay Abteilung-wide in camps.json.
- Stored by the app in `$DATA_DIR/roles.json` (`{ "<slug>": { "hauptleitung": [], "kueche": [] } }`,
  atomic write, one write at a time). Lists in camps.json (`camps[].hauptleitung`, `camps[].kueche`)
  are added on top and can't be removed in the app.
- Everyone logged in sees who has which role; the camp's Hauptleitung and the AL can add and remove.
- Emails must be valid and end in `@<ALLOWED_DOMAIN>`. The last Hauptleitung can't be removed
  (the AL can always add one, since AL lives in camps.json).

## Küche role
- The sidebar tag "Küche"; "/" opens the Menüplan for Küche people (not for the Hauptleitung);
  Menü moves first in their navigation.
- Once a camp has at least one Küche person, only Küche, Hauptleitung and AL may change the
  Menüplan and add/change/delete bookings in kitchen categories (name contains Essen, Küche,
  Verpflegung or Lebensmittel). With no Küche person, everything stays as before.
- Checked on the server in the actions; the UI only hides what would fail.
