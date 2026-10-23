# AI accuracy dashboard — Plan Brief

> Full plan: `context/changes/2026-10-23-ai-accuracy-dashboard/plan.md`
> Research: `context/changes/2026-10-23-ai-accuracy-dashboard/research.md`

## What & Why

Managers should see at any time how accurate the AI kosztorys drafts are and whether they improve.
The dashboard „Trafność AI w kosztorysach” already exists on claude.ai; it needs a permanent link in
the app and a refresh after every owner review.

## Starting Point

The dashboard reads five CSVs produced once (2026-10-22) by ad-hoc SQL that is saved nowhere, with a
hand-typed case/round map. Nothing in the app links to it; the runbook never refreshes it.

## Desired End State

„Trafność AI ↗” in the `/inwestycje` toolbar opens the dashboard. After every „Recenzja zakończona”
the runbook says: run `accuracy-report-prod.ts`, commit the CSVs, refresh the dashboard. The
dashboard goes case by case.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Grouping | None — case by case | User: no rounds | User |
| Host | claude.ai dashboard, not an in-app page | Case identity lives in the ai-cases repo; a link is two files | Research |
| Prod access | REST through the app (GET only) | Same path as `collect-reasons-prod.ts`; read-only by construction | Research |
| Which cases | Stage „Recenzja zakończona” / „Wiedza wyekstraktowana” with AI rows | The owner's stage is the gate; a new round drops a case until re-reviewed | Plan |
| AI values | As currently in prod | No per-round history exists; the stage gate covers unreviewed rounds | Plan |
| Cases 11, 12 | Excluded via `accuracyExcluded` in case.json | Selection-only, qty 0 means „unknown” | Plan |
| Repeated pozycje | ≥ 3 cases, over every scored case | The 17+ floor was a round boundary | Plan |
| Link placement | Toolbar `actions`, listing only | Audit A41 direction; it's a cross-investment figure | Plan |

## Scope

**In scope:** scoring script + spec, five CSVs in the ai-cases repo, dashboard rewritten per case,
toolbar link, runbook step.

**Out of scope:** rounds, in-app dashboard, link on the investment page, automatic refresh,
per-round history.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 0. Access check | Proof a manager without claude.ai can open it | Login wall → re-plan in-app |
| 1. Scoring script | Repeatable CSVs | Port drifts from the 10-22 numbers — parity anchor |
| 2. Dashboard per case | No rounds, new data | Type's page check |
| 3. Listing link | „Trafność AI ↗” in the toolbar | `ExternalLink` size prop touches a `ui/` primitive |
| 4. Runbook | Refresh step in step 9 | — |

**Prerequisites:** a prod `payload-token` in `TOKEN_FILE`.
**Estimated effort:** one session.

## Open Risks & Assumptions

- Anonymous access is unverified (Phase 0).
- The three hand-shortened pozycja names become mechanical cuts.

## Success Criteria (Summary)

- A manager opens the dashboard from `/inwestycje`.
- After a review, one script run + upload refreshes it; the numbers for unchanged cases match 10-22.
