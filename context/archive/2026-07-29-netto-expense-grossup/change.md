---
change_id: netto-expense-grossup
title: Netto expense — invert the derivation, brutto computed from the materials rate
status: archived
created: 2026-07-29
updated: 2026-08-08
archived_at: 2026-08-08T14:47:35Z
branch: null
worktree: null
---

## Notes

Invert the derivation for netto expenses (`netBilled`): netto is the input, brutto = netto × (1 +
materials rate). Before this, the type entered at face value on both axes (netto === brutto).

It touches three places:

- the „Wydatki inwestycyjne" table (`materials-breakdown-table.tsx`) — the Brutto column
- `materialsPair` (`src/lib/kosztorys/summary-economics.ts`) — the „Materiały" row in the summary and,
  through it, „Do zapłaty"
- `deriveFinancials` (`src/lib/db/investment-financials.ts`) — `totalMaterialCosts`, margin, balance

**This changes how the settlement is computed, not how it is presented** — it moves the amount the
investor sees as owed. It must be documented (owner, 2026-07-29).

> **Superseded (2026-09-23, change `zamrozone-brutto-wydatku-netto`, `62da512b`):** a netto expense's brutto is
> now the invoice's stored `amount`, frozen at booking — not netto × rate at read time
> (`summary-economics.ts`, `netBilled` is frozen).

Settled during planning (2026-07-29):

- **Scope: the v2 panel only.** v1 (balance, „Koszty inwestora", the listing's category columns, the
  „Korekta (bez kategorii)" tile) is knowingly left diverged and goes in a separate change — it has no
  money axis at all (`totalMaterialCosts` adds brutto receipts to netto amounts in one scalar), so
  fixing one component inside a wrong sum would move the balance by an amount nobody can explain.
  Owner's decision.
- **The table is wrong regardless of settlement mode.** The Brutto column rendered `row.net` without
  checking `origin`, so a netto row showed its netto amount. A presentation defect, fixed
  unconditionally.
- **Rate in the table:** the same one that governs the Netto column (`materialsNetRate ?? vatRate`) —
  brutto = netto × (1+r) is the inverse of netto = brutto ÷ (1+r).
- **Gross-up in the settlement:** ~~only when `settlementMode === 'GROSS'`~~ — **changed during
  implementation (owner, 2026-07-29)**: gross-up always applies, with one rate. The same rate crosses
  the bridge both ways; the direction follows from which plane the expense was recorded on.
- **The materials rate is the ONLY thing that crosses a netto-billed expense — no rate, no crossing,
  on either axis** (owner, 2026-08-07). With no rate saved the investor is billed the receipt, so a
  netto twin would print an amount nobody owes. This overrides the `vatRate` fallback above.
- ~~`computeMixedSettlement` needs no change — it grosses up only the unsettled amount.~~ **False,
  overturned at the whole-branch review (2026-08-07).** „Pozostało brutto" was computed by grossing up
  the net remainder, which applied VAT to materials too — but materials enter „Łącznie" at face value
  on both axes, so the same debt printed twice on one screen, differing by exactly the VAT on the
  materials. The remainder is now derived from the pair that already has the split right:
  `combined.gross − paid` (see the `summary-economics.ts` comment, "owner 2026-08-20"). Only mixed
  mode with brutto-axis materials moved, and it moved **down** — no client was ever undercharged. The
  old fixture passed `materialsNetRate === vatRate`, which is why the bug hid.
- `buildMaterialyBreakdown` and `netCategoryCosts` unchanged — the Σ invariants are asserted on
  `row.net`, which is not touched.

No migration: `investments.vat_rate` is `NOT NULL DEFAULT 0.08`.

## Side changes (review 2026-08-07)

- ~~**The „Marża" tab is hidden** (`TODO(EX-649)`)~~ — parked because the tab read the transactions
  plane while sitting in the kosztorys panel.

  > **Superseded (`30791066`, `2026-08-18-marza-prognoza-rzeczywista`):** the tab is back, carrying
  > the forecast and actual margin.
- **Settlement: both money columns stand in every mode** — the mode decides the „Do zapłaty"
  arithmetic, not which columns exist. The client view (`preview`) included (owner ruling).
- **The materials-rate control is ~~hidden~~ greyed out in brutto mode** (reversed in `3975ffc3`) —
  the server zeroes the concession there (`investment-financials.ts`), so a typed rate would save and
  move no figure. Hiding was reverted: a vanishing control reads as a bug, so it stays and says why
  (`MATERIALS_GROSS_LOCK_REASON`). Both surfaces that offer it — the „Opcje rozliczenia" popover and
  the „Wydatki" tab — get the same lock and the same **effective** rate, so they can't show two
  answers to one setting.
