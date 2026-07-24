# Materiały netto/brutto in Podsumowanie (slice A) — Plan Brief

> Full plan: `context/changes/kosztorys-zaliczka-v2/plan.md`
> Braindump: `context/changes/kosztorys-zaliczka-v2/braindump.md`

## What & Why

„Materiały" in the kosztorys Podsumowanie is currently treated as a no-VAT figure (netto === brutto).
That's wrong: materiały are recorded as **brutto** transactions, so netto must be derived by
subtracting VAT (`netto = brutto / (1+VAT)`) — the inverse of robocizna. This slice makes the
Podsumowanie show correct netto/brutto for materiały across the whole waterfall.

## Starting Point

`summary-economics.ts` has `moneyPair` (net-native, for prace) and `faceValue` (no-VAT, currently used
for materiały). The materiały amount is a server prop from `financials.totalMaterialCosts`. Category
rows render via `summaryLineFace` + `noBrutto`. The prop is inconsistently named `materialsNet` /
`materialyNet` through the chain.

## Desired End State

In Netto axis, „Materiały", every category row, Łącznie, and Do zapłaty show `brutto/(1+VAT)`; in Brutto
axis they show the raw amount — the columns differ by exactly the VAT. A hint on materiały rows states
the formula and signals the inverted VAT direction. Financials/bilans untouched.

## Key Decisions Made

| Decision              | Choice                                            | Why                                                                                              | Source    |
| --------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------- |
| Flag vs always-brutto | Always brutto (no flag)                           | Materiały are brutto transactions; the flag belongs to the persistence slice                     | Plan      |
| Waterfall depth       | Full waterfall (Materiały + Łącznie + Do zapłaty) | Headline and totals stay consistent per axis — one truth                                         | Plan      |
| Phasing               | Single phase                                      | Tooltip is small; clean unit-test boundary on the economics functions                            | Plan      |
| Prop name             | Unify to `materialsGross`                         | Fixes the net→gross lie and the `materialsNet`/`materialyNet` split at the sites already touched | Plan      |
| Reconciliation        | Accept divergence from investment page            | Owner: won't reconcile until the persistence slice adds per-transaction VAT                      | Braindump |

## Scope

**In scope:** gross-native money constructor (`grossPair`); materiały-VAT-aware `computeSummarySplit` +
`computeDoZaplatyRM`; breakdown rows + Łącznie + Do zapłaty derive from the pair; formula hint; prop
rename to `materialsGross`; economics unit tests.

**Out of scope:** financials/bilans/transactions model; per-investment netto/brutto flag; cash
settlement / tryb mieszany; persistence; renaming the financials-layer `MaterialyBreakdownRowT.net`.

## Architecture / Approach

Add `grossPair(gross, vat)` mirroring `moneyPair`, thread the materiały amount as **gross** through the
two waterfall functions (deriving netto internally), update the two rendering surfaces (breakdown rows +
a decoupled `hint` opt on `SummaryRow`), and rename the prop chain. Pure-function unit tests are the
automated gate.

## Phases at a Glance

| Phase                         | What it delivers                                                        | Key risk                                                                        |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Materiały as brutto + hint | Full waterfall shows derived materiały netto/brutto with a formula hint | `kosztorys-totals-panel.tsx` may hold parallel in-flight work — stage carefully |

**Prerequisites:** none — presentation-only, no schema.
**Estimated effort:** ~1 session, single phase.

## Open Risks & Assumptions

- The Podsumowanie intentionally stops matching the investment page's flat materiały figure — accepted,
  not a bug.
- `kosztorys-totals-panel.tsx` rename must not clobber a parallel session's edits — re-check `git status`.
- `MaterialyBreakdownRowT.net` field keeps its (now-misleading) name — reinterpreted at the boundary,
  debt noted for the persistence slice.

## Success Criteria (Summary)

- Materiały figures derive correctly in both axes, differing by VAT, consistent through Łącznie and Do
  zapłaty.
- Formula hint present and correct.
- Economics unit tests green; robocizna figures unchanged.
