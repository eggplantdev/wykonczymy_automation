# Kosztorys stages (etapy) — Plan Brief

> Full plan: `context/changes/kosztorys-stages/plan.md`

## What & Why

Add a variable number of **stages (etapy)** to a kosztorys and let a Manager+ user record
**per-item, per-stage progress** (ilość wykonana), with a live **"Pozostało"** (remaining)
readout. This is S-04 / FR-004 — spreadsheet parity for tracking how much of each work item is
done across project stages.

## Starting Point

The pure calc/row core for stages was already **ported and unit-tested during S-01** and sits
unused on this branch (`stageValueForView`, `rowRemainingForView`, `stageKey`,
`diffRow.stageChanges`, `rowDoneNetForView`, plus the `KosztorysStageT`/`StageProgressT` types).
S-01 deliberately stripped everything around it: no DB tables, no collections, the query returns
`stages: [], progress: []`, no actions, and the editor builds no stage columns.

## Desired End State

The Kosztorys tab shows dynamic "Etap N" columns (renamable via header) plus a read-only
"Pozostało" column. Managers add stages from the toolbar, type per-item done-quantities that
autosave per cell (optimistic, sparse), and delete a stage via its header ✕ — blocked with a
toast if it holds recorded progress. Everything recomputes under the existing three-view price
toggle. Sections/items behave exactly as before.

## Key Decisions Made

| Decision           | Choice                                             | Why (1 sentence)                                                          | Source |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| Stage labels       | Editable ("Etap N" default, renamable via header)  | Stages should carry meaning; `updateStageFieldAction` already in POC.     | Plan   |
| "Pozostało" column | Include (read-only, per view)                      | It's the payoff of tracking stages; `rowRemainingForView` already ported. | Plan   |
| Delete-stage UX    | ✕ control on the stage column header               | Direct — delete where the stage lives; add stays a toolbar action.        | Plan   |
| Delete guard       | Blocked if any item has non-zero progress in stage | Prevents silent data loss; server-side authority (POC rule).              | Frame  |
| Storage            | Sparse `stage_progress`, upsert `ON CONFLICT`      | Missing row = 0; no dup rows; keeps writes = real change.                 | Frame  |
| Stage reordering   | Out of scope (append by ordinal)                   | Not required for FR-004; keeps the slice bounded.                         | Plan   |

## Scope

**In scope:** two DB tables (`kosztorys_stages`, `stage_progress`); two Payload collections;
query read; four actions (add/remove/rename stage + upsert progress); editor stage columns +
Pozostało + save wiring.

**Out of scope:** stage reordering; per-stage dates/status/notes; VAT/brutto on stage values
(S-12); column-locking/hiding (S-14); CSV export (S-07); undo (S-13); browser E2E (S-08); any
transfer/balance/marża/sheet change.

## Architecture / Approach

Bottom-up, mirroring S-01: schema → collections/query → actions → editor UI. The stage
collections, actions, and migration DDL port near-verbatim from the POC branch
(`git show poc-kosztorys-in-app:<path>`). The only new-shaped work is fitting dynamic stage
columns + a `diff.stageChanges` save branch into this branch's **decomposed** editor
(`use-kosztorys-editor.ts` + `kosztorys-v2-columns.tsx`), where the POC was a single file.

## Phases at a Glance

| Phase                  | What it delivers                                   | Key risk                                                  |
| ---------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| 1. Schema              | Two tables + rels columns, UNIQUE constraints      | Missing `(item,stage)` UNIQUE breaks the upsert           |
| 2. Collections + query | Registered collections; tree reads stages/progress | Progress fetch shape (filter by investment's items)       |
| 3. Server actions      | add/remove/rename stage + sparse progress upsert   | remove-guard must read live progress, not stale           |
| 4. Editor UI           | Stage columns + Pozostało + autosave + controls    | dsg remount key must include `stagesKey` or column no-ops |

**Prerequisites:** S-01 editor on `kosztorys-sections-items` (present); local docker DB on 5433.
**Estimated effort:** ~1–2 sessions across 4 phases; Phases 1–3 are mostly a POC port, Phase 4
is the real integration.

## Open Risks & Assumptions

- The dsg "columns frozen at mount" gotcha is the top risk — mitigated by adding `stagesKey` to
  the grid `key` (documented lesson).
- Stage-progress save is a **new** dimension (per-cell, not per-field item patch); the
  `onChange` branch + revert must be correct or edits silently drop.
- Assumes MANAGEMENT_ROLES-only access (EMPLOYEE none) per the MVP register — unchanged from S-01.

## Success Criteria (Summary)

- A manager adds/renames/deletes stages and records per-item progress; Pozostało is live and
  correct under every price view.
- Progress persists across reload with no duplicate rows; deleting a stage with progress is
  blocked until cleared.
- No regression in sections/items/pricing or in transfers/balances/marża.
