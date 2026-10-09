# Review-gate ledger — worker-page-quick-actions · 2026-10-07

Scope: `f938ff6a...062d62d3` (11 files) + uncommitted stale spec `src/__tests__/components/users/worker-investments-section.test.tsx`.
Dropped checks: `/10x-impl-review` (no plan.md). Step 0.5 browser pass skipped — owner verified in the browser during the session; Playwright not driven unprompted.

## Findings

- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/worker-expenses/worker-expense-drafts-section.tsx` · a freshly sent expense lands in a folded section — owner asked for both sections folded by default
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/app/(frontend)/pracownicy/[id]/page.tsx:99` · investment without a report token loses „Zgłoś pracę” — every stage membership gets a token (`stage-split.ts` → `insertMissingWorkerReportShares`, plus the backfill migration)
- [x] 🔵 OBSERVATION · dismissed · code-review + simplify · `src/components/users/worker-quick-actions.tsx:29` · with no active kasa (or no stage), „Dodaj wydatek” just disappears, the reason sits only in the folded „Wydatki” — owner ruling 2026-10-07: „Wydatek” only for a worker with a kasa, „Zgłoś pracę” only for one on an active investment; no explanation next to either
- [x] dropped · simplify · `src/components/ui/button.tsx` · wrapping buttons cancel base `whitespace-nowrap`/`h-*` from outside (4 call sites) — a wrapping size variant touches two unrelated pre-existing callers; not worth the churn in this slice
- [x] dropped · simplify · `src/components/worker-expenses/expense-draft-dialog.tsx:43` · `triggerClassName` silently ignored in draft mode — one caller, harmless; a discriminated union is churn
- [x] dropped · simplify · `src/components/users/report-work-button.tsx` · HardHat + label body repeated in both branches — two lines
- [x] dismissed · feature-first-structure / module-cohesion-audit / structure-scatter-audit · new `report-work-button.tsx` and `worker-quick-actions.tsx` sit beside their only consumer in `components/users/` — correct home
- [x] dismissed · tailwind-v4-audit, comment-noise-audit · nothing flagged

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 7 applied, 3 dropped, 0 proposed of its own; the noRegister placement it shared with code-review is the one open box. All folded into ## Findings.

## Tests & suite

Tests authored: repointed `worker-investments-section.test.tsx`, new `report-work-button.test.tsx`. Not run — owner standing rule (no tests unless asked); suite deferred by user.
