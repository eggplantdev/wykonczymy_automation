---
change_id: kosztorys-stage-values
title: Per-stage value columns (netto+brutto)
status: archived
created: 2026-07-15
updated: 2026-07-24
archived_at: 2026-07-24T14:33:31Z
branch: dogfooding/kosztorys-editor-ux
worktree: null
---

## Notes

Shaped with the owner 2026-07-15 as two pieces "deliberately shipped together". **`/10x-frame`
split them** (see `frame.md`) — the coupling argument did not survive the code, and the owner chose
piece 1 alone. Piece 2 (the netto/brutto shortcut) is now **not this change**; its record is kept at
the bottom so its shaping isn't lost.

**Kwota (wartość) etapu — the missing half of the stage axis.**
The grid renders one column per stage: the qty input (`stage_<id>`, `kosztorys-v2-columns.tsx:560`).
The sheet renders two: `D–M` = etap ilość (input) **and** `V–AE` = etap wartość (computed), then
`AF` = pozostało. The math already exists — `stageValueForView` (`calc.ts:61`) is the sheet's
`V = D*$Q-(D*$Q*$R)` verbatim — but it is only ever called internally by `rowDoneNetForView` to feed
the "Pozostało netto" column. It is never surfaced.

Verified against the LIVE sheet 2026-07-15 (inspector, not the notes — the notes have been wrong
before). Row 5, literally:

```
D–M   1–10 etap ilość    (input;    r02 subheader "wykonano")
N Przedmiar | O Pomiar | P j.m. | Q Cena | R rabat | T Wartość netto | U komentarz
V–AE  1–10 etap wartość  (=D5*$Q5-(D5*$Q5*$R5);  r02 subheader "wartość")
AF    pozostało          (=T5-V5-W5-…-AE5)
```

Settled shape:

