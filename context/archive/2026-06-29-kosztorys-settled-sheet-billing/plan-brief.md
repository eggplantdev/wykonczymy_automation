# Settled (R+M) Expenses — Kosztorys/Sheets Billing Fix — Plan Brief

> Full plan: `context/changes/kosztorys-settled-sheet-billing/plan.md`
>
> ⚠️ **Superseded 2026-06-29:** design changed to a **separate `rozliczone R+M` tab** (not a
> trailing column). The details below are stale — see `plan.md` for the current design.

## What & Why

`settled` expenses ("Materiały wliczone w robociznę" — R+M material the company absorbs) must
not be billed to the client. The app already excludes them from marża/bilans, but the Google
Sheets materiały tab mirrors them as ordinary billed rows (amount in column E), so the client's
`SUM(E:E)` / `SUMIF` totals charge them anyway — the opposite of intended. This fixes the
Sheets side (FAZA 2), re-planned against current code.

## Starting Point

The Sheets layer has zero `settled` awareness. `expenseRow` writes the full amount into
column E for every expense; `loadAppRows` selects by type only. The expenses tab is
column-mapped (A–G data, summary block starting at column H), and `setupTab` clears+rebuilds the
tab on the owner's manual reset. Live footprint: ~2 sheets, 3 settled rows.

## Desired End State

On a reset sheet, a settled expense shows `kwota`=0 (so client formulas exclude it), its real
amount in a new far-right "rozliczone R+M" column, and a `RAZEM rozliczone` total in the summary
block. Cancelling a settled row removes it cleanly with totals intact. On not-yet-reset sheets,
settled rows still get E=0 on next sync (billing fixed everywhere) and nothing throws.

## Key Decisions Made

| Decision                  | Choice                                                       | Why (1 sentence)                                                                           | Source |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------ |
| Exclude from client bill  | Write `kwota`=0 in column E (not empty)                      | `SUM`/`SUMIF` add 0 → auto-excluded, no formula edits                                      | Plan   |
| Settled-amount visibility | Trailing data column **after** the summary block             | Owner wants it on the sheet; far-right keeps existing totals' positions                    | Plan   |
| Where the total lives     | `RAZEM rozliczone` appended **inside** the summary block     | Row 3 = first data row, so a data column can't also hold a total — mirror `RAZEM=SUM(E:E)` | Plan   |
| Trailing column type      | Config-described, **not** a `fieldMatchers` field            | Keeps `resolveHeaders` from throwing on old sheets and keeps summary position stable       | Plan   |
| Column name               | `"rozliczone R+M"`                                           | Avoids the `kwota` matcher trap (`sheets.ts:40`)                                           | Plan   |
| Settled types covered     | Both INVESTMENT_EXPENSE and CORRECTION                       | Mirrors app's `totalSettled` bucketing                                                     | Plan   |
| Removal handling          | Second `deleteRange` on the trailing column, ROWS shift      | Otherwise the amount orphans and keeps counting in `RAZEM rozliczone`                      | Plan   |
| Rollout                   | Owner-driven per-sheet reset → reconcile; no sweep/migration | Only ~2 sheets; avoids risky mass mutation of live client data                             | Plan   |
| App calculations          | Untouched                                                    | FAZA 1 (marża/bilans) is already correct                                                   | Plan   |

## Scope

**In scope:** E=0 routing for settled rows; trailing "rozliczone R+M" column + `RAZEM
rozliczone`; removal-path correction; unit tests + manual verification script.

**Out of scope:** any app-side calc change; automatic/bulk reset; migration script; per-type
settled breakdown; transfers-tab changes.

## Architecture / Approach

Phase 1 (LOW risk): thread `settled` through `TxDocT` → `expenseRow`; settled rows write E=0 and
expose the real amount as `settledAmount`. This alone fixes over-billing on next sync. Phase 2
(the MEDIUM-risk weight): a config-described trailing summed column — `setupTab` writes its
header + appends `RAZEM rozliczone = SUM(col)` to the summary block; the write path emits each
row's settled amount when the column exists; the remove path adds a second disjoint `deleteRange`
so totals/alignment survive cancellation. Phase 3 locks it with tests + a manual script.

## Phases at a Glance

| Phase                      | What it delivers                                   | Key risk                                      |
| -------------------------- | -------------------------------------------------- | --------------------------------------------- |
| 1. Row routing (E=0)       | Billing fix everywhere on next sync                | Low — pure row builder + DB field             |
| 2. Trailing column + total | On-sheet visibility, correct totals, clean removal | Removal-path alignment; live Sheets layer     |
| 3. Verify                  | Unit tests + manual regression script              | No Sheets mock harness (manual for API paths) |

**Prerequisites:** a test investment with a linked sheet (never test on live client sheets).
**Estimated effort:** ~1–2 sessions; Phase 1 is small, Phase 2 carries the care.

## Open Risks & Assumptions

- The Sheets API paths (`setupTab`, batched write/remove) have no mock harness → those criteria
  are manual.
- Assumes the owner reconciles affected sheets after reset (they already do this).
- Per-transfer auto-sync writing E=0 when a settled row is edited is existing per-row behavior,
  not a sweep — accepted.

## Success Criteria (Summary)

- Client `SUM(E:E)` / `SUMIF` totals never include settled amounts.
- `RAZEM rozliczone` equals the signed sum of settled amounts and survives add/cancel/toggle.
- Un-reset sheets are corrected for billing and never throw.
