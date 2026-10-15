# Review-gate ledger — EX-1019 roundtrip-audit · 2026-10-15

Scope: `485964557...HEAD` (08319d490 + ec2a7316f), 45 files. No `plan.md` → `/10x-impl-review` dropped.
Verification pass (Step 0.5) deferred to the manual „final exam" on staging — `manual-checks.md` § EX-1019.
Fan-out: code-review · feature-first-structure · module-cohesion-audit · structure-scatter-audit ·
tailwind-v4-audit · comment-noise-audit. Then `/simplify` (reuse incl. primitive-reuse-scan,
simplification, efficiency, altitude).

## Findings

- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/db/notifications.ts:39` (+5 `count*` wrappers) · per-stream counters have no production caller — they are the seam each stream's own DB spec (`leads`, `notifications`, `payout-confirmation`, `worker-expense-drafts`) pins its semantics through; the merged-statement spec checks the composition (column→badge wiring, user binding), not the fragments, so it is not a tautology
      test: no automated test — no defect; existing per-stream specs + `shell-badge-counts.db.test.ts` already cover both halves
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/investments/investment-v1-stats.tsx` · v1 tiles behind `Suspense fallback={null}` pop in / error after shell streams — same pattern as the v2 panel beside it; manual check covers the v1 tab
      test: no automated test — rendering-order trade-off, not a bug
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:50` · notes fetch beside reference data could pre-empt a 404 — a plain cached read of the same table, `notFound()` still runs after both awaits
      test: no automated test — no reachable failure
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/reference-data.ts:206` · notes map is one Data Cache entry (2 MB cap) — ~111 KB today and the reference-data entry is already larger
      test: no automated test — capacity note, not a defect
- [x] skipped · simplify (efficiency) · `src/lib/queries/shape-investments.ts:112` · listing rows still ship `aiNotes` (~80 KB) nobody there reads — staging's 231040966 already drops `aiNotes` from the listing row; resolved by the merge, not duplicated here
- [x] skipped · simplify (efficiency) · `shape-investments.ts:111` · listing ships every `notes` to prefill the edit dialog — on-demand fetch trades ~35 ms + a loading state on open; not a clear win
- [x] dropped · simplify (efficiency) · `reference-data.ts:226` · detail/kosztorys read the whole notes map for one row — same one round trip, gain a few ms of cache parse
- [x] dropped · simplify (efficiency) · `src/lib/db/sum-transfers.ts:1265` · GROUPING SETS emits NULL-category rows the JS drops — cached, negligible; a `HAVING` adds SQL for nothing
- [x] dropped · simplify (simplification) · `sum-transfers.ts:194` · `pushTo` → `Map.groupBy` — the groupBy form is longer (two filters + remap); one pass is clearer
- [x] dropped · simplify (simplification) · `worker-expense-drafts.ts:62` · `investmentId === null` checked twice — nit
- [x] dropped · simplify (simplification) · `shell-badge-counts.ts:20` · redundant `::int` / `?? 0` — harmless
- [x] dropped · simplify (simplification) · `dashboard.test.ts` · half the spec tests `fetchVisibleRegisters` (cash-registers) — split is churn for no signal
- [x] dropped · simplify (reuse) · `reference-data.ts:223` · `text()` coercer instead of `?? ''` — file uses the hand form six times; switching two lines adds inconsistency
- [x] dropped · module-cohesion-audit · `reference-data.ts:206` · notes fetch could move to its own module — the file stays the single reader of `investments` ref rows; churn in three importers
- [x] dropped · module-cohesion-audit · `notifications.ts`, `payout-confirmation.ts`, `worker-reports.ts`, `worker-expense-drafts.ts` · new exported SQL fragments — on-topic pairs with their counters
- [x] dropped · feature-first-structure · `manager-dashboard-panels.tsx`, `investment-v1-stats.tsx` · not named `*-section.tsx` — naming only
- [x] dismissed · structure-scatter-audit · `src/__tests__/leads/notifications.db.test.ts` vs `lib/db/notifications.db.test.ts` · two homes for one source — pre-existing, not this change
- [x] dismissed · simplify (simplification) · four worker-expense components still `router.refresh()` — out of this diff; informational
- [x] dismissed · tailwind-v4-audit · clean

## Simplify pass

Ran `/simplify` (4 angles + primitive-reuse-scan in the reuse angle) — 5 applied, 0 proposed, rest dropped/skipped/dismissed; each folded into ## Findings tagged `simplify`. No separate report file.

## Tests & suite

User chose typecheck + touched specs (2026-10-15).

- typecheck — green
- unit/DOM, 41 touched files — 276 passed, 32 skipped (DB-gated, run below); `sum-transfers.test.ts` red until its mocks were fixed (finding above)
- DB specs @ 5435, `--no-file-parallelism` (as `test:integration` runs them) — 6 files, 62 passed. Run in parallel, `shell-badge-counts` and `leads.db` race on live lead counts — the integration leg is serial by design, so not a defect
- full suite / E2E / parity — not run (user's choice); pre-push runs typecheck + unit + integration

## Status

Archived 2026-10-15 — every finding box checked. The 10 manual checks (`manual-checks.md` § EX-1019) stay open in the registry; they no longer gate Done.
