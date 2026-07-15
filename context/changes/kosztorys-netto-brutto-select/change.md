---
change_id: kosztorys-netto-brutto-select
title: Netto / brutto / both select over the grid's money columns
status: implementing
created: 2026-07-15
updated: 2026-07-15
archived_at: null
branch: dogfooding/kosztorys-editor-ux
worktree: null
---

## Notes

A `netto | brutto | both` select over the kosztorys grid's money columns.

**This is "piece 2"** — `/10x-frame` split it out of `kosztorys-stage-values`, which shipped piece 1
(the per-stage value columns). Its shaping is **already settled** and lives at
`context/changes/kosztorys-stage-values/change.md` → **"Not this change (2): the netto/brutto
shortcut"**. Carry it over; do not re-derive it.

### Owner decisions (2026-07-15) — settled, not open

1.  **`price` is EXEMPT from the mode** — always visible, the way `description` is already exempt from
    the picker via `NON_HIDEABLE_COLUMNS`. This deletes the write-transform / VAT-round-trip branch
    entirely: the other 11 netto/brutto columns are computed and read-only, so the mode only ever
    decides what is on screen. No `/(1 + VAT)` on input, no rounding question.
2.  **The picker stays the source of truth; the select only filters what the picker already allows:**

        visible(col) = pickerAllows(col) AND selectAllowsAxis(col)

    They cannot disagree because they answer different questions — the picker means "I never want to
    see this column, in any mode" (hard, durable), the select means "of the columns I do want, show the
    netto side / the brutto side / both". Neutral columns have no axis, so the select cannot touch them.

3.  **`netto | brutto | both`, with `both` reachable. GLOBAL** — one setting across all three price
    views; per-view memory was raised and **rejected**.

### Sizing

Of the 21 columns in `COLUMN_LABELS` (`src/lib/kosztorys/constants.ts`): **6 netto, 6 brutto, 9
neutral** (`Opis prac`, `Przedmiar`, `J.m.`, `Rabat`, `Rabat wart.`, `Etapy — ilość`, …). So the piece
is a netto/brutto tag per column + a filter over the existing `useHiddenColumns`. `DEFAULT_HIDDEN_COLUMNS`
(one entry: `stageValueGross`) lives in the picker layer and **survives unchanged** — decision 2 is
what makes that true.

### Settled by the plan (2026-07-15)

- **The footer is untouched** — `Suma netto` and `Suma brutto` both stay in every mode (owner). So
  `sectionSubtotalsForView` and `kosztorys-section-summary.tsx` are out of scope entirely; the open
  question closed by exclusion, not by implementation.
- **The picker's menu is untouched** — an axis-hidden column still reads as checked (owner). Zero code
  in the picker layer.
- The control is a `ToggleGroup` beside the price-view group (owner).
- **Census correction:** `COLUMN_LABELS` holds **22** keys, not 21 — the split is 6 netto / 6 brutto /
  **10** neutral. The 12 tagged (11 moved, `price` exempt) is unchanged.

### Still open — for dogfooding, not for code

- The select **only narrows, it never guarantees**: with `Brutto` picker-hidden and the select on
  `brutto`, that column stays off screen. Correct by the model, but check during dogfooding that it
  doesn't read as a broken control.

### Traps

- ⚠️ **`kosztorys-stage-values/frame.md:120-122` states the OPPOSITE of decision 1** — "`price` inside
  the mode rather than exempted from it. Do not treat it as a picker shortcut — that shape is
  falsified." It carries a **SUPERSEDED** note directly beneath it. Read that note, not the paragraph.
  Building from the un-superseded premise means writing a VAT write-transform nobody asked for.
- The `/10x-frame` record's premise for deferring this piece was _"the grid is too wide"_, and the
  owner reported the width as tolerable — so the piece is **task-driven, not width-driven**. Don't
  resurrect the width argument as its justification; it was already found circular (piece 2's value
  rested on hiding piece 1's new columns).
- Depends on `kosztorys-stage-values` for **two string constants only** (the stage picker-group ids).
  Nothing else.
- Never add a remount `key` to the grid — that remount WAS the EX-422 flicker
  (`context/foundation/lessons.md:119-135`, commit `ee497cb`). A changed column set no longer needs
  one; the grid is reactive.
