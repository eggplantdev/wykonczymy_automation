---
date: 2026-10-01T08:21:39+0200
researcher: Claude (Opus 5.5)
git_commit: 99f18e92
branch: staging
repository: wykonczymy
topic: 'Should a kosztorys pozycja store a link (id) to its katalog entry instead of re-deriving the pairing from opis + j.m.?'
tags: [research, codebase, work-catalogue, kosztorys-items, identity, snapshots, sheet-import]
status: complete
last_updated: 2026-10-01
last_updated_by: Claude (Opus 5.5)
---

# Research: link a pozycja to its katalog entry by id?

**Date**: 2026-10-01T08:21:39+0200
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 99f18e92
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Should `kosztorys_items` store a link to `work_catalogue_items` (a nullable FK, ON DELETE SET NULL),
so that every reader stops re-deriving the pairing from `catalogueKey(opis, j.m.)`? The question is
whether the change makes sense **at all**, decided before EX-948 (UA translations) is planned. The
user's stated direction (2026-10-01): the app is moving away from Google Sheets.

## Summary

**Verdict: not now. The data says the link would fix very little, and in some places it would do
harm.**

1. **What breaks pairing is legacy text, and an id cannot fix legacy text.**
   - Measured on the local prod copy (dump 2026-09-30): **514 of the 529** unpaired used pozycje sit
     in the 20 kosztorysy imported from a Google Sheet. None of those rows was ever created from the
     katalog.
   - Kosztorysy seeded from the „Kosztorys 2026" szablon pair at **94.5 % (used) / 98.4 % (all)**
     with no link at all.
   - A backfill would have to use exactly the fuzzy matching the link is meant to avoid. 93 of the
     195 „contained" near-misses have more than one candidate entry.
