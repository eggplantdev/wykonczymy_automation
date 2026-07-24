<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Kosztorys stages (etapy) + per-item progress (S-04)

- **Plan**: context/changes/kosztorys-stages/plan.md
- **Scope**: Full plan — Phases 1–4
- **Date**: 2026-07-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automated success criteria all green this session (`pnpm typecheck` / `lint` 0 errors / `vitest run` 758 passed / `build` compiles). Manual checks 4.5–4.10 pending author sign-off (expected pre-commit state). The deliberate omission of `payload_locked_documents_rels` FK columns was confirmed consistent with the shipped S-01 precedent (`20260708_2_add_kosztorys_sections_items.ts` also omits them) — not drift. `ON CONFLICT (item_id, stage_id)` ↔ migration UNIQUE constraint aligned; `item.investment` query filter valid.

## Findings

### F1 — Stage rename fires a DB write on every blur (no change-guard)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: kosztorys-v2-columns.tsx:333 → use-kosztorys-editor.ts:293
- **Detail**: StageHeader's onBlur unconditionally called onRenameStage → updateStageFieldAction even when the label was unchanged. Item-field autosave gates on diffRow; a rename has no such diff, so tabbing through the header issued a redundant write + optimistic setStages. No data loss (idempotent), just a wasteful write against the "writes = real change" lesson.
- **Fix**: Early-return in handleRenameStage when the normalized value equals the current label; read the fresh label via a new `stagesRef` (the handler lives in the mount-frozen column closure, mirroring the existing `rowsRef` pattern).
- **Decision**: FIXED

### F2 — removeStageAction skips Zod validation on stageId

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: lib/actions/kosztorys.ts:255-263
- **Detail**: Every other action validates its input via validateAction; here stageId flowed straight into `sql`` + payload.delete. Safe (parameterized + TS-typed), just inconsistent.
- **Fix**: Wrap with `validateAction(z.object({ stageId: z.number() }), …)` for parity; use `parsed.data.stageId` in the guard SQL and delete.
- **Decision**: FIXED

### F3 — Delete-stage guard is TOCTOU (advisory, not atomic)

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: lib/actions/kosztorys.ts:261-267
- **Detail**: The `SELECT … qty_done<>0` check and the payload.delete are not atomic; a concurrent setStageProgressAction landing between them would be silently cascaded away by FK ON DELETE CASCADE. Acceptable at this app's scale/team size. Could close the window with a single `DELETE … WHERE NOT EXISTS (… qty_done<>0)` returning a row count.
- **Fix**: (deferred) Collapse guard+delete into one conditional DELETE if concurrency ever matters.
- **Decision**: ACCEPTED — acceptable at this app's single-team scale

### F4 — Progress rows persist explicit qty_done=0 (not truly sparse)

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: lib/actions/kosztorys.ts:293
- **Detail**: Clearing a cell to 0 upserts a 0-row rather than deleting it. The "missing row = 0" model still holds (the delete guard checks `<> 0`), so these rows stay consistent — the table just accumulates zero-rows. Cosmetic.
- **Fix**: (deferred) Optionally DELETE the row when qty resolves to 0.
- **Decision**: ACCEPTED — cosmetic; model stays consistent
