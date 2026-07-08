# Kosztorys — sections + items with live totals (S-01) — Plan Brief

> Full plan: `context/changes/kosztorys-sections-items/plan.md`
> Scope decisions: `context/changes/kosztorys-sections-items/change.md`
> POC decision register: `context/changes/kosztorys-mvp/change.md`

## What & Why

Build the north-star slice of the off-sheets arc: the first owner-visible proof that a
kosztorys can live in the app instead of Google Sheets. An additive in-app editor for one
investment's **sections + items** with **live row/section/grand totals**. Motivation: the owner
works across two worlds (Sheets for the plan, app for actuals) and keeping them in sync is "a
crazy pain"; this slice starts replacing the sheet as the authoring surface.

## Starting Point

No in-app editor exists on `main` — the kosztorys is Google-Sheet-backed (iframe + one-way
mirror). A **complete, tested POC exists on branch `poc-kosztorys-in-app`** (pure calc core +
editor + collections). This slice ports that tested core to `main`, trimmed to the S-01 surface.

## Desired End State

A Manager+ user opens an investment's new "Kosztorys" tab and authors sections + items in a
spreadsheet-like grid — add/rename/delete/filter sections; add/inline-edit/delete/reorder items;
toggle three price views — watching totals recompute live, with per-field optimistic autosave.
No Google Sheet involved. The "Arkusz" tab still works for sheet-backed investments.

## Key Decisions Made

| Decision                 | Choice                                                | Why                                                                                                         | Source  |
| ------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- |
| Price model              | Coefficient model now (absorbs S-11)                  | Client price = snapshot, two subcontractor views derived; lets us port the POC's _final_ calc core verbatim | Plan    |
| Three price views        | Folded in (S-03)                                      | Avoid a schema reshape later                                                                                | Plan    |
| VAT                      | Out (stays S-12) — netto only                         | Keep the slice bounded; `rowGross` ported but unwired                                                       | Plan    |
| Stages / rooms / export  | Out (S-04 / cut / S-07)                               | North star is sections+items+totals only                                                                    | Roadmap |
| Table implementation     | Payload collections                                   | Matches POC + rest of app; free types + admin + hooks                                                       | Plan    |
| Reorder persistence      | Immediate 2-write swap (`swapItemOrderAction`)        | Honors "writes = real change"; no N-write dławik at 1000+ rows                                              | Plan    |
| Tests                    | Unit the pure core now; E2E → S-08                    | Risk lives in calc + state model; cheapest real signal                                                      | Plan    |
| Delete / reorder / order | Hard-delete; ▲▼ within-section; `display_order` layer | POC decision register                                                                                       | POC     |

## Scope

**In scope:** two additive tables (`kosztorys_sections`, `kosztorys_items`) + coefficient
columns on `investments`; ported calc/row core + unit tests; server actions + tree query; dsg
editor with three-view toggle, ▲▼ reorder, optimistic autosave; investment-page tab; access
gating.

**Out of scope:** stages/etapy, VAT, rooms, catalogue, CSV/print export, undo, column-locking,
drag-drop/cross-section move, browser E2E, any change to transfers/balances/marża/sheet mirror.

## Architecture / Approach

Port-first, bottom-up. Read POC source with `git show poc-kosztorys-in-app:<path>`. Flat
`react-datasheet-grid` (row = item, section = denormalized column); values **computed, never
stored** (only inputs persist) via pure `calc.ts`/`v2-rows.ts`. Mutations through
`protectedAction` + `updateTag`; reads via `getDb` + `sql`. Layers: schema → tested calc core →
actions/query → editor UI → page wiring, each verifiable before the next.

## Phases at a Glance

| Phase                    | What it delivers                                    | Key risk                                               |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| 1. Schema + collections  | Additive migration + 2 Payload collections + coeffs | Hand-written migration correctness (no migrate:create) |
| 2. Port tested calc core | `calc.ts` + `v2-rows.ts` + types + unit tests green | Trimming VAT/stages without breaking pure fns          |
| 3. Actions + query       | tree read + section/item mutations + swap           | Ordering by `display_order` for correct reorder        |
| 4. Editor UI             | dsg grid + view toggle + reorder + autosave         | **dsg freezes columns at mount** — remount `key`       |
| 5. Page wiring + verify  | "Kosztorys" tab, gated, coexists with "Arkusz"      | Not touching the financial/mirror planes               |

**Prerequisites:** none (parallel with F-01). Access to `poc-kosztorys-in-app` branch; local
docker DB on 5433.
**Estimated effort:** ~4–5 sessions across 5 phases.

## Open Risks & Assumptions

- Porting the POC editor trimmed of stages/VAT/export may leave dangling refs — typecheck each
  phase.
- Adding `react-datasheet-grid` can trip the lightningcss-arch CSS build on this arm64 mac
  (repair: `pnpm install --force` + `rm -rf .next`).
- The dsg remount-key gotcha silently no-ops features if a dimension is omitted — the lesson is
  ported forward and manual verification explicitly checks the view toggle.
- Assumption: netto-only totals are acceptable for this slice (VAT lands in S-12).

## Success Criteria (Summary)

- Owner authors sections + items in-app on a test investment; row/section/grand totals match
  hand computation and update live.
- Three price views recompute correctly; ▲▼ reorder and optimistic autosave (with revert)
  behave.
- Financial core + sheet mirror provably unchanged; EMPLOYEE has no access; pure core unit-tested
  and green.