2. **Renames that break a pairing are rare, and the text answer is often the right one.**
   - Across 17 days of auto-snapshots: 3211 pozycje changed text, 56 changed their key, and only
     **10** went from paired to unpaired.
   - Several of those 10 were real scope changes, where a kept link would be _wrong_:
     „Montaż WC podwieszanego" → „Montaż WC", „przed gładziami" → „przed tynkami",
     „W zależności od piętra" → „3 piętro bez windy".
   - The text key errs safe („brak w katalogu"). A stale link errs dangerous: it reports a confident
     price rozjazd against the wrong praca. This was already the open question of the 2026-09-17
     proposal.
3. **Only one case is clearly won by the link: a katalog entry renamed via „Edytuj".**
   - Today one katalog rename unpairs every pozycja made from that entry, in every kosztorys, at once.
   - There is no katalog history, so its frequency can't be measured. 492 of 561 entries were edited
     by hand during the 2026-09 review, yet szablon-seeded kosztorysy still pair at about 98 %.
   - A text-side fix covers this case without a second rule: on a katalog opis/j.m. change, offer to
     carry the new text onto the pozycje that paired with the old key.
4. **The link adds a second rule permanently.**
   - Sheet import wipes and re-creates the tree, and legacy rows have no id. So every reader becomes
     „link, else text".
   - It also needs a policy for a pozycja opis edit. If it is „clear the link when the key moves",
     the link only differs from text in the katalog-rename case. If it is „keep the link", item 2's
     danger applies.
5. **It has been proposed and rejected once already.**
   - `katalog-prac-identity` (2026-09-17) proposed exactly this FK, forward-only, with the owner
     ruling that old rows may stay null.
   - The same day it was dropped: „Katalog prac zostaje doradczy, więc referencja z wiersza rozpiski
     do pozycji cennika odpada" (`3baa7e09`). That reason exists only in the commit message.
6. **Most of the bites were at the sheet boundary and in the legacy cleanup, and both are
   transitional.**
   - The incidents: the marker in the key, „Popraw literówki" vs re-import, fold drift, 30 false
     „spoza katalogu" on a szablon.
   - Sheet import dies with EX-780. The ~330 legacy near-misses are fixed one at a time by accepting
     a „może chodzi o" hint, which copies the katalog opis and j.m. and pairs by text from then on.

**What this means for EX-948:** nothing changes. Translations key on the Polish text (a dictionary),
as decided in that change's follow-up research. They never needed the link.

## Detailed Findings

### 1. Readers of the text pairing (14 call groups)

- **Pozycja → katalog, where a link would replace the lookup (5 readers):**
  - `build-catalogue-comparison.ts:157,168,182` („Porównaj z katalogiem", plus the editor's
    „Katalog prac" problems via `catalogueRowIds`)
  - `already-in-kosztorys.ts:18-42` (picker „Ukryj już dodane", swap dialog)
  - `catalogue-usage.ts:47,60` (`byId`, „nieużywane")
  - `line-draft.ts:46-60` (`catalogueSwap`)
  - `catalogue-to-kosztorys.ts:196-216` („Aktualizuj kosztorys")
- **Where the link would make behaviour worse:**
  - Pozycja repurposed by an opis edit. Readers 1, 2, 5 and 6 keep comparing against, hiding behind,
    adding qty to, or writing prices from the old praca.
  - `catalogue-to-kosztorys.ts` today re-derives the key from the current text and refuses with
    `STALE_CATALOGUE_ERROR` on a mid-window rename, which is a deliberate safety. A link would write
    the old entry's ceny onto a renamed row.
  - `catalogue-usage` by link alone undercounts legacy rows, so „nieużywane" invites deleting entries
    that are in use.
  - `price-divergence.ts:26` groups hand-typed twins that have no link. It is not about the katalog,
    and grouping by link would hide the Łazienka↔Kuchnia rozjazd.
- **Stays text whatever is decided (about 10 groups):**
  - katalog uniqueness and collisions: `new-item-form.tsx:72`, `actions/kosztorys.ts:520`,
    `actions/work-catalogue.ts:29,55`, `write-catalogue-entry.ts:27,44`
  - near-duplicates: `catalogue-near-duplicates.ts`
  - hints: `build-catalogue-comparison.ts:43-66`, `hint-lead.ts`
  - the uncatalogued list: `catalogue-usage.ts:64-97`
  - sheet matching: `item-key.ts:47-62` → `build-import-plan.ts`, `build-sheet-comparison.ts`,
    `build-measured-qty-refresh.ts`
  - version diff: `history/diff-versions.ts:36-52`
  - text repair: `clean-description.ts:189`, `scripts/fix-kosztorys-descriptions.ts`
- **Performance:**
  - `price-divergence.ts:26` folds every row, uncached, on every rows change
    (`use-kosztorys-editor.ts:432-435`).
  - `build-catalogue-comparison` has only a per-call key cache (`use-kosztorys-editor.ts:446`).
  - The link removes the fold from the comparison only. One shared per-row key memo, keyed by
    (opis, j.m.), would get most of the gain with no schema change.

### 2. Pozycja lifecycle: the cost of carrying a link

- **Katalog known at birth on 3 paths:**
  - the picker (`catalogue-to-kosztorys.ts:61,90` → `place-catalogue-items.ts:34`,
    `create-section-with-catalogue-items.ts:83`)
  - „Nowa praca" with katalog (`actions/kosztorys.ts:490`). The pozycja is inserted at `:533` before
    the katalog write at `:535`, so this needs reordering.
  - worker-report accept (`accept-worker-report.ts:361-387`, which already holds `catalogueItemId`)
- **Carried automatically:** every copy, restore and szablon path goes through
  `insertItems` (`insert-rows.ts:21,117`) and spreads `KosztorysItemT`. That covers snapshot restore,
  szablon save/seed/append and import. Undo never re-creates a row.
- **Plumbing (about 10–12 source files plus about 11 test fixtures):**
  - migration and index
  - collection field
  - `KosztorysItemT` (`types.ts:33`)
  - tree SELECT and mapper (`db/kosztorys-tree.ts:69-74,150`)
  - `ITEM_INSERT_COLUMNS` (`insert-rows.ts:125`)
  - `snapshot-format.ts`: optional key plus `?? null`. Otherwise an old payload binds `undefined`
    and the INSERT breaks.
  - `item-from-fields.ts`
  - about 6 hand-built items
- **Riskiest spot: restoring an old snapshot.**
  - Snapshots are kept for about a year and keep a deleted entry's id.
  - Re-inserting one gives FK error 23503, and that version can never be restored (same failure as
    EX-641 with a deleted worker).
  - It needs a `liveCatalogueIds … FOR SHARE` filter that mirrors `liveWorkerIds`
    (`insert-kosztorys-tree.ts:37`).
- **Sheet import** (`build-import-plan.ts:210-226`) would have to carry the link from the matched
  current row (the precedent is how `note` is carried), or re-derive it by text.
- **Katalog delete** (`work-catalogue.ts:71`): SET NULL would write rows in closed investments, past
  the investment lock, without bumping the `kosztorysItems` tag.

### 3. Measurements (local copy of prod, dump 2026-09-30, SELECT only)

- **Totals:** 10 770 pozycje, 34 investments (2 szablony), 561 katalog entries (one batch,
  2026-09-02). Stored `match_key` equals the recomputed key on 561/561 rows.
- **Pairing:** 80.4 % of all pozycje, 68.5 % of used ones (1149/1678 across 30 kosztorysy;
  reproduces the 69.2 % from the older dump).
- **By provenance (used pozycje):**

  | Provenance                   | Paired |
  | ---------------------------- | ------ |
  | sheet import, 20 kosztorysy  | 64.6 % |
  | szablon-seeded, 8 kosztorysy | 94.5 % |

  Only ~28 pozycje in the whole DB were added by hand outside bulk loads.

- **The 529 unpaired used pozycje:**

  | Bucket                          | Pozycje | Example                                                                                   |
  | ------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
  | (a) same opis, different j.m.   | 55      | kpl↔szt, m²↔kpl                                                                           |
  | (b) one opis contains the other | 195     | „Montaż zaworów" ⊂ „Montaż zaworów przelotowych…" — often a genuine variant, not a rename |
  | (c) word overlap ≥ 0.6          | 81      |                                                                                           |
  | (d) nothing close               | 198     | „Ozonowanie", „Murowanie ścianki z luksferów"                                             |

  A reviewed relink of (a)–(c) caps used pairing at about 88 %. (d) is work the katalog does not
  contain.

- **Renames (snapshots 2026-09-14 → dump):** 10 went paired → unpaired, and 39 went unpaired →
  paired (mostly „klp" → „kpl").
- **Ambiguity:** no katalog opis exists under two units. 4 size-variant families (10 entries) cover
  only 6 used pozycje.
- **Katalog edits:** 492 of 561 entries have `updated_at` > `created_at`, spread over about 280
  distinct minutes during the hand review. There is no history table, so renames can't be separated
  from price edits.
- The throwaway scripts are in the session scratchpad (`measure.ts`, `groups.ts`, `renames.ts`).
  Nothing was committed.

## Code References

- `src/lib/kosztorys/work-catalogue/catalogue-key.ts:8-17`: the key, and why it shares the import's
  fold
- `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:152-225`: the main pozycja → katalog
  reader
- `src/lib/actions/catalogue-to-kosztorys.ts:196-216`: the `STALE_CATALOGUE_ERROR` safety a link
  would lose
- `src/lib/kosztorys/price-divergence.ts:26`: not a katalog reader; must stay text
- `src/lib/kosztorys/insert-rows.ts:21,117,125`: the single insert path and explicit column list
- `src/lib/kosztorys/snapshot-format.ts:143`: old payloads and the `undefined` bind
- `src/lib/db/insert-kosztorys-tree.ts:37`: `liveWorkerIds`, the filter a link would need a twin of
- `src/lib/actions/kosztorys.ts:490-549`: „Nowa praca", insert before katalog write
- `src/migrations/20260930_2_add_worker_reports.ts:55`: the existing FK precedent
  (`worker_report_lines.catalogue_item_id`) on a single-path table that is never snapshotted

## Architecture Insights

- **Provenance vs meaning.**
  - A link answers „where did this row come from". The text key answers „what does this row say it
    is".
  - The readers ask the second question. A row edited to mean different work should stop matching,
    and only text does that by itself.
  - A link is the better identity only where the _katalog_ side changes and the pozycja does not.
- **Same pattern as the lesson „Positional identity is two roles fused — split them, don't replace
  them"** (`lessons.md:409`).
  - Here the text plays both roles: a display name and an identity.
  - Splitting them (a link for identity, text for meaning) only pays off once most rows can carry the
    link. Today about 90 % of rows are sheet-born and can't.
- **One rule beats two.**
  - The 2026-09-01 ruling accepted the dead zone in exchange for a single rule.
  - A link plus a text fallback is two rules for as long as legacy and imported rows exist, which
    lasts until EX-780 and the closing of every sheet-born investment.

## Historical Context (from prior changes)

- `git show 3baa7e09^:context/changes/2026-09-17-katalog-prac-identity/change.md`: the same FK was
  proposed (forward-only, prices stay a snapshot, FK for comparison only) and dropped the same day as
  „katalog doradczy". Its open question („czy link przeżywa przepisanie opisu na zupełnie inną
  pracę?") is answered by this research's rename data: no, it shouldn't.
- `context/reference/kosztorys-editor-domain-notes.md:944-947`: owner ruling 2026-09-01. The picker
  matches by `matchKey`, and the dead zone is accepted for the sake of one rule.
- `context/foundation/lessons.md:1636-1640, 1796-1798`: the marker-in-key incident, and „a fold
  change owes a backfill".
- `context/archive/2026-09-28-catalogue-filters-and-usage/change.md:27-43`: the 69.2 % usage
  measurement.
- `context/foundation/roadmap.md:136-147,748` and Linear EX-780 / EX-712: the Google teardown is
  parked until the cutover is proven. Sheet import and compare are „narzędzia wjazdu".
- Machinery that exists to keep text pairing working:
  - `catalogue-name-fixes.ts` (1965 lines, 915 entries)
  - `TYPO_FIXES`, `foldUnit`
  - the drift spec
  - near-duplicates and hints
  - about 20 commits across about 6 changes

## Related Research

- `context/changes/2026-10-01-worker-report-translations-ua/research.md`: EX-948. Its follow-up
  section splits identity (this change) from translation (text dictionary). Its line „Decided: the app
  is moving away from Google Sheets → the link pays off" is **superseded by this research**: moving
  off Google shrinks the text problem too, and the measured gain of the link is small.

## Open Questions

1. **Katalog rename propagation.** This is the one real bite left: a katalog entry renamed via
   „Edytuj" unpairs its pozycje everywhere. How often does that happen after the hand review is over?
   - If it is rare, do nothing.
   - If it bites, the text-side fix is: on an opis/j.m. change in the katalog form, list the pozycje
     that paired with the old key and offer to rewrite their opis/j.m. too, keeping one rule.
   - That is a small change of its own, not this one.
2. **Revisit trigger for the link.** Reopen it only after EX-780 lands and the sheet-born
   investments are closed. Then most rows are katalog- or szablon-born, the „else text" fallback
   shrinks, and the remaining cost is the snapshot dangling-id filter plus the opis-edit policy.
3. **Shared per-row key memo** (performance, independent of the link): one memoized
   `catalogueKey` per (opis, j.m.), shared by `price-divergence` and `build-catalogue-comparison`.
   Worth a Linear issue only if the editor shows the cost on a 1000-row kosztorys.
4. **The ~330 legacy near-misses** are cleaned up through the existing „może chodzi o" accept.
   Whether to drive that as a one-off pass (I propose matches, a human accepts) is a katalog-hygiene
   question, not an identity one.
