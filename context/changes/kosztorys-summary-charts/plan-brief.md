# Kosztorys Podsumowanie — two pie charts — Plan Brief

> Full plan: `context/changes/kosztorys-summary-charts/plan.md`
> Design: `context/changes/kosztorys-summary-charts/change.md` → "Design — settled 2026-07-21"

## What & Why

The owner's sheet carries a section-share pie in its Podsumowanie footer (the client-facing offer
view); the app has that share only in a tooltip. Add it as a real chart — plus a sibling cost-split
pie — so the app's footer matches the sheet. Ships EX-529.

## Starting Point

The footer (`KosztorysTotalsPanel` → `KosztorysPodsumowanie`) already renders in both the editor and
the client-share view, and already receives the cost data (`materialyBreakdown` + robocizna). Per
section, `sectionSubtotalsForView` already computes both the offer figure (`plannedNet`) and the
executed one (`net`/`share`), client-priced and view-invariant. So the numbers exist — only the
render and one prop thread are missing. No charting library is currently installed.

## Desired End State

Opening the Podsumowanie panel shows the summary table with two pies to its right: **Udział sekcji**
(default base Przedmiar, a toggle flips to Wykonane, legend names the active base) and **Struktura
kosztów** (robocizna + materiały categories). recharts loads only when the panel renders. Slices
match the numbers the table and section panel already show.

## Key Decisions Made

| Decision           | Choice                                             | Why                                                             | Source |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------- | ------ |
| Charting library   | recharts `^2.15.4` + restored shadcn `ui/chart`    | Owner preference (aesthetics); dynamic-loaded so no bundle cost | Design |
| Bundle strategy    | `next/dynamic`, `ssr: false`                       | Keeps recharts out of the editor's main chunk                   | Design |
| Section pie base   | Przedmiar default, live toggle to Wykonane         | Sheet divides the offer; toggle resolves EX-537 owner-decision  | Design |
| Cost pie base      | Executed only, no toggle                           | Matches sheet r463 (suma prac wykonanych + materiały)           | Design |
| Section pie source | Client-priced subtotals memo (view-invariant)      | A structure chart must not move with the widok cen              | Plan   |
| Colours            | Fixed, positional from `--color-chart-*`           | Per-section colour storage + picker is the next slice           | Design |
| Layout             | Both pies side-by-side, right of the summary table | Sheet-faithful; wraps below on narrow widths                    | Plan   |

## Scope

**In scope:** recharts re-add + wrapper restore; section pie with base toggle; cost pie; thread the
client-priced subtotals to the footer; mount both dynamically; delete the dead conic pie; unit-test
the slice transforms.

**Out of scope:** per-section colour storage + colour picker (follow-up slice); any schema/migration;
changes to the section-panel tooltip, reconciliation scream, or price-view logic; a cost-pie toggle.

## Architecture / Approach

Restore the stack (isolated, build-verifiable) → build two presentational recharts pies over a pure
`chart-slices.ts` transform (the unit-tested seam) → thread the existing client-priced per-section
array into `KosztorysPodsumowanie` and mount both pies beside the table via `next/dynamic`. Render
only; no new data path.

## Phases at a Glance

| Phase                     | What it delivers                              | Key risk                                           |
| ------------------------- | --------------------------------------------- | -------------------------------------------------- |
| 1. Restore charting stack | recharts + `ui/chart.tsx` back, build green   | lightningcss/arm64 install trap (AGENTS.md remedy) |
| 2. Build pie components   | Both pies + tested slice transforms           | Feeding the section pie a view-aware source        |
| 3. Mount in footer        | Pies beside the table, dynamic, dead pie gone | Panel height / layout in an already-tight footer   |

**Prerequisites:** stacked on `ex-532` (`kosztorys-client-view-reuse`), where every surface this
builds on lives — not yet on `main`.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Assumes the client-share view showing the cost pie is acceptable — the materiały totals it mirrors
  already appear in that view's summary table, so no new leakage.
- Recharts `^2.15.4` pinned to match the restored wrapper; not the 3.x line.

## Success Criteria (Summary)

- Section pie slices sum to 100% and match the section panel's per-section values; toggle re-partitions
  without moving any money figure.
- Cost pie slices match the summary table's robocizna + materiały rows.
- recharts ships in a separate async chunk; editor initial bundle unchanged.
