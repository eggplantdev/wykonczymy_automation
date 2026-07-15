# Kosztorys Progress Percentages — Plan Brief

> Full plan: `context/changes/kosztorys-progress-percent/plan.md`

## What & Why

The kosztorys v2 editor shows stage progress only as money (per-stage netto/brutto values) — there is no percent view of how far along the work is, per stage, per row, per section, or for the whole kosztorys. This adds a values ↔ percent display toggle plus done-% figures at every level, giving the owner a "how's the job going" reading the sheet never had.

## Starting Point

The `kosztorys-netto-brutto-select` change (same branch) just shipped the exact pattern to copy: a display-axis model + global localStorage hook + toolbar `ToggleGroup` + an AND-ed visibility predicate in the column builder. The math primitives (`stageValueForView`, `rowDoneNetForView`, section subtotals with `share`) already exist; no progress figure is rendered anywhere yet.

## Desired End State

A third toolbar toggle (Kwoty / % wykonania) swaps the per-stage value columns for one % column per stage. A "% wykonania" row column is visible by default in both modes. The toolbar shows `Wykonano: 74,6% · 12 400,00 / 16 620,00`, and each section row in the summary panel shows its done %. All computed live, nothing stored.

## Key Decisions Made

| Decision               | Choice                                                            | Why (1 sentence)                                                                              |
| ---------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Percent-mode semantics | Value cols → one % col per stage; qty inputs untouched            | A stage's % is identical for netto/brutto, so a pair would duplicate; editing stays qty-based |
| Row done %             | Regular pickable column, default visible, mode-independent        | The headline per-row figure shouldn't hide behind a display mode                              |
| Counter home           | Toolbar (`ml-auto` cluster)                                       | Always visible while scrolling 1000+ rows                                                     |
| Counter format         | Percent (1 decimal) + done/total values, following the money axis | One glance gives ratio and magnitude                                                          |
| Edge cases             | "—" for 0-denominator; >100% shown raw                            | Dash avoids fake 0%; overshoot flags data-entry errors instead of hiding them                 |
| Toggle persistence     | Global localStorage (`table-columns:` family)                     | Copies the proven `use-money-axis` pattern; a reading preference of the person                |
| Precision              | Integer % in grid cells, 1 decimal in counter/sections            | Readable dense grid, precise headline                                                         |
| Section done %         | In scope                                                          | Nearly free once the helpers exist; completes the progress picture                            |

## Scope

**In scope:** progress-display model + predicate, fraction/aggregation helpers, percent formatters, per-stage % column group, row done % column, toolbar toggle + counter, section done %, unit tests.

**Out of scope:** schema/DB changes, sorting for new columns, editing via %, print/export, per-stage sum row (roadmap 12b), clamping/warning styles, plan-vs-actual panel.

## Architecture / Approach

Copy the netto/brutto-axis architecture: `progress-display.ts` (model + fail-open predicate) → tag map in `constants.ts` → `use-progress-display.ts` (localStorage `useSyncExternalStore`) → third AND-ed filter in `buildV2Columns` → `ToggleGroup` in the toolbar. Fractions are quantity-based (view-independent) in `calc.ts`; done-net aggregations (need stage keys) in `v2-rows.ts` to avoid an import cycle.

## Phases at a Glance

| Phase                            | What it delivers                                   | Key risk                                         |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| 1. Math + model + formatters     | Pure lib with unit tests, no UI                    | Fraction guards (measuredQty=0) wrong            |
| 2. Grid columns                  | % column group, row done %, mode-driven visibility | Column-id prefix collisions / picker interaction |
| 3. Toolbar + counter + section % | User-facing toggle and progress figures            | Toolbar density / cross-surface consistency      |

**Prerequisites:** none — branch `dogfooding/kosztorys-editor-ux` already carries the axis pattern.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes the quantity-based fraction (qtyDone/measuredQty) is the agreed meaning of "% wykonania" — it equals the value share by construction, verified in `calc.ts`.
- Browser-level slice: owes an E2E at the review gate (or an `e2e-backlog` Linear deferral).

## Success Criteria (Summary)

- Toggling Kwoty ↔ % wykonania swaps stage value columns for % columns instantly, persists across reloads, and composes with the picker and money axis.
- Row %, section %, and the toolbar counter agree with a hand-checked dataset; 0-pomiar rows show "—", overshoot shows >100% raw.
- Unit suite, typecheck, and lint green.
