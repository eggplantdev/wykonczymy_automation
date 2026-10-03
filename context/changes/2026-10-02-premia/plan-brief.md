# Premia (BONUS) — Plan Brief

> Full plan: `context/changes/2026-10-02-premia/plan.md`
> Research: `context/changes/2026-10-02-premia/research.md`

## What & Why

A worker was paid more than their executed work (Roman Pavlovsky, −205,01 zł „nadpłacone"). The owner
wants to close that gap as a premia: it raises what the worker is owed on that investment, and the
investor never sees it.

## Starting Point

There is no premia concept. A cash premia without an investment is booked today as a wypłata without
an investment. „Pozostało do wypłaty" is computed in five places, each reading wypłaty only.

## Desired End State

A „Premia" transfer type (no kasa; worker and investment required). Booking 205,01 sets Roman's pair
to 0,00 on every surface. Marża v2 drops by 205,01. Nothing investor-facing moves. The worker's link
and PDF show a „Premia" line. An overpaid row in „Rozlicz wypłaty" offers a one-click
„Wyrównaj premią"; the Podwykonawcy tab opens that same dialog.

## Key Decisions Made

| Decision                  | Choice                                                           | Why                                                                      | Source               |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------- |
| Mechanism                 | New non-cash type `BONUS`                                        | Only fail-closed design: investor surfaces render named buckets          | Research             |
| Premia without investment | Stays a wypłata without investment                               | BONUS only corrects a pair                                               | Owner (1a)           |
| Worker's view             | Separate „Premia" line                                           | Owner asked for it                                                       | Owner (2)            |
| Booking paths             | General dialog + one-click                                       | Owner asked for both                                                     | Owner (3)            |
| Marża                     | v2 − premia; v1 untouched                                        | v1 already paid it via the wypłata                                       | Research             |
| Financial bucket          | New `bonus`, never `loss`/`discount`                             | Those raise the investor's bilans / print on protokół                    | Research             |
| `due` itself              | Premia kept out of `due`; separate term                          | „Podział etapów" totals must equal „Suma wykonanej pracy"                | Plan                 |
| One-click amount          | Exactly the overpayment, not editable                            | Any other amount goes through the general dialog                         | Plan                 |
| One-click location        | Only inside „Rozlicz wypłaty"; Podwykonawcy tab opens the dialog | Same behaviour everywhere; premia and remaining wypłaty settled together | Owner (2026-10-02)   |
| Race safety               | `lockInvestmentGates` + re-read + stale refusal                  | Same contract as „Rozlicz wypłaty"                                       | Owner (3) / Research |
| Owner's sheet             | Not synced                                                       | Investor can't see it anyway; keeps the frozen column layout             | Research             |
| UI rows/columns           | „Premia" shown only when ≠ 0                                     | Same rule as Rabat in the margin table                                   | Plan                 |

## Scope

**In scope:** type + enum migration; validation; `totalBonus` + marża v2; the five „Pozostało"
sites (pairs → `/pracownicy` / „Rozlicz wypłaty", Podwykonawcy tab, „Rozliczenie z ekipą", listing,
worker link/PDF); the one-click premia in „Rozlicz wypłaty" + a „Rozlicz wypłaty" button on the
Podwykonawcy tab; living docs.

**Out of scope:** BONUS without investment or with a kasa; netting across investments; sheet sync;
a „Premie" figure on `/pracownicy/[id]`; a one-click premia outside the settle dialog; EX-906.

## Architecture / Approach

Accrual vs cash. The kosztorys `due` is the entitlement and PAYOUT is the cash. BONUS is a second
entitlement:

```
Pozostało = due + Σ BONUS − Σ PAYOUT   (per investment × worker)
```

The pair read and the per-investment row query each gain a BONUS sum next to PAYOUT, so one query per
surface still holds. Financials get `totalBonus`, which only marża v2 reads.

## Phases at a Glance

| Phase                      | What it delivers                               | Key risk                                                     |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| 1. Type + bucket           | BONUS bookable, no kasa, marża v2              | Unmapped bucket → `'none'` silently                          |
| 2. „Pozostało" (owner)     | Four sites move together                       | Parity drift between SQL and TS folds                        |
| 3. Worker link/PDF         | „Premia" line                                  | Stale `worker-kosztorys-data` cache                          |
| 4. One-click in the dialog | „Wyrównaj premią" + tab entry point            | Race with a concurrent wypłata; typed amounts lost on reload |
| 5. Docs                    | Glossary, financials doc, AGENTS.md, test-plan | —                                                            |

**Prerequisites:**

- `investments-listing-no-kosztorys-figures` merged to staging first, then branch from staging. It
  touches the same line in `shape-investments.ts`.
- A human runs the prod enum migration before the push.

**Estimated effort:** ~2 sessions.

## Open Risks & Assumptions

- Cache entries that hold a whole `InvestmentFinancialsT` must be bumped. Otherwise `totalBonus` reads
  `undefined` → `NaN` in marża v2 until the cache expires.
- The golden master gains a `totalBonus` field. Its value is 0 everywhere, since the dump has no
  BONUS rows.

## Success Criteria (Summary)

- After „Wyrównaj premią", Roman's pair reads 0,00 on all five surfaces, and their link shows „Premia
  205,01".
- Marża v2 drops by the premia. Marża v1, bilans, kasy, the share link, the offer PDF and the
  protokół are unchanged.
