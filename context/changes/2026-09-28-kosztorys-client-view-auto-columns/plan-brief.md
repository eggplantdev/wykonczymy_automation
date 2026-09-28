# Investor View Auto-Columns — Plan Brief

> Full plan: `context/changes/2026-09-28-kosztorys-client-view-auto-columns/plan.md`
> Research: `context/changes/2026-09-28-kosztorys-client-view-auto-columns/research.md`

## What & Why

The owner drops the „Oferta / Rozliczenie" switch: switching modes by hand is a step people forget,
and a wrong mode shows the investor the wrong columns. One column set remains. The settlement
columns appear once there are entries to show.

## Starting Point

Each investment (and the firm default) stores `mode` + two variants of `{hiddenColumns,
hideEmptyRows}`. Every renderer already consumes one flat set. Only the dialogs, the save actions
and the PDF action (pinned to OFFER) know about the mode. No surface hides an empty column today.
„Udostępnij" opens a settings step before the link.

## Desired End State

„Ustawienia podglądu…" edits one column list with no toggle and no confirm. It explains that
settlement columns without entries and empty etapy stay hidden. On Podgląd, `/k/:token` and the
offer PDF:

- an empty etap shows neither its ilość nor its wartość;
- with no entries at all, „Pomiar z natury", „Razem netto/brutto" and „% wykonania" are absent;
- „Pozostało" is hidden by default.

The investor's „Robocizna" tab lists only filled etapy. „Udostępnij" copies the link on the click.

## Key Decisions Made

| Decision                  | Choice                                                                                                                     | Why (1 sentence)                                                                         | Source       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------ |
| Mode                      | Removed; one set per investment + firm default                                                                             | Owner ruling                                                                             | Owner        |
| Conditional columns       | „Pomiar z natury", each etap separately (ilość + wartość), „Razem netto", „% wykonania"; brutto follows netto              | Owner ruling                                                                             | Owner        |
| „Pozostało"               | Hidden by default, not data-conditional                                                                                    | Owner ruling                                                                             | Owner        |
| "Has entries"             | Some row's etap value `!== 0`, computed over all rows                                                                      | `stage_<id>` is never null; unfiltered rows keep columns stable across „Pokaż wszystkie" | Plan         |
| Where the rule applies    | Investor audience only (`previewVisible`); worker document untouched                                                       | Gate on audience, not view name (lessons)                                                | Research     |
| Matching                  | Full column id, not `toggleKey`                                                                                            | `toggleKey` collapses every etap to one key                                              | Research     |
| Backfill                  | SETTLEMENT verbatim; OFFER minus netto settlement keys; brutto and „Pozostało" kept; missing variant → NULL (code default) | Owner rule, fail-closed                                                                  | Owner        |
| Stored hidden set         | Nullable, **no** `'[]'` default                                                                                            | `'[]'` = "hide nothing", which fails open                                                | Research     |
| DROP of `mode`/`variants` | Separate migration after deploy, filed in Linear                                                                           | Public route reads the table; ADD+DROP in one migration breaks it                        | Research     |
| Share click               | Copies on the click (mints if none, never rotates); panel keeps copy/rotate/revoke + „Ustawienia podglądu…"                | Owner; Safari needs Promise-valued `ClipboardItem`                                       | Owner / Plan |
| Investor „Robocizna" tab  | Only filled etapy; none → „Brak etapów."                                                                                   | Owner                                                                                    | Owner        |
| E2E                       | Rewrite `client-share.spec.ts` here + new "etap appears on entry" test                                                     | Owner                                                                                    | Owner        |

## Scope

**In scope:** additive migration + backfill; flat collection/global/core/resolver/actions; settings
dialog without the toggle; the emptiness rule on grid, PDF and „Robocizna" tab; share without the
settings step; E2E rewrite + seed second etap; domain notes, manual checks, Linear.

**Out of scope:** the DROP migration; the worker view; changing the investor column ceiling;
Podsumowanie/Materiały tabs; history-view rendering; share permissions.

## Architecture / Approach

Subtract-only disclosure: code ceiling − owner's hidden set − `emptySettlementColumnIds(rows,
stages)`. The new pure function in `src/lib/kosztorys/settlement-columns.ts` returns full ids. The
investor grid (`selectV2Columns`) and `buildOfferPrintHtml` both subtract it. `stagesWithEntries`
feeds the investor „Robocizna" tab.

## Phases at a Glance

| Phase                     | What it delivers                                                       | Key risk                                                                |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. One column set         | Migration + backfill, flat storage/actions, dialog without the toggle  | Backfill fails open (`'[]'` or `jsonb_agg` NULL)                        |
| 2. Entries-driven columns | Pure rule on grid, PDF and „Robocizna" tab                             | Rule leaks into the worker document; group-key matching hides all etapy |
| 3. Share without settings | Click copies; panel only                                               | Safari refuses the clipboard write after an await                       |
| 4. E2E + docs             | Rewritten spec, seeded empty etap, domain notes, manual checks, Linear | Spec only authored, not run by the agent                                |

**Prerequisites:** local docker DB up; the in-flight worker-view change is compatible (it uses
`ViewSettingsFields` directly).
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- Any etap entry, including a test or mistaken one, is instantly visible on the investor link. The
  owner accepted this.
- A save on the old deploy between the prod migration and the new deploy isn't re-copied. Accepted:
  minutes, a handful of users.
- `mode` stays in the DB (with its default) until the follow-up DROP. New code must not read it.

## Success Criteria (Summary)

- The owner never picks a mode. The investor sees the offer columns until work is entered, then the
  filled etapy and totals.
- The PDF matches Podgląd and the link column for column.
- One click on „Udostępnij" puts the link in the clipboard.
