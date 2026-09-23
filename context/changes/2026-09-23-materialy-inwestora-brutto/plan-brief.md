# Materiały w widoku inwestora — Plan Brief

> Full plan: `context/changes/2026-09-23-materialy-inwestora-brutto/plan.md`
> Research: `context/changes/2026-09-23-materialy-inwestora-brutto/research.md`

## What & Why

On the investor pages, the Materiały tab exposes how a netto invoice is billed: a separate
„Materiały wykończeniowe netto" row in „Wydatki inwestycyjne" and a brutto / netto tab split in the
wydatki list. The investor should see categories and brutto prices only; the manager keeps the full
picture.

## Starting Point

Both investor pages (`/k/<token>`, „Podgląd dla inwestora") render the same tab as the manager, told
apart only by a `preview` prop that already hides the settled table and settled rows. Netto rows come
from the data layer as a separate block sharing their category's id.

## Desired End State

Investor pages: „Wydatki inwestycyjne" has one row per category (budowlane / wykończeniowe /
pozostałe) + Razem, columns unchanged; „Lista wydatków" is one list in brutto with Razem = Σ brutto
and a „Materiały" zip. Manager view unchanged.

## Key Decisions Made

| Decision                    | Choice                                           | Why                                                | Source              |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------- | ------------------- |
| Categories in the breakdown | merged per category, investor only               | hides the netto mechanics                          | Research (owner)    |
| List total                  | Σ brutto, ≠ billed „Materiały"                   | gap is always in the investor's favour             | Research (owner Q1) |
| Breakdown columns           | unchanged (Netto/Brutto/Różnica or Kwota)        | only rows were the ask                             | Research (owner Q2) |
| No-stawka breakdown         | keep netto invoice at its netto (A)              | ties to Podsumowanie; gap favours investor         | Research (owner Q3) |
| Settled netto invoice       | stays in the investor list                       | it is still billed                                 | Research (owner Q5) |
| Zip / list label            | generic „Materiały"                              | no brutto/netto wording                            | Research (owner Q6) |
| Audience gate               | `preview` only, not the editor's „Inwestor" view | column view ≠ audience (lessons.md:471)            | Plan                |
| Merge point                 | after pricing, in a pure lib helper              | a merged category is half rate-driven, half frozen | Plan                |
| E2E                         | rewrite client-share spec now, owner runs it     | guard ships with the change                        | Plan                |

## Scope

**In scope:** breakdown merge helper + table prop; netto row label bare in the builder; single brutto
list in preview; node + DOM specs; client-share E2E rewrite; domain notes.

**Out of scope:** manager view, SQL/queries/cache, payload stripping, running `pnpm test:e2e`.

## Architecture / Approach

Raw rows → `breakdown-rows.ts` (price each with `breakdownRowPair`, optionally sum per category) →
table sums priced pairs. The list branches on its existing `preview` prop into one dataset with the
brutto column and a Σ `amount` footer.

## Phases at a Glance

| Phase                     | What it delivers                         | Key risk                                                    |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| 1. Breakdown per category | one row per category for the investor    | label move breaks builder specs (planned)                   |
| 2. One brutto list        | single list, Σ brutto, „Materiały" zip   | virtualized body not testable in jsdom → header/footer only |
| 3. E2E + docs             | client-share guard follows the new shape | unrun until the owner runs it                               |

**Prerequisites:** `zamrozone-brutto-wydatku-netto` (netto rows carry `recordedGross`) — committed on this branch.
**Estimated effort:** one session, three small phases.

## Open Risks & Assumptions

- Category order in the merge follows Polish `localeCompare` on names, assumed to match the DB's name
  ordering for the three real categories.
- The investor payload still contains the split rows (render-side change only) — accepted.

## Success Criteria (Summary)

- An investor never sees a „… netto" row or a netto column in the list.
- Breakdown Razem still equals „Materiały" in Podsumowanie; list Razem = Σ brutto.
- The manager sees exactly what they see today.
