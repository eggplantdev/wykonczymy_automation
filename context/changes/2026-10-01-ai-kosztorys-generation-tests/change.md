---
change_id: ai-kosztorys-generation-tests
title: AI kosztorys generation tests
status: new
created: 2026-10-01
updated: 2026-10-12
archived_at: null
branch: null
worktree: null
---

## Goal

This change tests whether an agent can draft a preliminary kosztorys offer (Przedmiar per rozpiska
position) from what a client sends us: an email, a projekt PDF, electrical/lighting drawings, and a
shopping list.

The question it answers: **how far can we rely on it?** The main concern is the quantities, and the
surfaces above all, because those are what the agent computes rather than reads.

**The output is the kosztorys itself, not a message.** The end state is an agent that writes
Przedmiar, a per-row source (Komentarz) and the missing positions straight into the investment's
kosztorys in the app, and puts its open questions in the investment's „Uwagi AI”. A markdown proposal is
an intermediate artifact of the experiment. The point is to automate as much of drafting an offer
as possible.

This is an experiment, not a feature. Nothing here ships. Each test case gets its own folder under
`cases/`.

## Fast path: an investment the owner already added (cases 5–7)

The owner adds a lead as `quote` („Wycena”) with the mail in Notatki and the files in „Pliki”, and
no kosztorys. Per investment, one at a time:

1. `adopt-case-prod.ts` (`DRY=1` first) — files out of the repo, kosztorys seeded from szablon #166,
   `cases/<n>-<slug>/` with `case.json` and the rozpiska dump. Redact contacts in
   `inputs/client-inquiry.md`; client names stay out of the repo.
2. `dump-knowledge-prod.ts` — read the Manual and every Komentarz do pracy in full first.
3. Render the PDFs to PNG outside the repo (`pdftoppm -r 110`) and read every page before deriving.
4. `cases/<n>/scripts/build_draft.py` — copy case 07's: an `add(id, qty, assumptions, missing)` per
   rozpiska id, the opis copied from the dump by id (so the loader's sekcja + opis match never
   misses), measured areas as named variables, totals per sekcja printed. It writes
   `measure/ai-draft-load.json`; add `"draft"` and `"notesAppendix"` to `case.json`.
   **One sekcja per bathroom and per WC, and only for those** (owner, 2026-10-14; Manual „Łazienki
   i WC — osobna sekcja”). Give the rows of a „Łazienka” id a `section` named after the room
   („Łazienka parter”, „Łazienka piętro”, „WC parter”) and quantities for that room alone, never
   one row summing two bathrooms. `fill-case-prod.ts` renames the szablon „Łazienka” to the first
   such name and imports every further one from the szablon („Importuj sekcje z szablonu”), each
   pozycja at Przedmiar 0, so the
   owner reviews each room's whole rozpiska. Every other sekcja stays one per kosztorys: 88
   kosztorysy in prod split nothing but łazienki and WC.
5. `investment-notes-appendix.txt` in Notatki markdown (`##` headings, `- ` lists, `**bold**`;
   case 07's layout): `## Wycena AI (test, <date>)` with the **bold total** and how it was
   measured, then `## Do ustalenia z klientem` (bold key word + zł impact),
   `## Najważniejsze założenia`, `## Przedmiar 0 świadomie` — no repo paths — and
   `measurement.md`. Every line of it also on its pozycja's Komentarz AI (see „Every point lives in
   both places” below).
