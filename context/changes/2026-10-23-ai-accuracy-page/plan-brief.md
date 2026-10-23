# Trafność AI w kosztorysach — in-app page — Plan Brief

> Full plan: `context/changes/2026-10-23-ai-accuracy-page/plan.md`

## What & Why

The accuracy dashboard is a claude.ai artifact refreshed by hand from CSVs, so it is stale after every
review. Move it into the app as `/inwestycje/trafnosc-ai`, computed live from the DB, management only.

## Starting Point

Pure scoring in `scripts/ai-kosztorys/accuracy.ts`, a prod CSV export into `wykonczymy-ai-cases/accuracy/`,
and a toolbar link on `/inwestycje` pointing at the artifact.

## Desired End State

„Inwestycje” → „Trafność AI” opens an in-app page with the artifact's sections, cases named by
investment, always current. The CSV export keeps producing the same files for analysis and training.

## Key Decisions Made

| Decision             | Choice                                                                                                   | Why                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Where                | `/inwestycje/trafnosc-ai`, no nav entry                                                                  | Reached from the investments toolbar; nav highlight comes free                              |
| Data                 | Live SQL + `cached()` on `[kosztorysItems, investments]`                                                 | Every writer of the figures already expires one of these                                    |
| Scoring              | Moved to `src/lib/kosztorys/ai-accuracy.ts`, rules unchanged; script reuses it                           | One source — page and CSVs can't disagree                                                   |
| CSVs + script        | Kept, same columns                                                                                       | Analysis and training data                                                                  |
| Selection-only cases | Constant `AI_ACCURACY_EXCLUDED_INVESTMENT_IDS`; script asserts it matches `case.json` `accuracyExcluded` | 2 of 31 cases, decided during the AI review, not by a manager — no migration or form for it |
| Case naming / order  | Investment name, by investment id                                                                        | Case numbers live only in ai-cases                                                          |
| Artifact             | Left untouched                                                                                           | Archive of 22 paź                                                                           |

## Scope

**In scope:** shared scoring, live page, toolbar link, README step, superseding the dashboard change.

**Out of scope:** scoring-rule changes, DB columns, nav entry, phone layout, deleting anything in ai-cases.

## Phases at a Glance

| Phase             | What it delivers                                         | Key risk                                   |
| ----------------- | -------------------------------------------------------- | ------------------------------------------ |
| 1. Shared scoring | Scoring + summary in `src/lib`, script re-pointed, specs | CSV output drifting from the 22 paź files  |
| 2. Live page      | SQL read, cached query, route, components, internal link | Selection rule differing from the script's |
| 3. Workflow docs  | ai-cases README, old change superseded                   | —                                          |

**Prerequisites:** none (no migration).
**Estimated effort:** one session.

## Open Risks & Assumptions

- A new selection-only case needs a commit + deploy to be excluded — accepted for its rarity.
- Any kosztorys write anywhere expires the cache; fine at this scale.

## Success Criteria (Summary)

- Page figures equal `accuracy/cases.csv` on the same data.
- An edit to Przedmiar / Powód zmiany shows on the next load.
- Re-running the export on unchanged data leaves the ai-cases CSVs unchanged.
