# Etap Tool-Plane Assignment — Plan Brief

> Full plan: `context/changes/etap-tool-plane/plan.md`

## What & Why

Each etap gets a plane — z narzędziami or bez narzędzi — because in reality one crew type executes an etap (OR), while today both subcontractor views claim 100% of the executed work repriced at their own price (AND). „Podsumowanie podwykonawców" currently shows two contradictory „Suma wykonanej pracy" totals depending on the active view; both are lies on a mixed investment.

## Starting Point

An etap is `{ ordinal, label }` with no plane concept. The price-view toggle only reprices — `subcontractorDueNet` sums all etapy at the active view's price. The settlement is editor-only (no server-side computation, share pages never render it), and wypłaty are one investment-level pool per worker.

## Desired End State

The etap header shows and sets its plane (same wrench icons as the view toggle). „Podsumowanie podwykonawców" is identical in both subcontractor views: Z narzędziami / Bez narzędzi / Suma wykonanej pracy (each etap at its **own** plane's price), minus the one shared wypłaty pool → an honest „Pozostało do wypłaty" on mixed investments. Unconfirmed etapy default to z narzędziami with a visible `TriangleAlert` on the header and in the summary.

## Key Decisions Made

| Decision                                    | Choice                                                   | Why (1 sentence)                                                                 | Source  |
| ------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- | ------- |
| Plane granularity                           | Per etap, OR relationship                                | One crew executes an etap; per-view repricing of everything is the bug           | Shaping |
| Default                                     | z narzędziami, `null` = unconfirmed + warning            | Old/new data keeps working; the warning forces eventual confirmation             | Shaping |
| Settlement shape                            | One combined view-independent figure, split + razem rows | Shared wypłaty pool is the whole point — one honest „Pozostało"                  | Shaping |
| Wypłaty                                     | Shared pool, no plane attribution                        | Owner decision; per-crew attribution would need new data entry                   | Shaping |
| Other-plane columns in a subcontractor view | Value cells „nie dotyczy", qty stays editable            | Progress entry is plane-independent; only money was lying                        | Plan    |
| Grid Razem/Pozostało readouts               | Stay view-repriced (pricing workspace)                   | Minimal surface; the settlement panel is the one honest money                    | Plan    |
| Warning badge                               | New sibling of `ReconMismatchBadge`                      | Same look; the recon badge's aria-label is E2E-asserted and means something else | Plan    |
| Confirmation persistence                    | Nullable `plane` column, explicit pick writes value      | No separate `confirmed` flag needed                                              | Plan    |

## Scope

**In scope:** migration + collection field, `KosztorysStageT.plane` threading (tree, snapshot insert), `setStagePlaneAction`, plane-aware pre-rabat settlement (TDD), header picker/icon/warning, „nie dotyczy" value cells, rebuilt summary block.

**Out of scope:** wypłaty/worker plane attribution, plane-filtering grid Razem/Pozostało, any klient-view or client-share change, `stageTotalsForView` / „Suma transzy", presets, E2E (review-gate / backlog).

## Architecture / Approach

Nullable `plane` rides `KosztorysStageT` from Payload → tree → editor state → snapshots. One new pure function `subcontractorDueByPlane(rows, stages)` owns the money (per-stage pre-rabat = `qty × viewPrice(row, plane)` — linear, no share-splitting, rabat never reaches subcontractors); a shared `stageAppliesToView` helper keeps the grid's „nie dotyczy" rule and the math from disagreeing.

## Phases at a Glance

| Phase                    | What it delivers                                | Key risk                                                    |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------- |
| 1. Data layer            | Column, type threading, snapshot insert, action | Raw `INSERT` in restore path silently dropping the column   |
| 2. Settlement math (TDD) | `subcontractorDueByPlane` + hook wiring         | Rabat/override edge cases in the pre-rabat identity         |
| 3. Header UI             | Picker, plane icon, `TriangleAlert`             | Optimistic patch + revert on action failure                 |
| 4. Grid „nie dotyczy"    | Honest per-etap value cells/footers             | dsg stable-`component` rule (cell remounts drop keystrokes) |
| 5. Summary rebuild       | Split + razem + warning badge                   | Prop-chain rename touching editor body/panel                |

**Prerequisites:** local dev DB up (`docker compose up -d`); seeded kosztorys for manual checks.
**Estimated effort:** ~2–3 sessions across 5 phases.

## Open Risks & Assumptions

- Assumes no server-side consumer of the subcontractor settlement appears mid-change (verified none exists today).
- Old snapshots restore with `plane = null` → everything re-warns after a restore; accepted (kosztorys data is throwaway until dogfooding lands).

## Success Criteria (Summary)

- „Suma wykonanej pracy" is identical in Z and Bez views and equals the hand-computed per-plane sum on a mixed investment
- Warning visible on every unconfirmed etap and in the summary until planes are explicitly picked
- Klient view and client share output byte-for-byte unaffected