- Column order (owner's call — qty moves left, out of sheet order, value block keeps sheet order):
  `Sekcja | Opis | Przedmiar | Pomiar | J.m. | E1..En ilość | Cena | Rabat | Netto | Brutto |
E1..En kwota netto | E1..En kwota brutto | Pozostało netto | Pozostało brutto`
- **Netto AND brutto** per stage. Rejected "netto only" (the P9 progress-control argument): every
  other money figure in the grid carries a netto/brutto pair, so a stage without brutto would be the
  lone exception. ⚠️ The second half of this argument — "and piece 2 makes the width objection moot"
  — is **withdrawn**: `frame.md` found it circular (piece 2's value rested on hiding piece 1's new
  columns). The netto/brutto pair stands on the consistency argument alone, and the width cost is
  now a real, unmitigated cost this change carries. Dogfood it.
- **Non-editable mirror header** on the value column. The sheet does this (`V1 = =D1` — the value
  header IS the stage's name, with a "wartość" subheader), and it is the right rule: the qty column
  keeps `StageHeader` (rename + remove), the value columns get a read-only title reading the same
  stage name. One source of the name, rename moves all three headers, delete takes all three columns.
- **Three picker groups** — `Etapy — ilość` / `Etapy — kwota netto` / `Etapy — kwota brutto`,
  replacing today's single `STAGES_COLUMN_GROUP` (`constants.ts:51`). Groups stay static, so no stage
  id enters the visibility map — the ghost-id hazard that motivated the single group is preserved.

**Not this change (2): the netto/brutto shortcut — split out by `/10x-frame`.**
Shaping preserved for whoever opens it as its own change:

- Owner wants `netto | brutto | both` as a **multiselect**, `both` reachable. **Global**, one setting
  across all three price views — per-view memory was raised and **rejected** (owner, 2026-07-15).
- **`price` is exempt from the mode (owner, 2026-07-15) — it is always visible, like `description` is
  already exempt from the picker via `NON_HIDEABLE_COLUMNS`.** This resolves the one question the
  piece actually had, and it **reinstates the bulk-hide framing** `/10x-frame` had rejected.
  The rejection ("it is not a shortcut over the column picker — 'hide all netto' hides `price`, the
  only editable price cell, and the owner types prices while reading brutto") rested entirely on that
  single cell, and generalized it into "a display mode over the money pairs" with a VAT write-transform
  on input. Exempting `price` deletes that whole branch: no write-transform, no round-trip through
  `/(1 + VAT)`, no rounding question. The other 11 netto/brutto columns are computed and read-only, so
  the mode only ever decides what is on screen.
  Count that settles the size: of 21 columns, **6 are netto, 6 brutto, 9 neutral** (`Opis prac`,
  `Przedmiar`, `J.m.`, `Rabat`, `Rabat wart.`, `Etapy — ilość`, …) — neutral columns ignore the mode.
  So the piece is a netto/brutto tag per column + a filter over the existing `useHiddenColumns`.
  (The 3× write-transform precedent — `subcontractorPriceColumn`, `subcontractorCoeffColumn`,
  `DiscountValueCell` — is noted only in case a later owner reverses the exemption. Not needed now.)
- It depends on this change only for two string constants (the stage picker-group ids). Nothing else.
- **The picker stays the source of truth; the select filters only what the picker already allows
  (owner, 2026-07-15)** — answering "whether it and the per-column picker can disagree, and which
  wins". **They cannot disagree, because they don't answer the same question.** They compose:

      visible(col) = pickerAllows(col) AND selectAllowsAxis(col)

  The picker means "I never want to see this column, in any mode" — a hard, durable filter. The select
  means "of the columns I do want, show the netto side / the brutto side / both". Neutral columns have
  no axis, so `selectAllowsAxis` is trivially true for them and the select cannot touch them.
  Two things this framing dissolves that a truth-bearing select would have cost:
  - **No collision with `DEFAULT_HIDDEN_COLUMNS`** (which THIS change introduced, holding one entry:
    `stageValueGross`). It lives in the picker layer, which is exactly where it already is — a
    per-column default the select then respects. Under a select-as-truth model the two rules would
    have contradicted on "does `both` reveal stage brutto?"; under AND-composition the question
    doesn't arise. **The constant survives piece 2 unchanged.**
  - **No loss of per-column control.** All 21 columns stay individually hideable, so "hide only
    `Pozostało brutto`, keep the rest of the brutto axis" remains expressible — via the picker, which
    is precisely what the picker is for.

  Consequence to carry into the plan: with picker-hidden `Brutto` and select = `brutto`, that column
  stays off screen. Correct by the model (the user said never), but it means the select is not a
  guarantee that anything in particular is visible — it only ever _narrows_. Worth a look during
  dogfooding to check it doesn't read as a broken control.

- Open for its frame/plan: what it does to `sectionSubtotalsForView` and the footer's
  `Suma netto`/`Suma brutto` (unconditional today, independent of the picker by design).
- The adjacent **parked POC TODO** (`context/archive/kosztorys-poc-in-app/2026-06-20-kosztorys-add-remove-struktura-slice1-design.md:104`)
  travels with it — but is now **partly obsolete**: it demands a netto/brutto mode for the Sekcje
  panel + a toolbar counter; the footer already shows both, and the counter was never built. What
  survives is only "per-section rows are netto-only".
- Correction on the record: the owner recalled this toggle as "already planned". It is not — no
  slice, no issue. EX-426 built a brutto toggle and **deleted** it 2026-07-13 ("no rationale for
  ever hiding Brutto"); that finding stands, though its stated reason (the dsg remount-key cost) has
  itself been superseded.
- **Do not build it before dogfooding this change.** Its premise is that the grid is too wide; the
  owner reports the width is currently tolerable and the shortcut is task-driven, not width-driven.
  Shipped apart, that is testable.

**Settled by `/10x-frame`, belongs outside this change:** **P8 is answered** — VAT/brutto applies to
**all three** price views at the investment's rate (owner: "czytam brutto podwykonawcy"). Move it out
of the OPEN questions in `context/reference/kosztorys-editor-domain-notes.md:298`, and note it
resolves the contradiction between `context/archive/2026-07-10-kosztorys-vat/plan-brief.md:33`
("the client-decision figure") and that slice's shipped `plan.md:232` ("consistent across all three
views") — in favour of the shipped behaviour.

**Corrected by research (2026-07-15)** — this file originally claimed a dsg trap: _"the column set
changes → must go through the grid remount `key`"_. **False.** That rule was superseded by `ee497cb`
(`lessons.md:119-135`): the editor is on the reactive `DynamicDataSheetGrid`
(`kosztorys-editor-body.tsx:7`), the whole remount `key` was deleted, and adding one back would
reintroduce EX-422's flicker. Column-set changes are free. See `research.md` §2 — and note the real
stage-header trap it left behind (dsg keys header cells by **index**; `key={stage.id}` on the
uncontrolled label input is what stops a delete from renaming the wrong stage).

**Not this change:** Open Roadmap Question 12(b) — "suma etapu" (a total ALONG the stage axis). The
sheet has no such formula anywhere (verified: zero `SUM` over `V–AE` across 464 rows), it needs an
owner decision (invoice figure vs payout figure), and it is a different axis from this change's
per-row stage value.

Roadmap: adjacent to S-03 `kosztorys-stages` (in review), but not part of it.
