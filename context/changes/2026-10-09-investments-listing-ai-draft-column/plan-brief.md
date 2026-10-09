# „Analiza AI” column on the investments listing — Plan Brief

> Full plan: `context/changes/2026-10-09-investments-listing-ai-draft-column/plan.md`

## What & Why

The owner wants to see on `/inwestycje` which investments had an AI kosztorys analysis loaded. The
point is to get this without adding a query to a listing that already runs six aggregates.

## Starting Point

The listing already folds `kosztorys_items` per investment in `selectKosztorysClientTotals`. The
codebase already defines an „AI kosztorys” as `hasAiDraft`: some item has a non-null AI przedmiar.
The editor uses that definition to show its AI columns.

## Desired End State

An „Analiza AI” column shows „Tak” or „—” per investment. It agrees with the editor: „Tak” exactly
when the editor shows the AI przedmiar column. It sorts and hides like any other column.

## Key Decisions Made

| Decision       | Choice                                | Why                                                                                               |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Content        | Flag „Tak” / „—”                      | A count or review progress adds a new figure, or a SQL copy of `effectiveReviewStatus`.           |
| Definition     | `bool_or(ai_planned_qty IS NOT NULL)` | Mirrors `hasAiDraft`, so the listing and the editor cannot disagree. The AI text fields stay out. |
| Data source    | The existing kosztorys aggregate      | No new query, cache entry or tag.                                                                 |
| Type placement | Row/map type, optional on the map     | Keeps the financial `KosztorysClientTotalsT` clean and ~30 hand-built test maps valid.            |
| Cache          | Key `-v1` → `-v2`                     | A pre-deploy entry lacks the field and would read „—” everywhere.                                 |
| Lifetime       | Permanent, no removal issue           | Owner, 2026-10-09.                                                                                |
| „Kto dodał”    | Dropped                               | The data does not exist: no `createdBy`, no versions.                                             |

## Scope

**In scope:** SQL flag, row type, `shapeInvestments`, column, DB + unit specs, DOM factory default.

**Out of scope:** creator column, AI row counts, review progress, migrations, the `V2_COLUMN_IDS` switch.

## Phases at a Glance

| Phase                      | What it delivers                                       | Key risk                                                                 |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1. Flag in aggregate + row | `hasAiDraft` on every listing row, pinned by a DB spec | Diverging from `hasAiDraft`. The spec pins `aiPlannedQty: 0` as a draft. |
| 2. Column                  | „Analiza AI” on `/inwestycje`                          | None worth naming. Cosmetic render.                                      |

**Prerequisites:** test DB on 5435 for the DB spec.
**Estimated effort:** under one session.

## Open Risks & Assumptions

- This assumes only the draft loader writes `ai_planned_qty`. Verified across every writer listed in
  the plan. A future path that copies AI quantities into a new kosztorys would make the flag say
  „Tak” for a copied draft too, and so would the editor.

## Success Criteria (Summary)

- An investment with a loaded draft shows „Tak” and its editor shows the AI columns.
- Every other investment shows „—”.
- The listing makes the same number of DB round trips as before.
