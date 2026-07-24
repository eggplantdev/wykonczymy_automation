# Tryb mieszany — cash-settlement view (slice B) — Plan Brief

> Full plan: `context/changes/kosztorys-tryb-mieszany/plan.md`
> Shape: `context/changes/kosztorys-tryb-mieszany/shape.md`

## What & Why

The Podsumowanie panel's „Mieszana" axis stops meaning "netto + brutto side by side" and becomes a
**cash-settlement view**: a local per-investment cash-amount input `C` plus a three-row block showing
how much is owed once VAT is re-added to the non-cash remainder. Gives the owner a quick "part cash,
part invoiced" total without touching transactions or bilans.

## Starting Point

The panel already computes `D` = „Do zapłaty" netto (`computeDoZaplatyRM`) and fans a local `moneyAxis`
into its child tables. `'both'` currently renders both netto and brutto columns. Its axis state is
already isolated from the grid's axis, so the panel default can move independently.

## Desired End State

Panel opens on **Netto**. Selecting **Mieszana** shows a netto-only waterfall + „Suma transzy" plus
**Gotówką bez VAT** (editable `C`), **Reszta z VAT** = `(D−C)·(1+VAT)`, **Razem** = `C + (D−C)·(1+VAT)`.
Live recompute as `C` changes; in the client preview the block shows but the input is read-only.

## Key Decisions Made

| Decision              | Choice                                  | Why                                                               | Source |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------- | ------ |
| Cash math             | `Razem = C + (D−C)·(1+VAT)`             | Materiały already netto in `D`, so the complex form collapses     | Shape  |
| Panel default axis    | `net`                                   | Cash view is opt-in, not the landing state                        | Plan   |
| `clientView` behavior | Block visible, input **read-only**      | Client sees the settlement but can't edit                         | Plan   |
| Over-typing `C > D`   | Allowed (no upper clamp)                | Reszta goes negative by design; simpler than clamping             | Plan   |
| Default-const scope   | New panel-scoped `SUMMARY_AXIS_DEFAULT` | Shared `MONEY_AXIS_DEFAULT` drives the grid — must not regress it | Plan   |

## Scope

**In scope:** panel `'both'`→cash-mode branch, netto-only coercion of existing children, cash input +
three-row block, pure settlement helper + unit test.

**Out of scope:** transactions/bilans/margin (owner scope lock), persisting `C`, VAT-aware materiały,
grid axis/columns, the collapsed headline figure.

## Architecture / Approach

Pure helper `computeCashSettlement(D, C, vat)` in `summary-economics.ts`. Panel flips default to `net`,
holds `C` in local state, and when `moneyAxis === 'both'` passes a coerced `displayAxis='net'` to the
existing tables while rendering a new `CashSettlement` component (built on the shared summary-grid
primitives). No server, no schema, no migration.

## Phases at a Glance

| Phase          | What it delivers                                          | Key risk                                                           |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Math helper | `computeCashSettlement` + unit test                       | Trivial; boundary at `C > D`                                       |
| 2. Panel + UI  | Default→net, cash-mode branch, `CashSettlement` component | Coercing children to netto-only without regressing net/brutto axes |

**Prerequisites:** none (branch `konradantonik/ex-536-zaliczka-v2`, slice A already shipped).
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Bilans/transactions divergence is **accepted** (owner scope lock), not addressed here.
- `C` resets on unmount — intentional; persistence is a later slice.

## Success Criteria (Summary)

- Panel opens on Netto; „Mieszana" shows the netto-only waterfall + live cash block.
- Client preview shows the block with a disabled input.
- Net/Brutto axes and the grid are unchanged.
