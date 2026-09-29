---
change_id: legacy-sheet-work-import
title: Import works missing from the catalogue out of the old client sheets
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T14:45:36Z
branch: legacy-sheet-work-import
worktree: null
---

## Notes

One-off action: the work catalogue is built from the template kosztorys (~400 works), but some works
exist only in old investment sheets. Pull them out and add them to the catalogue.

Pipeline, dumps, report figures and the 2026-09-02 prod load (940 items):
`context/reference/legacy-sheet-dumps.md`.

### Owner rulings (2026-08-31)

1. **Scope: all 56 sheets**, not only completed investments — ongoing ones carry the freshest prices,
   and under the "newest sheet" rule they win.
2. **Price: from the newest sheet** the work appears in. Price spread and occurrence count go into
   the report as review aids (they show whether an item is real work or a one-site addition).
3. **Subcontractor rates come with the price**, from the same sheet — as frozen amounts, per the
   catalogue's model.
4. **No occurrence threshold.** Everything missing from the catalogue goes in. The earlier proposal
   to filter one-off additions was rejected — owner: "there won't be a few thousand of them".
5. **Marker = a visible tag in the item name**, deleted by hand during review. Deliberately NO DB
   field. Accepted consequences: the tag travels into the kosztorys and the offer if nobody removes
   it (seen as a plus — it forces a reaction), and it breaks name matching until review.
6. **Cautious merging of name variants** (word order, abbreviations, plural), no fuzzy similarity
   threshold. Why: the price comes from the newest sheet, so a wrong merge of two different works =
   a wrong price that review CAN'T see (it sees one plausible item). A duplicate is visible and
   deleted — cheaper.
7. **Offline script, three passes** — (a) pull all sheets to disk once (Google's API is
   rate-limited; 56 sheets easily hit 429), (b) analyse the copy with no network, (c) a report to
   review. The import writes nothing on its own.
8. **One-off.** No idempotency, no rerun safety, no tests, no place in the app — scripts deleted
   after the action.

Unit normalization (m2 / m² / mkw, szt / szt.): the same name in m² and in mb is TWO different works
and must never be merged. The same work legitimately costs differently across investments (another
crew → another price); the catalogue copies the price on insert and never keeps it live, so the
report says "differs from the price list", never "is wrong".

### Prod gets the result, not a rerun (2026-09-01)

All work happened on the local DB — template seed, the three import passes, then the owner's review
in the app (deleting junk, fixing prices, removing tags), which must never be repeated. Production
got **an export of the whole reviewed local `work_catalogue_items`** as a one-off, insert-only load
by `match_key` — the template included, so prod matches what was reviewed on screen. No separate
`seed-work-catalogue.ts` run on prod.

### As built — deviations (2026-09-01)

1. **The marker is a SUFFIX, not a prefix** (owner, mid-change). The listing sorts by name, so a
   suffix puts the sheet work next to its template twin — exactly the comparison review makes; a
   prefix would dump every added item into one block under „[".
2. **Description typos fixed** by `cleanDescription`. The ban covered units (a typo dictionary there
   is a blind decision), not descriptions; verified empirically that on 946 rows it changed no key.

> **Superseded (2026-09-22, `21199377`, migration `20260922_1_catalogue_legacy_marker_cleanup`):**
> the „[stary arkusz]" marker and `legacy-marker.ts` are gone — the review was finished and the tag
> machinery removed.
