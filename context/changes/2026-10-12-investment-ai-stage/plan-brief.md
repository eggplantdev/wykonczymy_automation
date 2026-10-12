# „Etap AI” on the investment — Plan Brief

> Full plan: `context/changes/2026-10-12-investment-ai-stage/plan.md`

## What & Why

The knowledge flow (AI draft → owner review → Powody zmiany lifted into the katalog / Manual) has no
record of where each investment stands. One stored field, „Etap AI”, set by hand, answers it: ready for
analysis, review finished, knowledge already extracted.

## Starting Point

„Szkic wgrany” is already derived from the data and shown as the listing's „Analiza AI” column („Tak” /
„—”). `collect-reasons-prod.ts` needs a hand-typed `INVESTMENTS` list.

## Desired End State

The investment page header has an „Etap AI” select. The listing's „Analiza AI” cell shows the furthest
step — Gotowa do analizy → Szkic wgrany → Recenzja zakończona → Wiedza wyekstraktowana — sorts and
filters by it. `collect-reasons-prod.ts` with no arguments reads the investments at „Recenzja zakończona”.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Storage | One nullable enum `ai_stage`, three values | One field can't hold contradictory flags | Change note |
| „Szkic wgrany” | Derived, not stored | It is already a fact in the data | Change note |
| Where it's set | Select on the investment page, narrow action | One click; keeps it out of the whole-record form save | Plan |
| „Wiedza wyekstraktowana” | Set by hand | `apply-knowledge-prod.ts` doesn't know its source investments | Plan (user) |
| Reset on a later Powód zmiany | None | Accepted — rare, manual fix | Plan (user) |
| Listing | One cell, furthest step; filter via `useClientMultiFilter` + `FilterMultiSelect` | No second column that can disagree; reuses existing filter primitives | Plan |
| Who | Every management role, also on a zakończona inwestycja | `protectedAction`; the stage is a label, not a financial write | Plan |

## Scope

**In scope:** migration + collection field; narrow action + page select; listing cell, sort, filter;
`collect-reasons-prod.ts` default; step 9 docs.

**Out of scope:** automatic transitions, reset on new reasons, the edit form, `apply-knowledge-prod.ts`,
persisted filter state, phone layout.

## Architecture / Approach

`INVESTMENT_AI_STAGES` tuple → migration enum, collection options, action Zod. Read via
`fetchReferenceData` (cache key bump v8→v9) → `InvestmentRefT.aiStage` → page select and
`shapeInvestments`, where pure `aiProgressOf(aiStage, hasAiDraft)` yields the listing step.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Enum, column, field | `ai_stage` in DB + Payload, parity spec | Tuple ↔ enum drift (spec guards it) |
| 2. Page select | Narrow action + header select, DB spec | Stale cache shape without the key bump |
| 3. Listing | One „Analiza AI” cell, sort, filter | `hasAiDraft` readers missed on the row type |
| 4. Script + docs | `collect-reasons-prod.ts` default, step 9 | Only verifiable on prod after deploy |

**Prerequisites:** local DB migrated; prod migration (human) before the push.
**Estimated effort:** ~1 session.

## Open Risks & Assumptions

- A Powód zmiany written after „Wiedza wyekstraktowana” is not re-read unless someone resets the stage by hand.
- The script's REST `where[aiStage]` filter works only once the field is deployed and migrated on prod.

## Success Criteria (Summary)

- The owner marks review done on the page, and the listing shows it.
- `collect-reasons-prod.ts` with no args lists exactly the reviewed investments.
