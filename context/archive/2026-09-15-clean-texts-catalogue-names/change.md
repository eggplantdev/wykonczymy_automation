---
change_id: clean-texts-catalogue-names
title: „Popraw literówki" adopts names from the work-catalogue fixes table
status: archived
created: 2026-09-15
updated: 2026-09-15
archived_at: 2026-09-15T19:13:51Z
branch: clean-texts-catalogue-names
worktree: null
---

## Notes

Symptom: on `/szablony/4` the „Porównaj z katalogiem prac" (compare with the work catalogue) window
reports **30 works outside the catalogue**, where the „może chodzi o…" (did you mean…) hint differs
from the name in the breakdown only cosmetically („Wyburzanie ścian 12-20cm" vs „…12-20 cm",
„Malowanie sufitu w kolor" vs „…w kolorze", „taśm ledowych" vs „taśm LED").

Cause, established on data (inv. 151 = the workshop of template 4, catalogue of 843 items):

- The catalogue names were corrected by a one-off script `src/scripts/fix-work-catalogue-texts.ts` with
  `src/scripts/data/work-catalogue-fixes.tsv` (**938 hand-corrected pairs**, commit `61ae1aa5`).
- By design the script wrote **only to `work_catalogue_items`** — breakdowns and templates were left
  untouched. Hence the asymmetry.
- The corrections **never reached the rules of the „Popraw literówki" (fix typos) button**. The
  script's header said so: "the corrections are data, not code". No code linked the table to
  `cleanItemTextsAction`.
- Both files were deleted by `4de2666e`, a commit carrying the epilogue of a **different** change
  (drag-drop-guard).

Coverage of template 4's 31 unique misses by the table from history:

|                                                                                  | count |
| -------------------------------------------------------------------------------- | ----- |
| table hits a name that **exists today** in the catalogue                         | 24    |
| the letter-level rules fix the unit (`klp` → `kpl`)                              | 2     |
| table targets a name that **no longer exists** (split into variants after the run) | 5     |

So **26 / 31 in one click**.

Solution shape (agreed with the owner):

1. The table returns as **product data**, not a one-off script. 938 **unique** keys, zero
   duplicates → a `Map` on the whole name, not 938 `split/join` passes (the existing rules replace
   **fragments** — a different data shape, hence guards like ` parc` → ` prac`).
2. `cleanItemTextsAction` gets a second step: after the letter-level rules, look the name up in the
   table.
   > **Superseded (at planning):** the guard "only if that name exists in the catalogue today" was
   > rejected — see Decisions.
3. Also feed the table into the identity key (`foldDescription` → `catalogueKey`), so the old and new
   spelling key identically and the window stops reporting them **without a click**. Needs a
   collision check (`UNIQUE` on `match_key`).

Out of scope: the 5 split variants („Klejenie paneli winylowych" has a **0.862 : 0.862 tie** between
_jodełka_ and _mijanka_) — they need a human decision, i.e. a separate "adopt the catalogue name"
action in the compare window.

## Decisions

- **Table keyed by description only, not by unit.** With „[stary arkusz]" stripped, the table is
  unambiguous by description — the 16 ambiguities came from that marker, not from the unit.
- **Guard "name exists in the catalogue" rejected (owner).** The fold is a pure function and never
  reads the DB; a guard on one side only would make the two mechanisms diverge. On the data it
  changes nothing anyway.
- **Unit from the table is not applied (owner).** `szt` → `m2` is not a typo but a different pricing
  basis.
- **No bulk run (owner).** The write goes through the snapshot and the investment lock, so it is
  reversible.
- **Identity before the button.** The fold writes nothing to the DB, so it is safe alone; the button
  without the fold is not — it would rewrite letters `itemKey` doesn't absorb, i.e. drift from the
  Google Sheet.
- **The 107 KB table ships to the editor client** (via the picker, ~47 ms init). Real, but at ~5
  desktop users a `dynamic()` boundary costs more than it saves.
