# Screaming Reconciliation Indicator — Plan Brief

> Full plan: `context/changes/robocizna-from-kosztorys/plan.md`
> Research: `context/changes/robocizna-from-kosztorys/research.md`

## What & Why

During the transition from manual `LABOR_COST`/`RABAT` transfers to reading robocizna/rabat from the
kosztorys, the owner must verify per investment — by eye — that both sources agree before flipping that
investment's "verified" flag. This slice builds that instrument: inside the kosztorys Podsumowanie,
compare the investment's transaction figures against the kosztorys client-view figures and scream on
mismatch. Read-only, no writes.

## Starting Point

The editor page already computes the investment's `financials` (`totalLaborCosts`, `totalRabat`) but
doesn't thread them into the editor. The hook already computes the client-view executed net (`doneNet`);
only a client-view rabat net is missing. `toGross` and a tooltip primitive already exist.

## Desired End State

Opening the Podsumowanie on a mismatching investment shows the offending figure bold red with a red `!`;
the tooltip names both figures and the delta. Agreement to the grosz renders exactly as today. The
verdict is locked to client view — the price-view toggle never changes it.

## Key Decisions Made

| Decision           | Choice                                         | Why                                                                    | Source   |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| Comparison basis   | Gross vs gross, client-view, 1-grosz tolerance | Robocizna is a client-billing figure; toggle must not move the verdict | Research |
| Tolerance form     | Exact grosz equality on rounded values         | Avoids sub-grosz `toGross` false-fires                                 | Plan     |
| Zero handling      | Scream on any >1gr diff incl. one-side-zero    | The "transfer not entered yet" gap is what population must catch       | Plan     |
| Hidden rabat line  | Force-show when either side non-zero           | A `RABAT` transfer with empty kosztorys rabat can't hide               | Plan     |
| Transaction amount | Treated as gross (raw, no VAT in sum path)     | Verified: schema has no vat field                                      | Research |

## Scope

**In scope:** thread two investment figures from the server page; add one client-view rabat net to the
hook; assemble a reconciliation verdict in a real lib module the editor body calls; render the scream in
Podsumowanie; a cross-boundary parity test running the REAL settlement chain vs the REAL
`deriveFinancials` (per the parity lesson — no stand-ins, proven red); browser E2E owed at the review
gate.

**Out of scope:** the read-switch (marża/bilans sourcing), the per-investment verified flag, disabling
transfer types, `deriveFinancials`/schema/Sheets changes.

## Architecture / Approach

Server page → `KosztorysEditorV2` (assembles `reconciliation` from hook figures + investment props) →
`KosztorysTotalsPanel` (pass-through) → `KosztorysPodsumowanie` (renders bold-red + `!` + tooltip). One
new hook figure (`rabatClientNet`), one comparison helper.

## Phases at a Glance

| Phase               | What it delivers                                    | Key risk                                     |
| ------------------- | --------------------------------------------------- | -------------------------------------------- |
| 1. Wire + reconcile | Both sides meet in the editor; verdict object built | Client-view rabat derived off the wrong pass |
| 2. Render scream    | Bold-red `!` + tooltip in Podsumowanie              | Force-showing the rabat row disturbs layout  |
| 3. Browser E2E      | Seeded mismatch/match/stability specs in `e2e/`     | Prop-plumbing gaps unit tests can't see      |

**Prerequisites:** none — all anchors verified.
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes historical `LABOR_COST` amounts were entered as gross; net-typed ones will legitimately trip
  the `!` — that is the instrument working, not a bug.

## Success Criteria (Summary)

- A mismatching investment screams (bold red + `!` + explanatory tooltip) on the right figure.
- Agreement to the grosz is silent.
- The verdict is stable across the price-view toggle.
