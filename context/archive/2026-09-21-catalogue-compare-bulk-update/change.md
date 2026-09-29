---
change_id: catalogue-compare-bulk-update
title: Bulk-update the rozpiska from the work catalogue in the compare dialog
status: archived
created: 2026-09-21
updated: 2026-09-22
archived_at: 2026-09-22T04:53:56Z
branch: catalogue-compare-bulk-update
worktree: null
---

## Notes

„Porównaj z katalogiem prac" gains a second write direction — it wrote only to the catalogue
(„Edytuj w katalogu", „Dodaj do katalogu"), and the owner also needs to pull catalogue numbers into
the rozpiska. Three pieces, agreed with the owner 2026-09-21:

1. **Half-cent fix (a bug, done first).** „Malowanie sufitu w kolor — Stawka bez narzędzi" showed
   14,88 zł against 14,88 zł with a −0,01 zł difference. The rozpiska held 14,875, the catalogue
   14,88 — exactly half a cent, exactly the mute threshold, but floating-point noise (14,88 has no
   exact binary form) pushed it ~4e-16 over. Fix: compare amounts rounded to cents, so the report
   compares exactly what it displays.

2. **Bulk price update.** A checkbox on every single number, a whole-work checkbox as a shortcut,
   „zaznacz wszystkie" on top; a work's three numbers share one indented header (the work's
   description used to repeat on three rows, hiding that they are one work). An automatic version
   is taken before saving — a bulk write does not go on the undo stack (pattern: percent discount,
   „Popraw literówki").

3. **Accepting „może chodzi o" hints.** Two traps found in the data:
   - matching is on the (description, unit) pair, and „Docięcie i montaż progu" has **no unit** in
     the rozpiska but `szt` in the catalogue — changing the description alone won't match; take
     description **and** unit;
   - a hint is a single guess, but the catalogue often has several close candidates at different
     prices: „Klejenie paneli winylowych" → _jodełka_ 95 zł / _układ prosty_ 60 zł / _mijanka_ 60 zł.
     So acceptance is **a choice among candidates**, not a "yes" checkbox, and deliberately does
     **not** pull prices — a renamed work lands in „Inne liczby niż w katalogu", where prices are
     taken in a separate, visible step.

### The „auto" ruling (owner, 2026-09-21)

The catalogue may give no rate — 125 of 568 entries don't; the rate is then catalogue price ×
investment coefficient. The „Katalog" column used to render **the computed złoty amount** — a
number not in the catalogue that changes with the coefficient.

Muting such rows (catalogue "has no opinion") was considered. **The owner rejected it**: catalogue
„auto" is a decision ("this work is priced from the coefficient"), exactly as when adding a
catalogue work to the rozpiska, where auto goes in as auto — so the update must be able to take
auto. Agreed:

- the column shows **the word „auto"**, never a computed amount — neither side shows a number nobody
  typed;
- a **difference in method**, not only in amount, is a divergence (frozen amount vs „auto", both
  ways); auto vs auto stays muted;
- updating such a row **clears the override** and the work prices its rate from the coefficient;
- „Różnica" stays **an amount, but greyed/marked** — ticking 40 works at once, the owner must see
  how much money moves, knowing it is a coefficient result (a „13,60 zł → auto" variant with an
  empty difference was rejected for that reason).

Scale measured with the real compare function on the local DB (14 kosztorysy, 4464 items) —
method in the `research.md` deleted at archive
(`git show 2673dcba^:context/changes/2026-09-21-catalogue-compare-bulk-update/research.md`).
Investment 151: 63 works / 138 differences, of which 6 "rozpiska frozen ↔ catalogue auto" and 9
"rozpiska auto ↔ catalogue amount".

## Closure (archive 2026-09-22)

`plan.md`, `plan-brief.md` and `research.md` were deleted at archive; recover them with
`git show 2673dcba^:context/changes/2026-09-21-catalogue-compare-bulk-update/<file>`. No review gate
ran for this change.

Three owner rulings that overrode the recommendation and aren't visible in code:

- **Three pieces in one change**, against the recommendation to split — the owner wanted to see and
  test it all at once.
- **A checkbox on every single number, not only per work**, against the "per work only"
  recommendation.
- **No confirmation dialog** — in batch work a confirmation becomes a reflex that protects nothing;
  instead a counter on the button and an automatic version before saving.

Deliberately out of scope, to be told to the owner: changing the description when accepting a
candidate **disconnects the item from its sheet twin** on the next „Porównaj z arkuszem".

Progress (phases → commits): 1 `b8dd0158` · 2 `18092f87` · 3 `3d028a8b` · 4 `fe0763d4` · 5 `87f26bba`
· epilogue `2673dcba`.
