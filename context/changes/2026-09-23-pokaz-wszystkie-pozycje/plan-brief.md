# „Pokaż wszystkie pozycje" in the client view — Plan Brief

> Full plan: `context/changes/2026-09-23-pokaz-wszystkie-pozycje/plan.md`

## What & Why

A switch in the client view lets an investor lift the owner's „Ukryj pozycje bez przedmiaru i bez
wykonanej pracy" for one visit and see the whole scope of works on offer, not only what this offer prices.

## Starting Point

The owner's flag `hideEmptyRows` is applied render-side through `clientConditionIds` in
`useKosztorysViewState`; the preview payload already ships every pozycja, so nothing server-side changes.

## Desired End State

With the owner's hide on and something to reveal, the client header shows „Pokaż wszystkie pozycje (+N)".
On: hidden pozycje appear muted and numbered in sequence. Off (and on every reload): the curated list.
Totals and the printed offer never change.

## Key Decisions Made

| Decision      | Choice                                   | Why (1 sentence)                                           | Source   |
| ------------- | ---------------------------------------- | ---------------------------------------------------------- | -------- |
| Audience      | Investor on `/k/<token>` + owner preview | The point is the curious investor seeing the offered scope | Research |
| Persistence   | Plain `useState`                         | Every visit opens on the owner's curated document          | Research |
| Variant       | Not tied to Oferta/Rozliczenie           | The client only ever sees one variant                      | Research |
| Control       | Labelled switch beside „Podsumowanie"    | Shows on/off state; reads as a view option                 | Plan     |
| Count         | „(+N)" in the label                      | The investor knows up front how much scope is on offer     | Plan     |
| Revealed rows | Renumbered, muted text                   | Offered-but-out-of-scope reads apart at a glance           | Plan     |
| Print         | Unaffected                               | The switch is a reading gesture, not part of the document  | Research |

## Scope

**In scope:** view-state flag, `rowIdsMatching` helper, editor-hook exposure, `ui/switch.tsx`, header
control, muted-row class + CSS, two specs.

**Out of scope:** persistence, owner-side allow/forbid setting, print changes, other preview counts.

## Architecture / Approach

`showAllRows` (view state) → `clientConditionIds(hideEmptyRows && !showAllRows)` → `documentRows`.
The editor hook also derives `clientEmptyRowIds` once; its size drives the label, membership drives the
muted class in `rowClassName`.

## Phases at a Glance

| Phase                    | What it delivers                   | Key risk                                             |
| ------------------------ | ---------------------------------- | ---------------------------------------------------- |
| 1. State and derivation  | Flag + ids helper + specs          | Bypassing `clientConditionIds` instead of feeding it |
| 2. Switch and muted rows | Header switch, muted revealed rows | Header wrap at phone width                           |

**Prerequisites:** none.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- While the switch is on, pozycja numbers differ from the printed offer (accepted: renumber).

## Success Criteria (Summary)

- An investor can reveal and hide the empty pozycje in one click, and the revealed ones read as muted.
- Totals, print and the owner's editor are unchanged.
