# Review-gate ledger — stage-completed-flag (EX-1034) · 2026-10-09

Scope: worktree `../wykonczymy-stage-completed`, branch `stage-completed-flag`, uncommitted diff vs
`63d6da448` (branch point = HEAD) — 91 changed + 4 new paths. Mid-gate the branch was fast-forwarded
onto `c92b6a75c` (tip of `worker-expense-without-investment`) and the diff re-applied on top (F1).
Step 0.5 (browser verification) skipped: Playwright is never driven unasked; manual checks are
non-blocking and go to the registry.

## Findings

_Trimmed at archive (2026-10-12): 15 fixed findings removed; their record is the commits. Dismissed / dropped / filed kept._

- [x] 🔵 OBSERVATION · dropped · `code-review` #6 · report page · refuses only after the tree is assembled — the reads already run in parallel under one `Promise.all`; ~40 accounts, nothing to win
- [x] 🔵 OBSERVATION · dismissed · `impl-review` F5 + `code-review` #9 · `column-color.ts` · green overrides the owner's colour — by spec; the owner's pick is kept and comes back on reopen (domain notes)
- [x] filed · `structure-scatter-audit` · ~31 specs · etap literals built by hand, so one new field touched 59 test files — `filed EX-1035`
- [x] dismissed · `structure-scatter-audit` · other change's `plan.md` · still names `isPendingDraftWithoutInvestment` — that change's historical doc, not this slice's to edit
- [x] dismissed · `comment-noise-audit` · `stage-header-completed.test.tsx` · flagged comments do not exist in the file
- [x] dismissed · `comment-noise-audit` · `worker-expense-drafts-worker.db.test.ts` · flagged comment carries real rationale — kept
- [x] dismissed · `tailwind-v4-audit` · — · 0 findings
- [x] filed · `simplify` (simplification) · `stage-header.tsx:142` · fifth etap handler threaded through six files, read-only = a five-way `!on…` chain — `filed EX-1036`
- [x] dismissed · `simplify` (simplification) · `src/lib/kosztorys/worker-view/labels.ts` · two map pairs (`WORKER_SCOPE_BLOCK_*` / `REPORT_SCOPE_REFUSAL_*`) — two rules on purpose (share/PDF block on the narrower one); the report maps extend by spread, no literal duplicated
- [x] dismissed · `simplify` (simplification) · `src/lib/kosztorys/worker-report/refusals.ts:16` · `stagesCompleted` in `REPORT_REFUSALS` "never read" — the map is the catalogue of report refusals (`unknownToken` / `foreignItem` are not returned by `reportShareRefusal` either) and `token-action.test.ts` reads it
- [x] dropped · `simplify` (altitude) · `expense-draft-dialog.tsx:72` · client always offers the draft's own investment, server keeps it only while running — a draft on a since-trashed investment is refused on save with `notOnInvestment` and he picks another from the same list; rare, harmless
- [x] dropped · `simplify` (simplification + altitude) · `use-kosztorys-stage-ops.ts:59`, `stage-split.ts:74`, `parse-labor-tab.ts:237` · three new-etap literals — different shapes, a factory saves one field at three sites
- [x] dismissed · `simplify` (efficiency) · — · no wasted work at this scale (per-column tint, existing tree reads, existing tag invalidation, indexed joins)

## Simplify pass

Ran /simplify (4 angles) — 3 applied, 1 filed (EX-1036), 2 dropped, 3 dismissed; each finding folded into ## Findings (tagged simplify). No separate report.
Primitive reuse covered by the /simplify reuse angle: the toggle uses `DropdownMenuCheckboxRow`, the tint `sectionColorColumnTint('green')` — no hand-rolled primitive in the diff.

## Tests & suite

- typecheck (`tsc --noEmit`): 0 errors — after adding `completed` to the multi-line etap fixture in `subcontractor-stage-breakdown.test.ts` (came in with the rebase)
- lint (eslint on changed files): clean — `etap` identifiers in `column-color.test.ts` renamed to `stage` (`local/no-domain-drift`)
- unit / DOM, touched specs: `scope`, `kosztorys-workers-menu`, `stage-header-completed`, `column-color`, `subcontractor-stage-breakdown`, `stage-header-plane` → 45 passed; `snapshot-to-tree` → 4 passed; `kosztorys-tree-sql-drift` → 6 passed
- DB specs on 5435, `--no-file-parallelism` under the test lock: `worker-report-page`, `token-action`, `actions/worker-expense-drafts.db`, `worker-expense-drafts-worker.db`, `worker-report-scan.db`, `kosztorys-stages`, `accept-worker-report`, `stage-memberships`, `db/worker-expense-drafts.db`, `stage-memberships.db` → 134 passed; `insert-schema-drift` → 5 passed (a parallel first run raced shared fixture users — FK errors, not defects)
- full `pnpm test`, `test:e2e`, build: not run — by user's choice „Run touched specs"; pre-push runs the unit + integration legs