6. **A fresh agent reviews the draft** (since 2026-10-15; see the research log, #218 / #219). First
   freeze the drafter's output: copy `measure/ai-draft-load.json` to `measure/ai-draft-pre-review.json`
   and `investment-notes-appendix.txt` to `measure/investment-notes-appendix-pre-review.txt`. Then a
   new agent that did not draft checks the draft against every Manual rule and Komentarz do pracy,
   plus the scope (a szablon row at 0 with no reason), both places, the bathroom sekcja, the
   arithmetic (a sum against its own components) and the text (no client data, no code). It does not
   re-measure. What it is sure of it fixes in `build_draft.py` and reruns. What it cannot settle goes
   into „Do ustalenia z klientem” and onto the pozycja. It writes `review.md`, one checkbox per
   finding: `fixed` / `asked` / `dismissed`, the rule quoted, qty before → after, the zł delta. Only
   the reviewed draft is loaded. The pre-review files stay as the baseline the measurement compares
   against.
7. `fill-case-prod.ts` with `DRY=1` — its „expected AI przedmiar” must equal the script's total —
   then without, then `load-draft-sql-prod.ts` after the user's go (step 7 below).
8. Add the case to the Cases table.

**The owner hears the AI only through the kosztorys.** Anything the owner has to check or decide —
a doubt, a price that may be off, a reading that could double the scope — goes into the kosztorys,
never only into the report to the user. The report to the user is status: which investment, the
total, loaded or not, anything blocking. Don't relay the owner's to-do list back to the user.

**Every point lives in both places.** The notes appendix is the summary, and Komentarz AI on the
pozycja is where the owner meets the point while editing that row. So every „założenie” and every
„Do ustalenia z klientem” line in the appendix is also in the `assumptions` / `missingData` of each
pozycja it concerns. The zł impact may stay in the notes only. A point with no pozycja to carry it
(a whole trade at 0, a demontaż the szablon has no row for) stays in the notes only. **Check before
step 7:** walk the appendix line by line against `ai-draft-load.json` and fix the draft, not the
notes. The 2026-10-12 audit of cases 7–16 found 10 of 172 points only in the notes.

Drawings with no printed room dimensions (case 7): take the scale from any printed dimension —
stair treads and the antresola outline there — and confirm it on a second and third one before
measuring a room with it.

**No files, only a scope in Notatki** (cases 11, 12): still a case. Select every szablon pozycja the
scope implies; a quantity only when Notatki states it or it follows directly from a stated figure.
A selected pozycja with an unknown quantity goes in at qty 0 with a `missingData` starting „Praca
wybrana, ilość nieznana:”. The loader writes Komentarz AI on qty-0 rows too, so the owner sees
it was chosen. Each one also lands in „Do ustalenia z klientem”, one question per measurement.
The notes header says the total covers only the quantified pozycje. A phone photo of a sales plan
with printed m² (cases 13, 15, 16) is enough to scale the unlabelled rooms from the labelled ones.

**Batch of 2026-10-12:** #198–#206 drafted and loaded (cases 8–16); no candidates left from that
list. Re-list `quote` investments without a kosztorys for the next batch.

## Method (per case)

1. Store the client's message in `cases/<n>/inputs/client-inquiry.md`, with contacts redacted.
2. **Create the investment on production and scaffold the case** with one command,
   `scripts/new-case-prod.ts`. It needs three things, all of which stay outside the repo:
   - `TOKEN_FILE`: a file holding a user's `payload-token`;
   - `SOURCE_JSON`: the client fields `{ name, address, phone, email, contactPerson, notes }`. `notes` is
     the email text; step 7 adds the doubts;
   - `FILES_DIR`: the folder of files the client sent.

   It uploads every PDF and image in the folder. The kind is guessed from the name: an image is a
   `zdjecie`, a shopping list or offer is `inne`, and everything else is `projekt`. It then creates the
   investment (`quote` — „Wycena”, the stage before „Planowana” — kosztorys seeded from szablon `PRESET_ID`, default 166 — #165 went to the
   kosz on 2026-10-08) and writes `cases/<CASE>/case.json` and `inputs/rozpiska-szablon-<id>.txt`
   (that snapshot and the step-4 knowledge dump stay out of git — the same dump in every case).
   Run `DRY=1` first: it checks the name is free, that the szablon is live, and the action ids, and it
   prints the kind it picked for each file. The app only warns when the seed fails, so the script
   prints that warning instead of swallowing it.

   ```bash
   TOKEN_FILE=… SOURCE_JSON=… FILES_DIR=… CASE=02-<slug> [DRY=1] \
     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/new-case-prod.ts
   ```

   Both scripts work through the deployed app (`scripts/prod-client.ts`), with the same server
   actions and Blob upload the browser uses. They read the action ids from the deployed chunks on
   every run, so a deploy doesn't break them. Case 1 instead ran on the local DB first, using
   `cases/01-bemowo-125m2/scripts/create-investment.ts`.

   **When the owner already created the investment** (mail in Notatki, files in „Pliki”), run
   `scripts/adopt-case-prod.ts` instead (`TOKEN_FILE=… INVESTMENT=<id> CASE=<n>-<slug> [DRY=1]`). It
   downloads only the files marked „Do analizy AI” (stored as kind `projekt`; the upload dialog promises it), plus every file uploaded before that promise (`MARKER_PROMISE_SINCE`), when the tick still meant „rzut” — outside the repo (`~/.local/share/wykonczymy-ai-cases/<CASE>/`), and
   scaffolds the case the same way. It writes nothing to production: an empty kosztorys is seeded
   from the szablon by `fill-case-prod.ts`, as the first write of the result. Case 7 is
   the worked example.

3. (Done by step 2.) The rozpiska dump keeps the szablon's ids. The fill matches by section and
   description, so the ids don't need to survive the seeding.
4. **Dump the house knowledge first:** `TOKEN_FILE=… CASE=… node --import tsx
context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/dump-knowledge-prod.ts` writes
   `inputs/manual-i-komentarze-do-prac.md` (management's „Manual Wykończymy” plus every katalog Komentarz do pracy).
   The agent reads it in full before choosing a position or a quantity.

   **The agent may assume, and writes down every assumption — no exceptions** (owner, 2026-10-09).
   Every quantity not read from the rzut, the email or the photos has an entry in „Co / ile
   założono” on its own pozycja: what was taken, how much, and on what basis — a Manual
   entry, a katalog rule, or the agent's own estimate, named as such. An unwritten assumption is a
   defect of the draft, not a shortcut.

   The agent then reads the email and all PDFs, maps the scope to rozpiska positions, and writes
   `przedmiar-proposal.md`. That file contains:
   - the quantities;
   - a source or assumption per row;
   - new works the rozpiska lacks;
   - a list of items to verify on site.

   The tables are generated by `scripts/build-proposal.mjs`, whose `rows` array is the full quantity
   set (v1).

5. **Measure** (when the input allows it). Re-derive every estimated row from the drawings, following
   `scripts/measure/README.md`, and write `measurement.md`, which compares v1 with v2. `build-proposal.mjs`
   overlays `measure/measured.json` on the v1 rows. It writes `scripts/proposal-tables-v2.md` and
   `scripts/comparison-table.md`.
6. **Check works outside the szablon against the katalog prac** (`work_catalogue_items`) before
   inventing a position. Use the katalog's description, unit and Cena j.m. when one fits. The list
   goes into the draft as rows with their own `unit` and `clientPrice`.
7. **Write into the kosztorys** on production — ask the user before every run.
   - `scripts/fill-case-prod.ts` (`TOKEN_FILE=… CASE=… [DRY=1]`) prepares the investment: it seeds an
     empty kosztorys from the szablon, creates the sekcje the draft lacks (a bathroom or WC one
     imported from the szablon's „Łazienka”, see step 4 of the fast path) and writes
     `investment-notes-appendix.txt` to „Uwagi AI” — a field only this script writes and the app
     shows read-only. A rerun overwrites it; Notatki are the people's and the script never touches
     them. It writes no pozycja field.
   - `scripts/load-draft-sql-prod.ts` (`TOKEN_FILE=… CASE=… [DRY=1]`) loads the draft (`draft` in
     `case.json`, the `load-ai-draft.ts` shape) **straight into the production DB in one
     transaction**: AI przedmiar, „Czego nie było wiadomo” and „Co / ile założono” on every pozycja
     (0 where the draft has no row), the draft's new pozycje, and „Etap AI: Przeanalizowane”. It
     matches through the app first and stops before any write when a draft row's sekcja is missing.
     Matching and the write take ~2 s; the Payload path took ~3.5 min for 400 pozycje.
   - Then `scripts/touch-kosztorys-prod.ts` (`INVESTMENT=…`): one no-op sekcja save through the app
     to expire the editor's cache, and the AI przedmiar total read back from production, which must
     equal the draft's.
   - A `clientPrice` in the draft is used only for a new pozycja, so the szablon's Cena j.m. stands;
     a price doubt goes in `missingData` and the notes, never into the draft. The load names no owner
     field, so a rerun leaves the owner's review alone.

8. **Evaluation (not done yet for any case):** compare v1 and v2 against the owner's real offer for
   the same client, position by position.

9. **Lift the owner's Powody zmiany into the knowledge** once the owner has reviewed the draft. The agent
   never reads a Powód zmiany, so a correction stays in that one kosztorys until it is lifted.
   - The owner marks a reviewed investment „Etap AI: Recenzja zakończona” on its page (EX-1046).
   - `scripts/collect-reasons-prod.ts` (`TOKEN_FILE=…`) lists the Powody zmiany of every investment
     at „Recenzja zakończona”, read-only; `INVESTMENTS=188,189` overrides the list. It leaves out
     every Powód already decided in `knowledge-ledger.json`.
   - Each is discussed with the user and lands in `knowledge-edits.json`. A rule about one praca goes
     to its Komentarz do pracy (`set` / `append`, by katalog id plus the opis start as a guard). Only
     a rule that names no single praca, or a praca outside the katalog, goes to the Manual (`set` /
     `create` / `delete`, by topic).
   - Every discussed Powód, lifted or not, gets an entry in `knowledge-ledger.json` (pozycja id, the
     exact Powód text, `lifted` / `skipped` with a note). An edited Powód no longer matches and is
     listed again.
   - A Powód zmiany that only explains a deliberate understatement („zaniżamy, liczymy
     powykonawczo”) is not lifted: the AI quantity was right, and the owner wrote the reason so the
     lowered figure isn't read as an AI error (gładzie and akrylowanie on #203).
   - `scripts/apply-knowledge-prod.ts` with `DRY=1` prints „było → będzie”, then writes after the
     user's go through the app's own actions. An edit already in place is skipped. A completed real
     run empties the file: left in, an old entry would overwrite a later fix made in the app.
   - Then set „Etap AI: Wiedza wyekstraktowana” by hand on each source investment, so the next
     collect skips it. A Powód zmiany written after that is not picked up unless the stage is set
     back to „Recenzja zakończona”.
   - #188–#191 were lifted this way on 2026-10-12 (21 edits).

## Cases

| #   | Folder                                    | Input                                                                                                                                                                                                                                                                                                                                                                                                      | Investment (local)                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                 | Evaluated                                                                                                                    |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `cases/01-bemowo-125m2`                   | 125,6 m² flat, stan deweloperski, 2 bathrooms, 5 PDFs (vector projekt)                                                                                                                                                                                                                                                                                                                                     | **Owner's #175 production** (built on szablon #165)   | AI przedmiar **205 053,65 zł** next to the owner's Przedmiar 210 925,36 zł: 127 rows, 11 added, 5 at 0 zł. The draft is 203 763,65 zł at szablon prices; #175 prices 3 pozycje differently (+1 290 zł). #168 is in the trash                                                                                                                                                                           | **Yes, vs the owner's #175** (`owner-comparison.md`): 212 667 zł, −4,2%, but 35,8 tys. zł absolute error on shared positions |
| 2   | `cases/02-oliwa`                          | ~41 m² flat, raster plan screenshot with 7 dimensions, 1 łazienka                                                                                                                                                                                                                                                                                                                                          | **Owner's #180 production**                           | AI przedmiar **39 375,48 zł** next to the owner's Przedmiar 48 255,00 zł: 51 rows, 1 added at 0 zł (maskownica GK)                                                                                                                                                                                                                                                                                     | No                                                                                                                           |
| 3   | `cases/03-nowe-lipiny-i2`                 | Segment, Pu 101,21 m² + strych 32,38 m², stan deweloperski; scan with printed m², visualisations                                                                                                                                                                                                                                                                                                           | **#188 production** (szablon #166; #183 in the trash) | AI przedmiar **163 103,21 zł**: house 119 388 + poddasze 27 635 + rekuperacja 16 080 (two own sekcje), 94 rows, 7 at 0 zł. The draft is 163 403,21 zł; szablon #166 now prices big bag at 450 zł instead of 600 zł. Winyl instead of mikrocement: −43 646 zł                                                                                                                                           | No                                                                                                                           |
| 4   | `cases/04-remont-63`                      | 63 m² flat, rynek wtórny, full remodel incl. łazienka + WC; old scan with printed m², 8 photos, scope list cut at „Montaż […]”                                                                                                                                                                                                                                                                             | **#189 production** (szablon #166; #185 in the trash) | AI przedmiar **102 354,06 zł**, 67 rows, 1 added                                                                                                                                                                                                                                                                                                                                                       | No                                                                                                                           |
| 5   | `cases/05-ursynow-61m2`                   | 61 m² flat, stan deweloperski; brief PDF with a rzut, scope list and visualisations, the working project still to come                                                                                                                                                                                                                                                                                     | **#190 production** (szablon #166)                    | AI przedmiar **90 130,36 zł**, 113 rows, 4 at 0 zł; the flat 86 740 + optional bedroom AC 3 390 (own sekcja)                                                                                                                                                                                                                                                                                           | No                                                                                                                           |
| 6   | `cases/06-remont-45m2`                    | 45 m² flat, kapitalny remont, one-sentence mail; full vector technical project (A.04–A.10), height printed (2,65 m)                                                                                                                                                                                                                                                                                        | **#191 production** (szablon #166)                    | AI przedmiar **105 079,14 zł**, 103 rows, 2 at 0 zł; floors follow the floor plan, not the room schedule (all mikrocement ≈ +14,9 tys. zł)                                                                                                                                                                                                                                                             | No                                                                                                                           |
| 7   | `cases/07-zakamarki-dwupoziomowe`         | Two-level flat with an antresola, rynek wtórny; architect's mail + 9 raster working drawings with **no room dimensions** (scale taken from the stairs), visualisations                                                                                                                                                                                                                                     | **Owner's #207 production** (szablon #166)            | AI przedmiar **117 186,83 zł**, 97 rows, 0 added; panels only on the antresola (whole piętro + bedrooms ≈ +6,1 tys. zł), no full gładź under the structural paint (+9,1 tys. zł)                                                                                                                                                                                                                       | No                                                                                                                           |
| 8   | `cases/08-dom-parter-pietro`              | Two-level house (parter + piętro); interior designer's drawing sets with printed dimensions and areas, no mail                                                                                                                                                                                                                                                                                             | **Owner's #198 production** (szablon #166)            | AI przedmiar **166 628,82 zł**, 86 rows, 0 added; round 2 (15.10, bathrooms split into 3 sekcje): **170 344,82 zł**; walls assumed smooth (full gładź ≈ +11,6 tys. zł), bruzdy el. 200 mb in soft material (żelbet ≈ +4 tys. zł)                                                                                                                                                                       | No                                                                                                                           |
| 9   | `cases/09-piastow-48m2`                   | 48 m² flat, rynek wtórny, 1st floor without a lift, partial remodel; scope mail, a photo of the 2001 rzut with printed m² and handwritten inner dimensions, 5 photos                                                                                                                                                                                                                                       | **#199 production** (szablon #166)                    | AI przedmiar **38 500,59 zł**, 58 rows, 2 added (1 at 0 zł); no full gładź (+12,0 tys. zł), the demolished ścianka read as the 2,28 mb kitchen-zone partition in soft material                                                                                                                                                                                                                         | No                                                                                                                           |
| 10  | `cases/10-projekt-3601`                   | ~59 m² flat, stan deweloperski; the design firm's kosztorys wykonawczy **with quantities** + full vector projekt A.00–A.09 with dimensions + 12 visualisations; mail: Murso panels → spiek kamienny                                                                                                                                                                                                        | **#201 production** (szablon #166)                    | AI przedmiar **90 961,72 zł**, 104 rows, 12 added (7 at katalog prices, 5 at 0 zł); spiek 10,35 m² at 550 zł ≈ 5,7 tys. zł, gładź Q3 (Q4 ≈ +2,9 tys. zł), LED as plain tape (podtynkowe profile ≈ +2,6 tys. zł)                                                                                                                                                                                        | No                                                                                                                           |
| 11  | `cases/11-salon-fryzjerski`               | Hair salon (lokal usługowy) refresh; **no files** — only the scope the owner typed into Notatki (one door, two lump sums, no areas)                                                                                                                                                                                                                                                                        | **Owner's #200 production** (szablon #166)            | Selection only: 21 rows, 6 quantified, **15 selected at qty 0** („Praca wybrana, ilość nieznana”), 4 added (2 Notatki lump sums, gres na stopniach from the katalog, sprzątanie unpriced). AI przedmiar **3 080,00 zł** covers the quantified rows only; every 10 m² of floor ≈ +3,8 tys. zł                                                                                                           | No                                                                                                                           |
| 12  | `cases/12-dwa-pokoje-parkiet`             | Two rooms (≈ 20 + 8 m²) in a partly renovated flat, rynek wtórny, outside Warsaw; **no files** — only the scope the owner typed into Notatki (floor areas, a 5 m² GK wall, 3 points, one lump sum; no wall areas)                                                                                                                                                                                          | **Owner's #202 production** (szablon #166)            | Selection only: 26 rows, 17 quantified, **9 selected at qty 0** (walls: zdzieranie, gładź, grunt, malowanie; ceilings, listwy, GK joints, gniazdka), 1 added (the Notatki 1 500 zł tile lump sum). AI przedmiar **18 985,00 zł** covers the quantified rows only; every 10 m² of wall ≈ +1,6 tys. zł                                                                                                   | No                                                                                                                           |
| 13  | `cases/13-segment-deweloperski`           | Two-level segment, stan deweloperski; a generic deweloperski scope in Notatki (5 new electrical points the only quantity) + two phone photos of the developer's rzuty of a two-lokal building with printed m² and window sizes, no dimensions or height (sides scaled from the printed m²)                                                                                                                 | **Owner's #203 production** (szablon #166)            | AI przedmiar **76 268,74 zł** for one lokal (72,81 m²), 54 rows, 1 added (sprzątanie, unpriced); both lokale ×2 (+76,3 tys. zł), tiles to the ceiling (to 2,0 m ≈ −1,6 tys. zł), vinyl where the rzut says terakota (gres ≈ +1,0 tys. zł)                                                                                                                                                              | No                                                                                                                           |
| 14  | `cases/14-lazienka-gladz-60m2`            | One bathroom (3,46 m², 60×120 tiles to the ceiling, linear drain with a koperta, suspended LED ceiling over the shower) plus one coat of gładź on ~60 m² of walls, new flat from a developer; client's mail + the designer's raster bathroom set (tile layout, wall elevations, ceiling, plumbing and electrical plans) with printed dimensions, 4 visualisations; electrics and furniture done separately | **#204 production** (szablon #166)                    | AI przedmiar **29 266,88 zł**, 36 rows, 0 added, 0 at qty 0; gładź at the 2-coat Q3 price though the client wants one coat (−600 zł per −10 zł/m²), walls flat with no wyrównanie (+1,4 tys. zł), zabezpieczenia on the whole ~60 m² flat (empty flat ≈ −1,2 tys. zł), painting not asked (≈ +1,3 tys. zł)                                                                                             | No                                                                                                                           |
| 15  | `cases/15-dwa-pietra-dwie-lazienki`       | Two-level flat, stan deweloperski (assumed); the owner's scope in Notatki + one upside-down phone photo of the developer's sales plan with printed m² for most rooms, no dimensions or height (hols and WC scaled from the labelled rooms)                                                                                                                                                                 | **Owner's #205 production** (szablon #166)            | AI przedmiar **85 789,86 zł**, 59 rows, 1 added (RTV panel, katalog #756), 2 at qty 0 (sztukateria); the WC read as the second bathroom with a shower (without it ≈ −5,6 tys. zł), no ceilings (stretched, from the seller; painting them ≈ +4,4 tys. zł), no full gładź (+12,9 tys. zł)                                                                                                               | No                                                                                                                           |
| 16  | `cases/16-trzy-pokoje-lazienka`           | Unfinished attic (poddasze) of a house: suspended GK ceiling with wool + foil, 3 rooms + small wardrobe, a ~4 m² bathroom, gładzie, painting, ~30 electrical points; the owner's scope in Notatki + a phone photo of the poddasze rzut with printed m² only (scale from the printed areas) and one interior photo (knee wall, pitch, roof windows); no layout of the new rooms                             | **Owner's #206 production** (szablon #166)            | AI przedmiar **86 643,41 zł**, 46 rows, 2 added (the suspended ceiling with wool + foil at the Notatki's 300 zł/m², 90,83 m² = 27,2 tys. zł; glify from the katalog), 0 at qty 0; katalog breakdown 245 zł/m² (≈ −5,0 tys. zł), raw-brick walls needing a tynk base (+2,4 to +8,4 tys. zł), the guessed GK layout (±4,1 tys. zł per 5 mb)                                                              | No                                                                                                                           |
| 17  | `cases/17-kawalerka-29m2-sciana-gk`       | 29 m² kawalerka; 3 vector architect PDFs, a new GK wall + the client's ready-made ażurowa wall; the plan marking where both stand is not among the files                                                                                                                                                                                                                                                   | **#209 production** (szablon #166)                    | AI przedmiar **32 757,67 zł**, 52 rows, 1 added (the ażurowa wall, unpriced — nearest katalog: lamele 150 zł/m²)                                                                                                                                                                                                                                                                                       | No                                                                                                                           |
| 18  | `cases/18-szaserow-dwie-lazienki-kuchnia` | Two bathrooms + kitchen, rynek wtórny; 5 raster rzuty with printed areas, the small bathroom's first digit hidden („?,33 m²”, read as 3,33)                                                                                                                                                                                                                                                                | **#212 production** (szablon #166)                    | AI przedmiar **39 687,49 zł**, 86 rows, 8 at qty 0 (client's own work, unknowns, shower variant B), 1 added (gładź rynek wtórny); „Łazienka” → „Łazienka duża” + „Łazienka mała”                                                                                                                                                                                                                       | No                                                                                                                           |
| 19  | `cases/19-dom-lazienki-wc-pralnia`        | House: 2 bathrooms, a pralnia with a shower, WC in the piwnica; the client's 4 PDF room projects + 4 photos                                                                                                                                                                                                                                                                                                | **#213 production** (szablon #166)                    | AI przedmiar **74 197,28 zł**, 143 rows, 1 at qty 0 (wod-kan relocation), 4 added (new ceiling plaster per room); 4 bathroom sekcje, the pralnia counted as one                                                                                                                                                                                                                                        | No                                                                                                                           |
| 20  | `cases/20-lazienka-parter-wc`             | Ground-floor bathroom + WC; 5 files marked „Do analizy AI” (WC rzut, 4 bathroom views) + 13 from before the marker (bathroom rzut, renders, photos)                                                                                                                                                                                                                                                        | **#214 production** (szablon #166)                    | AI przedmiar **57 573,24 zł**, 68 rows, 16 at qty 0 (biały montaż excluded, stelaże already built, doors, stolarz's szafki and blat), 3 added (szlifowanie mleczka ×2, Laminam fronts unpriced)                                                                                                                                                                                                        | No                                                                                                                           |
| 21  | `cases/21-wyburzenie-sciany-pralnia-wc`   | ~61 m² flat, stan deweloperski assumed: wall salon/pokój 3 demolished, new GK pralnia (floor tiles + lighting only), toilet → bathroom with walk-in; 1 projekt PDF (target state only) + 29 renders                                                                                                                                                                                                        | **#217 production** (szablon #166)                    | AI przedmiar **93 194,94 zł**, 107 rows, 2 at qty 0 (stone backsplash, optional przedścianka), 3 added (lamele 150 zł/m², szlifowanie mleczka in Łazienka, GK przedścianka at 0). The reseed writes the katalog wording for the gruz/kontener rows while DRY matches szablon #166's older wording — the kontener row loaded as a duplicate and was moved onto the szablon row by hand; rozpiska synced | No                                                                                                                           |
| 22  | `cases/22-marki-66m2`                     | ~66 m² flat, the client's zakres prac (PDF) + a rzut PDF, both marked „Do analizy AI”                                                                                                                                                                                                                                                                                                                      | **#219 production** (szablon #166)                    | AI przedmiar **54 363,06 zł** after review (draft 53 995,08), 66 rows, 6 at qty 0, 3 moved into Łazienka; first case with a separate reviewer (`review.md`)                                                                                                                                                                                                                                            | No                                                                                                                           |
| 23  | `cases/23-odebrane-projekt-architekta`    | Flat received from the developer, the architect's projekt PDF + visualisations; both unmarked at adopt time, downloaded by hand, marked by the owner after the draft                                                                                                                                                                                                                                       | **#218 production** (szablon #166)                    | AI przedmiar **69 100,39 zł** after review (draft 69 113,14), 105 rows, 3 at qty 0, 9 added; reviewed (`review.md`)                                                                                                                                                                                                                                                                                    | No                                                                                                                           |

## Research log

### 2026-10-01 — case 1, round 2: measure instead of estimate

Every quantity that v1 estimated from room m² was re-derived from the drawings, and the two runs were
compared position by position. The full table is in `cases/01-bemowo-125m2/measurement.md`.

- **Net effect −14 057 zł (−6,5%)** on 21 positions. Deltas go both ways, from −70% to +74%.
  v1 was not biased. It was noisy, and the noise happened to net to −6,5%.
- **Geometry was the small error.** Room areas measured from the vectors land within 1–5% of the m²
  printed on the plan.
- **The big errors came from four other places, none of them geometric:**
  1. **Legend misread (−4,4 tys. zł, the largest single cause).** v1 put limewash where drawing 11 says
     a plain colour paint, so the same ~210 m² moved from 100 zł/m² to 26 zł/m².
  2. **Scope:** drawing 11 marks every wall to finish with a colour band. The bands total 108 mb
     against 151 mb of dry-room perimeter, because walls behind kitchen units and some wardrobes
     get nothing. Gładzie dropped 290 → 250 m² for that reason, not because of the perimeters.
  3. **Shopping list ≠ laid area:** wallpaper 72 → 51 m², large tiles 29,5 → 24,2, 120×278 slabs
     6,7 → 3,9. A purchase includes cut waste and pattern repeat, while Przedmiar is the laid area.
  4. **Lengths guessed from room widths:** karnisze 19,2 → 5,8 mb (only 5,8 is drawn), listwy 80 → 66,4.
- **Missed scope:** the large bathroom's walls above the tiles (limewash with Aqua Ceramic,
  14,4 m²) were "≈ 6" in v1. That moved 41659 by +74%.

What worked on a vector projekt PDF (gcad export, empty text layer):

| Quantity                              | Method                                                                                                                             | Validated against                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Scale                                 | calibrate drawing units on one dimension label (here 0,25 cm/unit); the plan drawings share one coordinate system                  | dimension labels                                    |
| Room area + perimeter                 | rasterise **only** the wall layer (thickest stroke), the new-wall fill and straight door-frame segments, then flood-fill each room | printed room m²: −1…−5%                             |
| Lengths (listwy, karnisz, maskownice) | SVG paths by legend colour, summed                                                                                                 | nothing printed to check against                    |
| Wall finish per room                  | filled bands by legend colour; band centreline from area and perimeter; room by overlap with the room mask                         | band total < perimeter, consistent with the drawing |
| Wall m²                               | band length × room height (Hpom) − windows (width measured, hp/ho read) + strip above doors                                        | —                                                   |

What did not work:

- Flood fill over **all** strokes: door arcs and furniture cut the rooms, giving 2–14% short.
  Layers must be filtered by stroke width first.
- Tile layouts on the wall elevations (pages 14–21) are embedded raster images, not vectors, so
  they can't be measured from the vector layer. The colour plan's bands × height replaced them.
- Assigning an L-shaped band to a room by its centroid: the centroid sits elsewhere. Use overlap.

### 2026-10-01 — case 1, round 3: katalog check, write into the app

- **The katalog prac was not consulted in v1, and that was a procedure gap.** The szablon is a
  ~310-position subset, while the katalog has 561 entries, 255 of them outside the szablon.
  Of the six works missing from the szablon, the katalog covers one: „Skucie glifu przy oknie”
  (mb, 70 zł) for podkucie ościeży, giving 5,2 mb = 364 zł against v1's invented 400 zł kpl.

  Luksfery, siedzisko G-K, koordynacja, sprzątanie and limewash are absent. For a large glued mirror
  the katalog only has hanging-mirror mounting at 120 zł. In this run the agent still invented
  prices for 3 of the 5 (luksfery, siedzisko, lustro: 5 400 zł in the total). **The owner then ruled
  that the agent never invents a price**: procedure rule 9.
  Detail: `cases/01-bemowo-125m2/measurement.md`.

- **Written into the app.** #167 now has:
  - 127 positions with Przedmiar;
  - every one carries its source in Komentarz;
  - Wartość netto przedmiar 203 764 zł (first written at 209 164 zł with the invented prices, then zeroed);
  - the assumptions and 15 questions to the client in the investment notes.

  Matching szablon rows to the investment's items needed section + description, because seeding gives
  every item a new id. An agent writing directly would get the ids from the kosztorys it reads, so
  this is a test-harness detail, not a product problem.

- **On production as #168** (same 316 positions, 127 with Przedmiar, 203 764 zł, 5 PDFs, notes).
  A per-case script (since generalized into `scripts/new-case-prod.ts` + `scripts/fill-case-prod.ts`)
  drove the deployed app over HTTP with a user's session — the server actions
  the browser calls (ids read from the deployed client chunks) and the browser→Blob upload — so
  permissions, the investment lock and cache revalidation all apply, and nothing touches the database
  directly. Two traps: production runs `main`, not `staging`, so an action's signature must be read
  from `origin/main` (`addItemAction` there takes a bare `sectionId` and adds a blank row); and the
  Blob SDK's `upload()` refuses to run outside a browser, so the token request and `put` are spelled
  out.

### 2026-10-05 — case 1, round 4: against the owner's kosztorys

The owner priced the same client in #175 („Wycena bez wizyty”, same documents). Full analysis:
`cases/01-bemowo-125m2/owner-comparison.md`; snapshot and script under `owner/` and
`scripts/compare-owner.py`.

- **Total −4,2% is luck.** Shared positions carry 35,8 tys. zł of absolute error; 57 AI-only and 41
  owner-only positions nearly cancel. Of the positions carrying 80% of the owner's value the AI has
  the same position in 64%, and the same work under another position in ≈ 88%.
- **Geometry held.** Wall finish layer 256,5 vs 253 m², ceilings 115 vs 112, wallpaper 50,6 vs 50,
  karnisze 5,8 = 5,8. The v2 measurement moved 16 of 19 comparable positions toward the owner.
- **The money is in trade knowledge and position choice:** szlifowanie mleczka (a szablon position
  the agent skipped), tynk na listwach, masonry vs G-K partitions, tile detailing from the raster
  elevations (shelves, glify, 45° edges), whole-bathroom waterproofing; one primer not two; rozdzielnia
  as kpl; no AGD / osprzęt / doors.
- **Counts are not safe either:** the owner counts more points everywhere (c.o. 8 → 16, wod-kan
  14 → 20, electrical 83 → 98). What a „punkt” is, is a house convention.

### 2026-10-07 — case 1, round 5: the AI kosztorys as AI przedmiar in the owner's

To see the case in „Przegląd AI” (EX-1006), #168's Przedmiar went into the owner's #175 as AI
przedmiar — the shape the review is built for: the agent proposes, the owner's numbers are the
verdict. **Local DB only**; staging has neither investment (its ids 168/175 are other investments).

- `src/scripts/load-ai-draft.ts` (local DB only, refuses any other host) takes a draft
  `[{ section, description, qty, unit?, clientPrice? }]`. A row matching a pozycja by sekcja + opis
  (folded like the sheet import) sets its AI przedmiar; every other pozycja gets 0 (the agent left it
  out); a row matching no pozycja is a praca the agent added and becomes a new pozycja in its sekcja
  with Przedmiar 0, carrying the draft's j.m. and Cena j.m. Status and Powód zmiany are never written.
- Draft from the AI kosztorys, then load:

  ```bash
  source .env && psql "$DB_POSTGRES_URL" -Atc "select json_agg(json_build_object('section', s.name,
    'description', i.description, 'qty', i.planned_qty, 'unit', i.unit, 'clientPrice', i.client_price))
    from kosztorys_items i join kosztorys_sections s on s.id = i.section_id
    where i.investment_id = 168 and i.planned_qty > 0" > /tmp/ai-draft-168.json
  INV=175 DRAFT=/tmp/ai-draft-168.json node --env-file=.env --conditions=react-server --import tsx src/scripts/load-ai-draft.ts
  ```

- Result: 116 of 127 AI positions matched; 11 added — 5 works outside the szablon at 0 zł (siedzisko
  G-K, luksfery, lustro, przedścianka z półką, glif) and 6 the owner holds under another name
  (limewash vs beton, glazura „mały format”, podejścia „i wód”, sprzątanie, koordynacja, gres
  cegiełki), which now sit beside their counterpart for the owner to reject or take.
- The script skips cache revalidation; restart dev if the AI columns show empty.

### 2026-10-08 — first house knowledge in the katalog prac

Prod dump `wykonczymy-backup-20261008-110841`: **18 of 568 katalog entries carry a Komentarz do
pracy**, all written 2026-10-08 (EX-1006's loop). Nothing else in the dump teaches the agent: no
Powód zmiany anywhere, and outside case 1's own #168 the only Komentarz on a pozycja longer than a
„+" is one „cena do ustalenia" in #175. The local DB carries them too since it was restored from
that dump (2026-10-08).

Several close gaps this experiment logged as the agent's largest misses:

- **What a „punkt" is** (#178 wod-kan): every end point counts zimna + ciepła + kanalizacja, so a
  umywalka is 3. That is the house convention behind the owner's higher point counts in case 1
  (wod-kan 14 → 20).
- **Bruzdy no longer a guess** (#840): ≈ 2,5 mb per electrical or lighting point; #837 wod-kan
  bruzda is a per-bathroom estimate.
- **Derived quantities:** fugowanie = the m² of płytki (#172); dwukrotne gruntowanie in a łazienka =
  floor + ceiling + walls (#169); skuwanie glazury = mb of wall × tile height (#890), and it always
  brings szlifowanie po kleju with it (#905, #944).
- **Lump sums by job size:** transport and wniesienie (#689) 700 zł (łazienka, rynek pierwotny) →
  1 000 (łazienka, wtórny) → 1 500 (small flat) → 2 000 (wtórny or large deweloperskie with
  changes) → 2 500 (high floor, no lift); demontaże (#947) 800–1 500 zł; gruz ≈ 2 big bagi per
  łazienka (#677).
- **Scope rules:** zabezpieczenia are floor m², and a łazienka in a lived-in flat still protects the
  whole path to it (#930); akrylowanie is the tile-to-ceiling/wall joint (#158).

The agent's procedure must read these notes (they are per katalog entry, matched to a pozycja by
opis + j.m.) before choosing a position or a quantity.

**The investment notes carry more, written to the agent directly.** Of the last seven investments
created on prod (#176–#182), two have notes; the rest are empty. #180 (Oliwa, case 2) holds a
„notatka dla agentka”, and #181 (Jakubczak, a bathroom on the rynek wtórny) the owner's verdict on
an AI draft. Rules the katalog notes don't already state:

- **Otwory w glazurze, counted per fixture:**
  - wc: 5 (przycisk + 2 śruby + kanalizacja + dopływ);
  - prysznic: 2–3 for a podtynkowa bateria (depends on the model), 2 for a natynkowa;
  - umywalka with a podtynkowa bateria: 3 (2 + odpływ);
  - grzejnik: 2 (zasilanie + powrót);
  - one per electrical box, typically 2 by the lustro (włącznik + gniazdko), plus 1 for the pralka
    if the project has one in the łazienka;
  - kratka wentylacyjna: 1.

  The case 2 łazienka came to 17.

- **Glazura:** wall m² = wall tiles, floor m² = floor tiles. Fugowanie and folia w płynie are the sum
  of all tiles, always. Taśma hydroizolacyjna runs round the floor plus the wet-zone corners,
  ≈ 15 mb for a 4 m² łazienka. Silikonowanie ≈ 20–30 mb per łazienka.
- **Malowanie in a łazienka** is only the walls without tiles: check per wall, then count malowanie
  z gładzią.
- **Szlifowanie płytek na 45°** comes from the project: every outside corner (e.g. a pion) is its
  height × 2, plus zabudowy (the box for a podtynkowa bateria, a półka z LED). In case 2 this added
  ≈ 10 mb. When unsure, don't overshoot; mark it for verification instead.
- **Gładź** excludes the walls behind the kitchen units.
- **Bruzdy wod-kan** for one łazienka: ≈ 2 mb (#181).
- **Demontaże** are judged by the amount of work: 700 zł for wc + prysznic + umywalka + drzwi was right
  in #181.
- **A painted wall above old tiles** has to be stripped before new tiles go on, which is a separate
  pozycja.
- **Moving a door opening with its nadproże** is expensive, and the price has to reflect it.
- **Clear height when the drawing doesn't print one** (owner, 2026-10-08): **2,68 m** in stan
  deweloperski, **2,60 m** on the rynek wtórny. A printed Hpom always wins. Komentarz names which of
  the two was used.

**These rules now live in the Manual („Manual Wykończymy”)** (EX-1032, seeded by migration `20261008_3`), which
management edits in the app; where the list above and the book differ, the book wins.

These are general rules, not case numbers, so they belong in the procedure (and, per entry, in the
katalog's Komentarz do pracy). Case 2's draft had #180's note as input (`cases/02-oliwa/inputs/`),
so it is not a blind run on these rules.

### 2026-10-08 — case 3: a new-build segment with two separately priced blocks

`cases/03-nowe-lipiny-i2`, local #183. The case took **23 min** (15:25 → 15:48) from the request to the loaded
kosztorys with notes. That includes rebuilding #183–#186: someone restored the local DB from the
11:08 dump mid-session and wiped the earlier #182–#185. Detail: `measurement.md` and
`investment-notes-appendix.txt`.

What was new compared with cases 1–2:

- **The plan prints room m²**, so the floors and ceilings are read, not measured, and they add up to
  Pu exactly. Perimeters are the weak point: they come from area ÷ a printed side. The open-plan L
  (salon z kuchnią) is a guess at 31 mb.
- **The client wants blocks priced separately** (poddasze, rekuperacja). `load-ai-draft.ts` skips a
  row whose sekcja is missing, so `scripts/prepare-case-local.ts` adds the sekcje first. Two own
  sekcje keep both subtotals readable in the editor and out of the house total. This is the shape
  to reuse whenever an inquiry says „proszę wycenić osobno".
- **Visualisations are for counting elements only** (wnęki LED, lustra, wpusty, oprawy schodowe,
  tapeta). They are inspiration, and the client says so.
- **The katalog runs out on new-build finishing:**
  - mikrocement on walls;
  - wooden cladding of concrete stairs;
  - balustrada;
  - GK on skosy;
  - centrala rekuperacji.

  Each is a 0 zł row with the nearest katalog entry in Komentarz.

  Where the katalog names the same operation under another heading, its price was used:
  - wełna between rafters = „Układanie wełny w ścianach”;
  - kanały = „Montaż wentylacji”;
  - the WC niche = „Wykuwanie wnęki pod półeczkę + GK”.

  That is a judgement call the owner should confirm.

- **One unknown dominates:** the developer's tynki. Gipsowe would drop the gładź, about −18 300 zł.
- **The client's mikrocement vs winyl question is a 43 646 zł swing**, more than a third of the house
  total. The notes put it first.
- **The strych's printed 32,38 m² is not its floor.** It is most likely the height-weighted usable
  area, while the outline gives ≈ 59 m². Without a section drawing, the poddasze block is an order of
  magnitude only.

Not evaluated: there is no owner kosztorys for this client yet.

**On production as #183** (the id matches local #183 by chance):

- 336 positions: 302 from szablon #166 plus 34 added;
- AI przedmiar on 94 rows, Przedmiar empty;
- 14 files and notes;
- AI przedmiar total 163 759,56 zł.

Szablon #165 had gone to the kosz that morning, so the create's seed only warned and the kosztorys
was empty. It was then reloaded from #166, where the 60 matched rows are the same and the only price
change is big bag 600 → 450 zł. The notes carry the production figures.

### 2026-10-08 — case 4: the first case under „agent nie zakłada”

`cases/04-remont-63`, **production #185**. The case took **18 min** (16:44 → 17:02) from „no to dawaj” to
the verified kosztorys. The 18 min break down as:

- ≈ 9 min reading the plan and photos and building the first draft;
- ≈ 3 min loading it;
- ≈ 6 min applying the new rule mid-case: rebuilding the draft, rewriting the notes and reloading.

The inquiry was pasted twice, and was cut at „Montaż […]” both times.

**The rule change halved the offer.** The draft with assumptions was 103 138 zł. Without them it is
37 203 zł: −66 %. Almost everything that left needs one figure the scan does not print, the **wall
height**:

- gładź z siatką;
- malowanie ścian;
- ściany GK;
- glazura;
- skuwanie;
- wyburzenia.

So for a rynek wtórny scan without H, the agent's honest output is the installations, the armatura,
the floors and the ceilings, plus a question list. The figure that unlocks the rest is the first
question to the client.

**Reanalysis with the house height** (17:12 → 17:17, 5 min). Right after the case, the owner set the
house clear heights (2,68 / 2,60). With H = 2,60, the draft takes:

- the dry-room walls brutto: the perimeters come from the printed sides, or from m² ÷ the printed side;
- gładź z siatką, malowanie ścian and akryle on those walls;
- wyburzenia;
- the old łazienka's skuwanie, since the photo shows tiles to the ceiling.

It now stands at **70 775 zł / 45 rows**. Three things still block, and they are layout facts, not
heights:

- the przedpokój prints no sides;
- the window and door heights are not printed;
- the new łazienka wall and the new tile heights are not given.

Together they keep the whole łazienka/WC tiling block and both GK walls out.

Re-reading the scan at 2× corrected two first-pass readings:

- the łazienka is 1,70 × 1,79, not 1,40 × 2,14;
- the kuchnia is 4,5 m², not 4,6.

The pokój 11,8 keeps its perimeter whichever way the łazienka grows into it, because the extension
is a corner notch.

The two-pass load showed that `load-ai-draft.ts` resets AI przedmiar to 0 on every row the draft drops,
so tightening a draft is a plain reload. The row it added on the first pass (sprzątanie) matches on the
second.

Not evaluated: there is no owner kosztorys for this client yet.

### 2026-10-14 — #190 round 2: the first later round (pilot of the runbook)

Input: the architect's executive projekt (18 sheets, A3; the plans are 1:50 and the łazienka 1:25),
a client example image of the blat, and a new mail. Steps 1–2 of the runbook (`round-case-prod.ts`,
`dump-knowledge-prod.ts`) ran without trouble. Problems with the AI kosztorys found while working,
written down as they come up:

- **An executive projekt is drawings only, with no text in it.** Every dimension, symbol and legend
  has to be read off the rendered sheets, room by room. That makes it the slowest input a round
  gets, and the least exact: plan dimensions are reliable, while counts are not (see below).
- **Round 1's main assumptions were wrong, and the projekt overturns them:**
  - the new walls are built of cegła silikatowa (12 cm = 10 + 2 × 1 cm tynk, 10 = 8 + tynk), not GK;
  - both new openings are drawn „otwór bez nadproża”;
  - the łazienka is gres 120×120 on the floor and most walls, plus 60×120 on one wall, not „standard”;
  - only part of the door wall is tiled.
    So a round can move whole groups of pozycje, not single quantities: the GK → murowanie switch alone
    touches the GK walls, taśmy, tynkowanie, gładź and narożniki.
- **Round 1's Komentarz AI still states the old geometry, and it is frozen by design** („łazienka
  powiększona o ok. 0,5 m…, 1,61 × 3,24”). The owner reads it next to the new block, so each „Nowe
  informacje” has to say plainly which number the projekt replaces. The two texts contradict each other on
  purpose, and the newer one wins.
- **The catalogue has no pozycja for cegła silikatowa.** The nearest is „Murowanie ścian z bloczków
  komórkowych 10 / 7,5 cm”. Mapping onto it is a „Założono” for the owner to check, not a fact.
- **Symbol counts are approximate.** Gniazda, lampy and włączniki come from counting plan symbols at 150 dpi.
  A double symbol and a single one are easy to confuse. Counts go into „Założono” with the room
  breakdown, so the owner can check them against the sheet.
- **The round-1 totals in „Uwagi AI” go stale even without new information.** Since round 1 the owner
  has changed prices in the kosztorys: jednostka klimatyzacji went from 0 to 2 500, listwy podtynkowe
  got 100 zł/mb, sprzątanie 1 000. So round-1 AI przedmiar × today's prices is 103 030 zł, not the
  90 130 zł Uwagi AI say. A round has to recompute every figure in Uwagi AI from `kosztorys.txt`,
  and has to state both totals, before and after the round, at today's prices.
- **A round has to borrow a pozycja across sekcje.** Gres 120×120 on the ściana TV has a catalogue
  pozycja only in „Łazienka”. The round adds it to „Ściany i sufity” as a new pozycja with the
  łazienka price. That is a „Dopisane z katalogu” entry, not a fact the projekt states.
- **A round can open double counts that round 1 hid.** Once the shower przedścianka is a murowana
  ścianka in the projekt, the murowanie m² and the kpl „Wykonanie przedścianki pod prysznicem z 2
  półkami” may cover the same work. The round leaves both and asks in „Nie wiadomo” and in Uwagi AI.
- **The joinery boundary moves with the projekt.** It draws a szafka nad geberitem that round 1 did
  not know about. The client says joinery is a separate order. A round should not quietly add its
  montaż, so it asks instead.
- **The projekt contradicts the brief on material, and the round does not switch it.** Next to the
  łazienka door the projekt notes the join between „gres i drewno”, while the brief and round 1 say
  winyl jodełka. Moving 57 m² to parkiet on one word is too weak a source, so the round asks in
  Uwagi AI and gives the price difference.
- **Draft size: 26 pozycje changed, 1 of them new.** 18 of the 26 were „Zaakceptowana” by the owner,
  so after loading the owner has 18 reviewed pozycje to re-check. This is the flag doing its job, and it is
  also the measure of what a projekt round costs the owner.
- **In a round, the scripts' „expected AI przedmiar” is not the kosztorys total.** `fill-case-prod.ts`
  and `load-draft-sql-prod.ts` both print 23 700,05 zł. That is Σ qty × cena over the 26 draft rows only,
  because in round 1 the draft was the whole kosztorys and the two meant the same thing. The check
  that counts in a round is the total `touch-kosztorys-prod.ts` reads back after loading. It has to
  equal the „po rundzie” total in Uwagi AI over every sekcja, the option included: 107 663,41 zł.
  Production read back exactly that after the load: 116 pozycje, 26 flagged, 26 with one „Runda 2” block.
- **„Nowe informacje” rendered raw, unlike Komentarz AI next to it** (owner, first look at #190). The
  cell printed the stored text as-is, while Komentarz AI shows a plain label with a bold answer. The
  two columns now share one renderer, so they look the same and can't drift apart. The „Do ponownego
  sprawdzenia” flag above Status was bare amber text, and is now a small badge in the app's `pending` tone.

### 2026-10-15 — #198 round 2: split the bathrooms, no new files

The trigger was the owner's Notatki („przeliczy same łazienki jeszcze raz i podzieli”) and a Powód
zmiany on „Montaż geberitu” („połączone dwie łazienki”). Round 1 (12.10) predates the per-bathroom rule,
so it counted all three rooms in one „Łazienka”. The round re-reads the same drawings. Findings:

- **The split alone changes no money. The Manual is what does.** Since round 1 the Manual gained
  „dodajemy do sekcji łazienka” and per-bathroom counts for wiercenie, zawory, biały montaż, szlif
  over the stelaż, silikon and gruntowanie („łazienki robimy osobno”). The first draft only split the
  rows and missed all of it. It took a review against the regenerated `manual-i-komentarze-do-prac.md`
  to add +3 640 zł of work round 1 never counted. **A round re-reads the Manual, not just the new
  inputs:** it can have changed under a round-1 draft.
- **„Into the bathroom” moves rows out of other sekcje.** The GK ceiling, the wallpaper and bathroom
  floor primer were booked in „Ściany i sufity bez łazienek” and „Podłogi”. The round zeroes them
  there and adds them in the bathroom. The owner's accepted Przedmiar stays in the old sekcja, so
  Uwagi AI lists it as „do przeniesienia”. Painting the untiled walls in the bathroom with the bath
  stays where it was: the ceiling drawing does not separate that room from 28,17 m².
- **The rename needed a guard.** From round 2 on, `fill-case-prod.ts` renames „Łazienka” only while it
  is still the kosztorys's one bathroom sekcja, so it never overwrites a name the owner gave.
  `isBathroomSection` has to run on names, not on `sectionKey`: the key folds „ł” away.
- Loaded: 70 updated, 5 new, all 75 flagged. The read-back total is 170 344,82 zł (round 1 at today's
  prices: 166 275,72), and it matches Uwagi AI per sekcja. The scripts' „expected” 51 556,20 zł is again
  the draft rows only (see #190). `touch-kosztorys-prod.ts` takes `INVESTMENT` from the env, not
  from argv.

### 2026-10-15 — #218 / #219: a separate reviewer after the drafter

Each case got one drafting agent, then a fresh agent that only reviews. The reviewer checks every
Manual rule and Komentarz, the scope, „both places” (the appendix and the pozycja), the bathroom
sekcja, the arithmetic and the text. It fixes what it is sure of, asks the client about the rest, and
writes `review.md` with one box per finding. The drafter's output is frozen first as
`measure/ai-draft-pre-review.json` + `measure/investment-notes-appendix-pre-review.txt`. Only the
reviewed version is loaded; the owner reviews one version, as before.

- #219: 17 fixed, 1 asked, 8 dismissed. 6 were a missed rule, 5 both places, 5 arithmetic, 1 text.
  +367,98 zł.
- #218: 6 fixed, 1 asked, 16 dismissed. −12,75 zł.
- The owner's first read (2026-10-15) is that the reviewer helps: what it catches is mostly missed
  company knowledge (Manual / Komentarze), not measuring.

**How to measure it once the owner has reviewed both**, with the owner's final Przedmiar as the
reference: the share of pozycje accepted as they were, Σ|AI − Przedmiar| × cena for the pre-review
and the reviewed draft, the rows the owner had to add, and the Powody that repeat a rule already in
the Manual at analysis time. Bias: the owner only sees the reviewed version, so their numbers can
anchor on it, which favours the reviewer. With two cases that is accepted, not corrected.

## Reliability by quantity class (case 1, after measuring; checked against the owner 2026-10-05)

| Class                          | Example                                | Best source                                           | Observed spread v1 → v2                                                            |
| ------------------------------ | -------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Counts read from the documents | armatura, gniazda, otwory, grzejniki   | read directly                                         | armatura exact; **installation points 15–100% under the owner** (house convention) |
| Ceiling / floor areas          | sufity, podłogi                        | printed room m², read                                 | ~0% (115 estimated = 114,7 read)                                                   |
| Wall areas per finish          | gładzie, limewash, kolor, tapety       | colour plan bands × Hpom                              | −39%…+38% per position; **driven by the legend, not the geometry**                 |
| Tile surfaces                  | płytki ścienne                         | colour plan bands × height; **not** the shopping list | shopping list overstates by 15–70%                                                 |
| Lengths with their own layer   | listwy, karnisze, maskownice           | vector colour layer                                   | −17%…−70% vs guesses                                                               |
| Lengths with no layer          | bruzdy, kable, LED, Ethernet           | per point assumption                                  | not re-measured; still ±50%                                                        |
| Position choice                | which of several overlapping positions | judgment                                              | **the largest error class** vs the owner — needs house rules                       |

## Agent procedure v0 (what the prompt has to enforce)

Derived from case 1. This is the seed for the agent prompt, and each future case should confirm or
amend it.

1. **Classify the input first:**
   - vector PDF: geometry is extractable (`pdftocairo -svg`);
   - raster/scan: read only printed numbers;
   - photo: counts and surface condition only, never m² or mb;
   - shopping list: product identity, never laid area.
2. **Read before deriving; assume the rest, and write every assumption down** (owner, 2026-10-09,
   reversing 2026-10-08's „the agent does not assume”). Use a number printed on the drawing (room m²,
   Hpom, hp/ho, dimension) whenever one exists, and derive only what is not printed.

   A quantity that can be neither read nor measured is **assumed**, and the assumption goes on the
   position's „Co / ile założono” (`assumptions`): what was taken, how much, and on what basis — a
   Manual entry, a katalog Komentarz do pracy, a photo, or the agent's own estimate, named as
   such. For example, the house clear height (2,68 deweloperka / 2,60 rynek wtórny) when the drawing
   prints none, or a przedpokój perimeter when the scan prints only its m². What the inputs leave
   unknown goes in „Czego nie było wiadomo” (`missingData`). Where a quantity came from is not an
   assumption — a number read off the rzut or counted from the mail carries neither field.
   All four cases were rebuilt under this rule (2026-10-09); on production case 1 sits in the owner's #175, case 2 in the owner's #180, cases 3 and 4 in fresh #188 and #189 (same files; #168, #183 and #185 are in the trash). Cases 5 and 6 (#190, #191) were built under it from the start.

3. **Validate the instrument on a known value before trusting it.** Measure the room areas, compare
   them with the printed m², and only then use the perimeters from the same method. Above ~5%
   off, stop and fix the method.
4. **The finish plan is the scope.** On a colour/finish drawing, the legend decides the rozpiska
   position and the bands decide which walls count. Do not assume full perimeter × height.
   Map every legend entry to a rozpiska position explicitly before measuring anything.
5. **Przedmiar is laid area, never purchase quantity.** Rolls, pieces and m² on a shopping list
   carry waste. Use them only as a sanity ceiling.
6. **Never synthesise a length from room widths.** A karnisz, maskownica or listwa is either drawn
   (measure it) or it is a question to the client.
7. **Write the open questions out.** Ambiguities that move money go in "do weryfikacji" with their
   zł impact: walls behind built-ins, karnisz behind every maskownica, unlabeled window heights.
8. **Check every surface the documents mention against the drawings.** Painted bathroom walls above
   the tiles were missed in v1 because nothing forced a per-room, per-surface pass.
9. **The agent never invents a price** (owner ruling, 2026-10-01). Every Cena j.m. comes from the
   szablon or the katalog prac. A work missing from the szablon is looked up in the katalog first.
   When nothing fits, the agent adds the position with its own description and the Przedmiar, and
   **leaves Cena j.m. empty**. In „Czego nie było wiadomo” it writes „brak w katalogu — do wyceny”
   and names the nearest katalog praca, if there is one. The owner prices it, so the total is understated by
   exactly the unpriced positions, and the notes list them.

   App gap: `kosztorys_items.client_price` is `NOT NULL DEFAULT 0`, so today „empty” can only be
   stored as 0 zł, which renders as a price. **Owner ruling (2026-10-01): a missing price must be
   unmistakable, more than a 0.** 0 zł reads as a real price (a free work) and gets lost among the
   rows, so an unpriced position has to stand out in the kosztorys and in its total. That takes a
   nullable column, settlement math that treats the position as unpriced, and a visible marker on
   the row and on the total (e.g. „bez ceny: 5 pozycji”).

10. **Write into the kosztorys, not into a reply.**
    - Przedmiar goes on the position.
    - Every assumption goes in „Co / ile założono” and every unknown in „Czego nie było wiadomo” — the
      Komentarz AI column, never the people's Komentarz, which the investor may see.
    - A new position goes at the end of its section.
    - Doubts and the data still missing go to the **top** of the investment notes, above the mail.

    The notes carry the assumptions that move many positions at once (height, layout changes), so the
    manager checks those first.

## Rozpiska quirks found (affect any agent)

- **Wrong units:**
  - 41554 (zabezpieczenia) is `kpl` at 25 zł, but it prices like m².
  - 41802 (punkt LAN) is `m²`.
- **Overlapping positions, where the agent must pick one or it double-counts:**
  - electrical points appear in both „Łazienka" and „Instalacja elektryczna";
  - grzejniki appear in „Łazienka" (41672) and in „wod-kan + c.o." (41805/41808);
  - 41603 vs 41605 (gruntowanie);
  - 41629 vs 41644 (bruzdy);
  - 41595 vs 41643 (corner finish).
- **Missing positions** for case 1, after checking the katalog prac:
  - covered by the katalog: podkucie ościeży (as „Skucie glifu przy oknie”);
  - absent from the szablon and the katalog:
    - luksfery;
    - siedzisko G-K with a niche for the grzejnik;
    - large glued mirrors;
    - koordynacja / nadzór;
    - sprzątanie;
    - limewash, which was priced under the „farba strukturalna" position.

## Improvement loop (proposed 2026-10-01, not started)

The agent is not trained. What gets iterated is the procedure: the prompt, the measuring tools and
the house rules. The owner's kosztorysy are the answer key.

- **Dataset:** pairs of inputs (email + files) and the owner's kosztorys. Sources: prod investments
  that have `projekt` files and a filled Przedmiar, plus the legacy sheet dumps where the inputs can
  be found. Split them into 3–5 dev cases to iterate on and 2–3 holdout cases nobody looks at. A
  finished investment adds a second truth, Pomiar z natury (what was actually executed).
- **Scoring (a deterministic script):**
  - position recall and precision;
  - quantity error in zł (ΔPrzedmiar × Cena j.m.), which ranks what to fix;
  - error per quantity class;
  - total Δ.

  Prices are excluded, because the agent never invents one.

- **One iteration:**
  1. A blind run.
  2. Score it.
  3. Classify the top 5–10 errors in zł as one of: an agent mistake (→ procedure or tool), an
     owner's convention (→ house rules, from 15 minutes with the owner per case), an ambiguous
     input (→ a question for the client), or a rozpiska quirk.
  4. Make one change, then re-run all dev cases. Keep it only if the total improves and no case
     regresses.
- **Prompt optimization:** split the procedure into stages, each with its own prompt and its own
  scoring:
  - input classification;
  - scope → rozpiska positions;
  - measuring (tools, not prompt);
  - quantities → Przedmiar.

  Cache the expensive outputs (PDF vectors, room measurements), so a prompt change re-runs one cheap
  stage in seconds. On those stages an optimizer agent (GEPA-style reflection) proposes one change at
  a time from the traces and the top errors. Guards:
  - general rules only, with no names, numbers or addresses from a case;
  - periodic rule ablation;
  - house rules in a separate file the optimizer reads but never edits;
  - the prompt versioned with a log of which change fixed which error.

  Below ~10 cases, iterate by hand: an automatic optimizer would overfit the noise.

- **Done when,** on the holdout cases:
  - the agent hits ≥ 90% of the positions carrying 80% of the value;
  - the total is within ±10%;
  - every large discrepancy is in the notes as a question.

## Later rounds: the client sends more (decided 2026-10-14, built in EX-1057)

The usual path, not an edge case: a preliminary offer goes out, the owner reviews it, the client
answers with a projekt wykonawczy or a list of extras, and the investment gets re-quoted — possibly
several times. #190 is the first real one (stage „Nowe informacje”) and the pilot.

**What a round is made of** — the round-1 pipeline, reused:

| Part                  | Round 1 (today)                  | A later round                                          |
| --------------------- | -------------------------------- | ------------------------------------------------------ |
| New files and Notatki | `adopt-case-prod.ts`             | the same download; the round record says which are new |
| House knowledge       | `dump-knowledge-prod.ts`         | run again — it may have changed since round 1          |
| Sekcje                | `fill-case-prod.ts`              | the same, without renaming „Łazienka”                  |
| Pozycje               | `load-draft-sql-prod.ts`         | its round mode                                         |
| „Uwagi AI”            | the PATCH in `fill-case-prod.ts` | the same PATCH, the whole current state                |
| Cache + total check   | `touch-kosztorys-prod.ts`        | the same                                               |

**Runbook for round N** (every script takes `TOKEN_FILE=…`; each production write needs the user's go):

1. `CASE=<case> ROUND=N DRY=1 … round-case-prod.ts` — lists the new files and new Notatki lines;
   without `DRY` it downloads the files and writes `rounds/N/` (`notes.md`, `new-notes.md`,
   `new-files.txt`, `kosztorys.txt` — every pozycja with the owner's Przedmiar, Status and Powód
   zmiany, AI przedmiar, Komentarz AI and Nowe informacje) and the record `rounds/N.json`, all under
   `~/.local/share/wykonczymy-ai-cases/<case>/`. Read-only against production.
2. `dump-knowledge-prod.ts` — the house knowledge may have changed since the last round.
3. The agent re-measures everything from the previous reading, `kosztorys.txt` and the new
   information, and writes only the differences that have a source (below) to
   `measure/ai-draft-round-N.json`, plus the whole current „Uwagi AI” to
   `investment-notes-appendix-round-N.txt`.
4. `ROUND=N DRY=1 … fill-case-prod.ts`, then without `DRY` — sekcje a round needs, Uwagi AI. From
   round 2 it renames „Łazienka” only while it is the kosztorys's one bathroom sekcja (below).
5. `ROUND=N DRY=1 … load-draft-sql-prod.ts`, then without `DRY` on the user's go — AI przedmiar, the
   round block appended to Nowe informacje, the flag raised. It refuses a draft row without its
   „Runda N — ” block or a qty, a round already loaded, and a production that doesn't return Nowe
   informacje yet (code not deployed).
6. `INVESTMENT=<id> … touch-kosztorys-prod.ts` — cache, and the total read back.

A round-draft row is a round-1 row plus its block:

```json
{
  "section": "Salon",
  "description": "…",
  "qty": 6.4,
  "newInformation": "Runda 2 — AI przedmiar: 7,5 → 6,4 m²\nPowód: projekt wykonawczy — ściana TV 240 cm"
}
```

`clientPrice` only on a pozycja the kosztorys lacks, as in round 1. A row matches by sekcja + opis
as `kosztorys.txt` shows them **now** — a pozycja the owner renamed since the last round is matched by
its new name, or the loader adds a duplicate.

- **The AI never writes an owner field.** Inviolable (owner). Przedmiar, Status, Powód zmiany,
  Komentarz and prices belong to people; the AI writes only its own fields — AI przedmiar, „Czego nie
  było wiadomo”, „Co / ile założono”, and the new „Nowe informacje” and recheck flag. The SQL loader
  enforces it by construction: its statements name only those columns, and the draft supplies values,
  never columns, so no guard is needed. The round mode adds „Nowe informacje” and the flag to that
  list and nothing else. A pozycja a round adds is a new row (Przedmiar 0), as in round 1.
- **„Do ponownego sprawdzenia” is a flag, not a Status.** A round that changes a pozycja fills its
  „Nowe informacje” (what changed and why — e.g. „projekt wykonawczy: ściana TV 240 cm → 7,5 → 6,4 m²”)
  and raises a recheck flag. The Status column shows „Do ponownego sprawdzenia” above the owner's
  Status, which stays stored and visible as the previous verdict — no copy of it is kept anywhere.
  Picking a Status again (even the same one) lowers the flag; the „Nowe informacje” text stays as the
  round's record. The flag is needed because a Status the owner clicked never reacts to AI przedmiar,
  while a derived one (Przedmiar = AI przedmiar → Zaakceptowana) silently changes with it — without
  the flag, a round's change on a reviewed pozycja is invisible.
- **Sekcje:** a round may add a bathroom or WC the new information reveals — `fill-case-prod.ts`
  imports it from the szablon's „Łazienka” as in round 1, Przedmiar 0. From round 2 the script
  renames „Łazienka” only while it is still the kosztorys's one bathroom sekcja under the szablon's
  name — a first round drafted before the per-bathroom rule (#198, 12.10). Once any other bathroom
  sekcja exists, a name may be the owner's: no rename, and the AI proposes one in „Uwagi AI”.
- **The first reading is frozen; every later round appends to „Nowe informacje”** (owner,
  2026-10-14: „chcę widzieć dokładnie, co było w pierwotnej wersji, a co się zmieniło”). „Czego nie
  było wiadomo” and „Co / ile założono” are round 1 and no later round writes them. AI przedmiar
  holds the current proposal — „Zaakceptowana” copies it into Przedmiar, so it cannot lag. „Nowe
  informacje” is an append-only history, one block per round, a blank line between blocks:

  ```
  Runda 2 — AI przedmiar: 7,5 → 6,4 m²
  Powód: projekt wykonawczy — ściana TV 240 cm
  Założono: płytki w formacie jak w łazience
  Nie wiadomo: kto wykańcza krawędzie
  ```

  One column however many rounds — blocks stack in the same cell. If four rounds make it too long,
  the grid could show only the last block with the full history on click; not before #190 shows
  whether it is needed (owner: „spróbujemy”).

  A pozycja added in a later round opens with „Runda 2 — nowa pozycja: 0 → 3,86 m²” and keeps its
  round-1 fields empty. An unknown the client answered is written into the round's block
  („Wyjaśnione: wysokość — projekt podaje 2,70 m”); the original „Nie wiadomo” stays as history.

- **A round re-estimates everything, but its draft holds only a difference** (owner, 2026-10-14).
  The agent measures the whole kosztorys afresh with everything as input: its previous reading, the
  owner's Przedmiar / Status / Powód zmiany, and the new information. Each pozycja is then compared
  with the kosztorys as it stands — and the comparison is the agent's, because only the agent knows
  whether a difference has a source:
  1. new qty = the owner's Przedmiar → the AI agrees with him: AI przedmiar aligns, no flag;
  2. a difference with no source in the new information is measuring noise (12,4 vs 12,6 m²) → left
     out of the draft, the previous value stays. Where the owner corrected the AI and nothing new
     touches it, his number is the truth the agent works from;
  3. a difference with a source — a named new file or a sentence of the new message → in the draft
     with its round block; the loader writes the value, appends the block and raises the flag.

  A better document is a source too: on #190 the projekt wykonawczy replaces the brief, so many
  quantities change legitimately without the client mentioning them. A flag costs the owner a
  re-check, which is why noise must not raise one.

  **The round mode differs from round 1 in what it leaves alone:** a pozycja missing from the draft
  is untouched (round 1 sets it to 0), and the round-1 fields are never written.

- **What is new comes from a per-round record, not from the owner** (owner, 2026-10-14). Each round
  saves what it read: the full Notatki text, the file list (name + date added) and the „Uwagi AI” it
  replaced. The next round diffs the app against it — new sentences and new files are the new
  information. The app keeps no earlier Notatki, so without the record the owner would have to mark
  what is new by hand. **The record stays outside the repo** (`~/.local/share/wykonczymy-ai-cases/<CASE>/`,
  beside the files): Notatki carry the client's name and contacts, and the repo is public.
- **„Uwagi AI” are rewritten as the current state, and nothing still true may drop out** (owner,
  2026-10-14). Every point of the previous version either stays (a question still open for the
  client stays a question) or is listed in the round's „co się zmieniło” block at the top as answered
  or obsolete, with its source. A point that vanishes without that line is a defect of the round.
- **A round may change any AI przedmiar, in either direction** (owner, 2026-10-14): raise it, lower
  it, take it to 0 („nie uwzględniajcie okapu”), or add a pozycja beyond the kosztorys (Przedmiar 0).
  Every change carries its reason in „Nowe informacje” and raises the flag — it is a proposal, and
  the owner's Przedmiar does not move until he decides. A pozycja the owner rejected is not offered
  again unless the new information changes it, and then „Nowe informacje” says why.
- **Knowledge extraction stays manual and out of this flow** (owner, 2026-10-14): the owner starts it
  himself, picking investments by stage (step 9). One seam: a round sets Etap AI back to
  „Przeanalizowana”, so after the owner's next review the investment reaches „Recenzja zakończona”
  again. The owner's Powody stay on their pozycje through the round, so `collect-reasons-prod.ts`
  leaves out the ones already in `knowledge-ledger.json` (#190's 8 came back this way on 2026-10-15).

## Next

- [x] Get the owner's offer for case 1 and compare v1 and v2 against it, position by position
      (2026-10-05, `cases/01-bemowo-125m2/owner-comparison.md`).
- [ ] **Later rounds** (see that section): built in EX-1057 — run the #190 round 2 pilot with the
      runbook once the migration is on production.
- [ ] Confirm the house-rule candidates from `owner-comparison.md` with the owner (15 min).
- [ ] Ask the client the "do weryfikacji" questions from `measurement.md`: walls behind built-ins,
      karnisz behind maskownice, window heights.
- [ ] **Later, not now (owner, 2026-10-01).** Turn "Agent procedure v0" into an actual prompt and re-run case 1 blind with it. Does a
      fresh agent following the procedure land near v2 without hand-holding?
- [ ] Case 2: a past investment where both the client's inquiry and the owner's final offer exist
      (blind run). Prefer a different input type (photos, or a raster plan) to test the procedure's
      input classification.
- [ ] Make an unpriced position unmistakable in the app (nullable `client_price`). Decided: it
      must stand out more than 0 zł does (procedure rule 9). Still open: how it renders on the row
      and the total, and how settlement treats it.
- [ ] **Later, not now (owner, 2026-10-01).** Give the agent a write path instead of a per-case script.
      The draft JSON (`fill-case-prod.ts` + `load-draft-sql-prod.ts`) is already the output
      contract. What is still missing is a path that doesn't depend on action ids scraped from the
      client chunks or on a direct production DB write.
- [ ] Measure the lengths still guessed (bruzdy, kable, LED, Ethernet) from the electrical drawings,
      or decide they stay per-point assumptions.
