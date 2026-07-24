# Shape — tryb mieszany (rozliczenie gotówkowe) w Podsumowaniu kosztorysu (slice B)

Resolved shape from the owner discussion (2026-07-22). Slice B of the kosztorys zaliczka v2 arc,
continues on branch `konradantonik/ex-536-zaliczka-v2` after slice A (materiały netto/brutto) shipped.
Supersedes the open resolutions in `context/changes/kosztorys-zaliczka-v2/braindump.md` §64–82.

This is the input to `/10x-plan` — every domain decision below is confirmed with the owner.

## What we're building

The „Mieszana" view in the Podsumowanie panel becomes a **cash-settlement view**: a per-investment
input for the amount to be paid in cash without VAT, and a three-row settlement block deriving the
total owed once VAT is re-added to the non-cash remainder.

## The math (confirmed)

```
Do zapłaty netto     = D          (robocizna + materiały + po wpłatach — all treated as netto)
Gotówką bez VAT      = C          (input, 0 … D)
Reszta z VAT         = (D − C) × (1 + VAT)
Razem do zapłaty     = C + (D − C) × (1 + VAT)
limit:  C ≤ D
```

- `D` is the existing „Do zapłaty" **netto** figure from the waterfall (`computeDoZaplatyRM`, already
  net of wpłaty). No new source.
- The braindump's more complex `((D − C) − Mn) × (1+VAT) + Mb` is **algebraically identical** to the
  uniform `(D − C) × (1+VAT)` because materiały brutto = materiały netto × (1+VAT) (one VAT rate).
  The Mn/Mb terms cancel — so we use the simple uniform form.

### Materiały — confirmed simplification

In the Netto axis the app **already** bills materiały at netto (= brutto ÷ (1+VAT)) even though
materiały were purchased brutto — the client pays materiały netto today. The mixed view inherits the
same `D` and treats materiały identically: **just netto, no special case**. This is the accepted
source of the bilans divergence, deferred to the later VAT-aware transactions slice. Because materiały
are netto in `D`, the cash cap is plain `C ≤ D` (no materiały carve-out).

## Resolved decisions

1. **Input** — local in the panel, default `0`, held per-investment **locally only** (no persistence,
   same as slice A's local state). **Never visible in the client-preview view** (`clientView`).
2. **„Mieszana" toggle** — its current meaning (netto + brutto side by side) is **replaced** by this
   cash-settlement view. No separate cash control; „Mieszana" _is_ the cash view.
3. **Layout in „Mieszana"** — netto-only, single amount column (no netto/brutto pairs):
   - the Podsumowanie waterfall (Robocizna / Materiały / Łącznie / Wpłaty / Do zapłaty netto = `D`)
     shown netto-only,
   - then the three cash rows: **Gotówką bez VAT** (`C`, the input) / **Reszta z VAT** / **Razem**,
   - **Wpłaty** still shown normally,
   - **Suma transzy** per etap still shown, but with **netto** amounts in this mode.

## Scope lock (owner, verbatim — unchanged from slice A)

Do NOT touch `src/lib/db/investment-financials.ts`, `calculate-balance.ts`, `calculate-margin.ts`, or
the transactions model. Bilans won't reconcile — **accepted, not a bug**. Mixed view is netto-only.
Persisting the cash amount + making transactions/bilans VAT-aware is the **next** slice.

## Anchors in code (verify before editing)

- `src/components/kosztorys/kosztorys-totals-panel.tsx` — owns the `moneyAxis` ToggleGroup
  (`'both'` = „Mieszana") and `computeDoZaplatyRM`; the cash input's home. **Owner may have in-flight
  work here — re-check `git status`, stage by explicit path only.**
- `src/components/kosztorys/kosztorys-summary.tsx` — the Podsumowanie waterfall block.
- `src/components/kosztorys/summary-totals-table.tsx` — Wpłaty → Do zapłaty → rabat rows.
- `src/components/kosztorys/kosztorys-stage-totals.tsx` — „Suma transzy" per etap.
- `src/lib/kosztorys/summary-economics.ts` — `computeDoZaplatyRM` (source of `D`), `MoneyPairT`.
- `src/lib/kosztorys/money-axis.ts` — `MoneyAxisT` / `axisShows` (`'both'`).

## Next step

`/10x-plan kosztorys-tryb-mieszany`
</content>
