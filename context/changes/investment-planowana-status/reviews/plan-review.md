<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Investment „Planowana" Status

- **Plan**: context/changes/investment-planowana-status/plan.md
- **Mode**: Deep
- **Date**: 2026-07-17
- **Verdict**: SOUND (was REVISE; both findings fixed in triage)
- **Findings**: 1 critical, 1 warning, 0 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

16/16 paths ✓, symbols ✓, brief↔plan ✓. Line refs verified current despite 2026-07-17 edits to
`tables/investments.tsx`, `[id]/page.tsx`, `add-investment-dialog.tsx`. Enum type name confirmed
`enum_investments_status` (`src/migrations/20260211_212425.ts:5`). Auto-seed confirmed
status-agnostic (`lib/actions/investments.ts:39-101`, keys on `presetId` only). Kosztorys access
confirmed ungated by status (`kosztorys_v2/page.tsx:17-19`). Blast-radius sweep: no unknown importer
of `toggleInvestmentStatus`; shared-helper consumers (users/cash-registers/leads, cancelled-filter
buttons) untouched by the phases.

## Findings

### F1 — Progress Phase 1 title doesn't match its body heading

- **Severity**: ❌ CRITICAL (mechanical Progress-parse contract)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: plan.md:98 vs plan.md Progress section
- **Detail**: Body heading carried a parenthetical ("(schema, migration, types, read path)") absent
  from the Progress `### Phase 1` title; a strict parser in /10x-implement fails on Phase 1.
- **Fix**: Drop the parenthetical from the body heading so both read "Phase 1: Enum value exists end-to-end".
- **Decision**: FIXED

### F2 — Two unlisted consumers of derived `active` silently hide prospects

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real product decision
- **Dimension**: Blind Spots
- **Location**: Current State Analysis / Phase 1 item 4
- **Detail**: `entity-combobox-field.tsx:51-55` (transfer/expense/deposit investment selects,
  `activeOnly` default) and `lib/queries/dashboard.ts:15` (manager dashboard filter, no toggle)
  consume the derived `active`; with `active = status === 'active'` a planowana investment is hidden
  from both. The plan kept that derivation without naming these consumers.
- **Fix A**: Document as accepted behavior (prospects have no transactions by definition).
- **Fix B**: Make planowana selectable — derive `active: status !== 'completed'` ("open for booking")
  at the single derivation point (`reference-data.ts:92`); both surfaces then include prospects,
  shared combobox untouched.
- **Decision**: FIXED via Fix A (owner choice, revised after initially picking B) — derivation stays
  `status === 'active'`; hiding a prospect from the transfer comboboxes and dashboard filter is
  documented as intended ("promote to Aktywna to book money"). plan.md Phase 1 item 4, Current State
  Analysis, Desired End State, Manual Testing Steps + plan-brief.md decision table updated.
