# VAT per investment (netto entry, brutto computed) — Plan Brief

> Full plan: `context/changes/kosztorys-vat/plan.md`
> Research: `context/changes/kosztorys-vat/research.md`

## What & Why

Kosztorys slice S-05. Each investment carries one VAT rate; prices are entered **netto** and
**brutto is computed** (`net × (1 + vatRate)`). Gives the client the tax-inclusive figures a quote
needs, without duplicating the rate per section or item.

## Starting Point

The `vatRate` scaffold already runs end-to-end but is **inert**: threaded through the kosztorys tree
onto every editor row, hardcoded to `0` (`queries/kosztorys.ts:119`), read by no calc. No brutto is
computed anywhere. The investment-level coeff fields (S-04) and their editor persistence path are
the exact pattern this reuses.

## Desired End State

Opening a kosztorys shows a toggleable per-row **Brutto** column and a **Suma brutto** total that
recompute live from netto prices and the investment's rate. A VAT field in the Sekcje panel (shown
as a percent) edits the rate, persists to `investments.vat_rate`, and updates every brutto figure.
Investments without a rate default to 8%.

## Key Decisions Made

| Decision           | Choice                                             | Why                                                                | Source   |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| Rate scope         | One rate per investment, no cascade/override       | Matches roadmap S-05; scaffold already per-investment              | Research |
| Where rate edited  | In the kosztorys editor (Sekcje panel)             | Owner decision; panel is the per-investment settings area          | Plan     |
| Default rate       | 8% (`DEFAULT_VAT = 0.08`)                          | Owner decision (finishing services)                                | Plan     |
| Brutto column      | Toggleable read-only column                        | Owner decision; toggle folded into grid remount key                | Plan     |
| Section summary    | Add grand `Suma brutto`, gated by same toggle      | The tax-inclusive total is the client-decision figure              | Plan     |
| Rate storage/units | Store fraction (0.08), edit/display as percent (8) | Honors `gross = net × (1+vatRate)` contract; % is natural to enter | Plan     |
| Export             | Mirrors current visible state (no special view)    | Settled in POC                                                     | Research |
| Robocizna 23%/8%   | Out of scope (unbuilt today)                       | Flat sum, no net/gross split; future slice                         | Research |

## Scope

**In scope:** `vat_rate` column + Payload field + default; query wiring; brutto computed column
(toggleable); toolbar toggle; in-editor VAT input + persist action; `Suma brutto` grand total; a
brutto unit-test assertion.

**Out of scope:** per-section/per-item rate; robocizna investor-bill VAT; special export view;
per-section brutto lines; surfacing `vatRate` in the investment edit form.

## Architecture / Approach

Backend first (column → collection field → query reads real rate into the tree, which already
denormalizes onto every row). Then editor UI: brutto is a presentation-only `computedColumn` (like
Netto), so nothing new persists per row; the rate persists via a new `updateInvestmentVatAction`
mirroring the coeff handler (optimistic `patchRows` + `router.refresh()`). The brutto toggle enters
the dsg remount `key`.

## Phases at a Glance

| Phase                    | What it delivers                                   | Key risk                                            |
| ------------------------ | -------------------------------------------------- | --------------------------------------------------- |
| 1. Schema + query wiring | `vat_rate` column, field, default, real tree value | Hand-written migration; human applies to prod first |
| 2. Editor UI             | Brutto column + Suma brutto + in-editor rate input | dsg column-freeze — toggle must be in remount key   |

**Prerequisites:** S-01 (done). Phase 2 requires the Phase-1 migration applied to prod first.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Input-placement (VAT field in the Sekcje panel; toggle in the toolbar) is a plan-level choice —
  open to change at plan review.
- Whether the brutto toggle state should persist per-investment (like `usePriceView`) or be local —
  decided at implement time; low stakes.

## Success Criteria (Summary)

- Rate 8% → netto 100.00 shows brutto 108.00; `Suma brutto` = `Suma netto × 1.08`.
- Toggling brutto cleanly hides/shows both surfaces; rate edits persist across reload.
- Brutto consistent across all three price views; no regressions to netto/coeffs/stages/autosave.
