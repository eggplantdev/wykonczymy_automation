# Review-gate ledger — investment-planowana-status (EX-506) · 2026-07-18

Branch `konradantonik/ex-506-planowana-status`, worktree `/Users/konradantonik/workspace/yolo/wykonczymy-ex506`, base `staging` (942f4df9). Changes uncommitted in the working tree.

Slice files (diff vs base):

- Modified: `collections/investments.ts`, `migrations/index.ts`, `types/reference-data.ts`, `lib/queries/reference-data.ts`, `components/tables/investments.tsx`, `components/investments/investment-data-table.tsx`, `lib/actions/toggle-active.ts`, `components/forms/investment-form/investment-schema.ts`, `components/forms/investment-form/investment-form.tsx`, `app/(frontend)/inwestycje/[id]/page.tsx`, `__tests__/toggle-actions.test.ts`
- New: `migrations/20260718_0_add_planowana_investment_status.ts`, `components/ui/investment-status-badge.tsx`, `components/ui/status-filter.tsx`, `hooks/use-status-filter.ts`, `__tests__/use-status-filter.test.ts`

## Findings

<!-- one checkbox per finding; most-severe first -->

- [x] 🔵 OBSERVATION · dismissed (owner confirmed intended, 2026-07-18) · code-review · `lib/queries/reference-data.ts:92` · `active = status === 'active'` makes a `planowana` investment derive `active:false`, excluding prospects from the transfer/expense picker `entity-combobox-field.tsx:55` (`activeOnly` default true; "show all" still reveals them) and the dashboard `dashboard.ts:15` `activeInvestments`. Owner ruled this **correct behavior**: a prospect has no committed job, so it should not be a default transfer target nor count as active. No change; no test owed.
- [x] deviation · dismissed · impl · `components/investments/status-filter.tsx` · added a 5th "W toku" segment as the default view — the plan's 4-segment ToggleGroup made the intended default "Aktywne+Planowane" unreachable. Deliberate; impl-review assessed it sound (satisfies plan's Desired-End-State default, all single-status views still reachable). Verified green in the manual pass.
- [x] dismissed · tailwind · `components/investments/investment-status-badge.tsx` · raw palette (`bg-sky-100`/`bg-emerald-100`) instead of semantic tokens — matches the established `ROLE_COLORS` convention in `badge.tsx` and reuses `BADGE_BASE`; not a v4 arbitrary-value violation.
- [x] dropped · tailwind · `components/investments/investment-status-badge.tsx` · badge takes no `className`/`...props` passthrough unlike `RoleBadge` — YAGNI, no caller needs it; not worth the churn.
- [x] dismissed · comment-noise/altitude · slice files · comment-noise audit clean (all 3 kept comments carry real rationale — the `open` semantics, the Postgres ADD-VALUE/no-DROP-VALUE constraints); the shared binary helpers (`ActiveToggleBadge`/`ActiveFilterButton`/`useActiveFilter`) confirmed still consumed by users/cash-registers/leads (no dead code from the removal).

## Simplify pass

Ran /simplify (4 angles) — 1 applied (the duplicated status-label map), 0 proposed, rest verified clean; efficiency/altitude confirmed the 3-way `useStatusFilter` vs binary `useActiveFilter` split is the right depth (two genuinely different data shapes, both still generic). Each finding folded into ## Findings tagged simplify.

## Tests & suite

- unit — `pnpm exec vitest run use-status-filter.test.ts toggle-actions.test.ts` → **17 passed** (5 filter + 12 toggle). The filter bucketing is the only new pure logic; covered.
- typecheck — `pnpm exec tsc --noEmit` → clean.
- lint — `pnpm lint` → 0 errors (86 pre-existing warnings in old migrations; new migration clean).
- [x] E2E — browser-level slice; deferred to the E2E backlog, filed **EX-528** (`e2e-backlog` label, project Wykonczymy). Manual pass already green.
- full suite (build/e2e legs) — user opted for fast legs only (typecheck/lint/unit, all green); build + e2e not run this pass.
