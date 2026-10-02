# Investments listing shows real v2 figures without a kosztorys — Plan Brief

> Full plan: `context/changes/2026-10-02-investments-listing-no-kosztorys-figures/plan.md`
> Research: `context/changes/2026-10-02-investments-listing-no-kosztorys-figures/research.md`

## What & Why

The Inwestycje listing prints „brak danych" on every v2 column for an investment without a
kosztorys. Owner ruling 2026-10-02: such an investment is legitimate (e.g. Kijowska 17, settled on
materials only), so it must show real figures.

A second source of confusion is fixed in the same pass. The bilans column the tryb doesn't build says
„nie dotyczy"; it should say why.

## Starting Point

The gate is display-only, in `src/components/tables/investments.tsx`. Every figure behind it is
already computed: robocizna 0 zł, bilans and marża v2. The investment page's Podsumowanie never
withholds, so the listing currently disagrees with it.

## Desired End State

An investment without a kosztorys shows on the listing:

- the real Bilans netto/brutto v2;
- Robocizna v2 = 0,00 zł, with the rozjazd icon where v1 has robocizna;
- the real Marża v2;
- „brak kosztorysu" under „Pozostało do wypłaty".

The bilans column outside the tryb names the tryb („rozliczenie brutto" / „netto" / „mieszane").
Neither „brak danych" nor „nie dotyczy" remains on the listing.

## Key Decisions Made

| Decision                                              | Choice                                                   | Why                                                          | Source                                 |
| ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| Bilans v2, Robocizna v2, Marża v2 without a kosztorys | Real figures                                             | Materials-only investments are legitimate; matches the panel | Research (owner)                       |
| Legacy robocizna booked only as transfers             | Accept a v2 bilans without it; the rozjazd icon flags it | v1 vs v2 IS the source choice; the gap is the to-do list     | Research (owner)                       |
| „Pozostało do wypłaty" without a kosztorys            | Still withheld, text „brak kosztorysu"                   | The kwota would only reprint wypłaty with a minus            | Research + Plan (owner picked wording) |
| Kosztorys with no executed etapy                      | −wypłaty stays                                           | A real zaliczka; the panel says „Nadpłata"                   | Research (owner)                       |
| „nie dotyczy" on the other bilans                     | Name the tryb, from `settlementModeLabel`                | Say why, not just that it doesn't apply                      | Plan (owner)                           |
| Worker pairs / „Rozlicz wypłaty"                      | Untouched                                                | Follows from keeping the „Pozostało" withhold                | Research                               |
| Test layer                                            | New DOM spec, written failing first                      | Render-only bug; AGENTS.md mandates test-driven debugging    | Plan                                   |

## Scope

**In scope:**

- the listing's cells and sort accessors;
- header tooltips, row-type JSDoc and code/spec comments;
- AGENTS.md, `investment-financials-and-discount.md` and a note on the old manual check;
- the new DOM spec.

**Out of scope:**

- `shape-investments.ts` logic and `worker-payout-pairs.ts` SQL;
- the investment panel and v1 columns;
- backfilling legacy robocizna;
- other „nie dotyczy" uses in the app.

## Phases at a Glance

| Phase                           | What it delivers                                       | Key risk                                                              |
| ------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| 1. Failing spec, then the cells | Real figures, „brak kosztorysu", tryb names; DOM guard | Sort order changes for no-kosztorys rows (intended, asserted)         |
| 2. Reverse the rule everywhere  | Tooltips, JSDoc, comments and docs match the cells     | A leftover sentence lets the old rule be re-derived (lessons.md:1596) |

**Prerequisites:** none.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- 11 active legacy investments will show a v2 bilans that jumps toward „overpaid". The owner accepted
  this; the rozjazd icon is the flag.

## Success Criteria (Summary)

- Kijowska 17 reads Bilans netto v2 = −Wydatki inwestycyjne, Robocizna v2 0,00 zł and
  „brak kosztorysu" under „Pozostało".
- No „brak danych" / „nie dotyczy" anywhere on the listing.
- The new DOM spec fails on the old source and passes on the new one.
