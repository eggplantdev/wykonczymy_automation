# Review-gate ledger — kosz-inwestycji-blokady · 2026-10-01

Scope: `9bf9b36a..e8982a32` on `staging`. The two commits are 7a294e73 (feat(trash)) and e8982a32 (fix(forms)).
Tests were skipped by the user: none run, none authored.
Checks run: `/code-review`, `tailwind-v4-audit`, `feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`, `comment-noise-audit` (flag-only), then `/simplify`.
`/10x-impl-review` was not run because this slice has no `plan.md`.

## Findings

- [x] 🟡 WARNING · skipped · code-review · `src/lib/actions/media-kind.ts` · „Oznacz jako rzut" still flips `media.kind` on a trashed investment's asset — harmless metadata on the media row, not the investment; another guard is not worth it
      test: no automated test — not fixed
- [x] 🟡 WARNING · skipped · code-review · share-link actions · server still mints a share token for a trashed investment — the write is a harmless token and the share pages 404 on a trashed id
      test: no automated test — not fixed
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/investment-trash.ts` · READ COMMITTED race between the status check and the trash write — the purge filter and the update guard both re-check at write time
      test: no automated test — dismissed
- [x] dropped · code-review · `src/components/forms/form-components/form-footer.tsx` · `awaitingAnswer` threaded into FormFooter by hand — three consumers, a context would be heavier than the prop
- [x] dropped · code-review · trashed banners/wordings + duplicate v1 link · three surfaces with different copy; the v1 link variants differ in size, label and variant, so a shared component's params would equal the code
- [x] dismissed · code-review · `src/lib/queries/reference-data.ts` · `trashedInvestments` shipped in client props — same precedent as `trashedCashRegisters`, a bounded list
- [x] fixed · feature-first-structure · `src/lib/constants/trash.ts` · active-delete rule lived in `investment-lock.ts` — moved beside the other trash rules (`delete-blocker.ts` is server-only and the client button needs it)
- [x] fixed · structure-scatter-audit · `src/components/trash/trash-kinds.ts` · „Nie udało się usunąć inwestycji” duplicated — `INVESTMENT_DELETE_FAILED_MESSAGE`
- [x] dropped · structure-scatter-audit · `src/app/(frontend)/inwestycje/[id]/page.tsx` · inline trashed banner — one use, extracting buys nothing
- [x] fixed · comment-noise-audit · `src/lib/constants/investment-lock.ts:26` · comment above `InvestmentLockT` was wrong — removed
- [x] fixed · comment-noise-audit · `src/lib/constants/trash.ts:4-5` · restated the code — removed
- [x] fixed · comment-noise-audit · `src/components/forms/form-components/form-footer.tsx:15` · restating comment replaced with the why (the full-screen loader would cover the question)
- [x] fixed · comment-noise-audit · `src/lib/queries/reference-data.ts:189` · JSDoc on `findInvestmentRef` restated the signature — removed
- [x] fixed · comment-noise-audit · `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx:37` · trimmed to the why
- [x] fixed · comment-noise-audit · `src/lib/queries/investments.ts:46-47` · trimmed, then reverted with `allowTrashed` (see altitude)
- [x] dismissed · comment-noise-audit · `src/components/trash/trashed-investment-links.tsx:7` · carries rationale — kept
- [x] fixed · simplify · `src/lib/db/investment-trash.ts` · `is_template` / undeletable flags computed in SQL — derived in the mapper from `status`
- [x] fixed · simplify · `src/components/investments/trash-investment-button.tsx` · two state hooks (open + kosztorysUsed) — one `asking` state
- [x] fixed · simplify · `src/lib/queries/reference-data.ts` · cash-register and investment trashed split copy-pasted — `splitTrashed`
- [x] fixed · simplify · `src/components/investments/trash-investment-button.tsx` · round-trip for an investment with no kosztorys — skipped on `!hasKosztorys`
- [x] fixed · simplify · `src/lib/constants/investment-lock.ts` · template-vs-investment trashed message picked in two places — `trashedMessageFor`, shared by the gate and the hook
- [x] fixed · simplify · `src/lib/queries/investment-kosztorys-used.ts` · hand-rolled auth + error shape — `protectedAction`, client reads it through `settleAction`
- [x] dropped · simplify · `has_sheet` EXISTS duplicated across two SELECTs — two queries, inlining is clearer than a fragment
- [x] fixed · simplify (altitude) · `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx` · v1 page grew `allowTrashed` / `trashed` on `requireInvestmentOr404` to read a name — now reads `findInvestmentRef` off reference data like kosztorys v2; the guard is back to its original shape
- [x] skipped · simplify (altitude) · `src/lib/db/delete-blocker.ts` · fold the active-status rule into `investmentDeleteBlocker` — the client button needs the check without a round-trip, and the blocker is server-only; review-worthy refactor for one rule
- [x] skipped · simplify (altitude) · trashed-active code paths (`TRASHED_ACTIVE_…`, purge filter) · prod has 0 trashed investments, so these only serve rows trashed before the rule — kept as defence; the cost is two lines
- [x] dropped · simplify (altitude) · `src/hooks/investments/guard-trashed-investment.ts` · shared `refuseWritesWhileTrashed` factory with cash-registers — two hooks with different exceptions, the factory's params would equal the code
- [x] dismissed · simplify (altitude) · `src/components/forms/hooks/use-managed-form.ts` · go back to the try/finally flag — it hid the loader during real `beforeSubmit` work, which is the bug code-review flagged
- [x] dropped · simplify (altitude) · `hasSheet` on the per-kind trash row — one consumer, not worth a type split
- [x] skipped · simplify (altitude) · server preflight returning the refusal instead of a client status check — reintroduces the round-trip the early toast removed
- [x] dropped · simplify (altitude) · `src/components/kosztorys/editor/kosztorys-editor-body.tsx` · expose `lock` instead of `isTrashed` — `isTemplate` already rides as a boolean; matching it is clearer
- [x] dismissed · tailwind-v4-audit · no findings

## Simplify pass

Ran /simplify (reuse, simplification, efficiency and altitude agents): 7 applied, 0 proposed, 8 dropped/skipped/dismissed. Every finding is folded into ## Findings, tagged simplify.

## Tests & suite

Deferred by user: no tests run or authored in this gate. The fixed findings (trimmed at archive, 2026-10-03) left these paths with no regression test — the purge's `status <> 'active'` filter, the `guard-trashed-investment.ts` update guard, the share/kosztorys menus hidden on a trashed investment, and the early „aktywna” toast. E2E backlog: EX-874.
Fixture/mock shapes were updated only where types forced it (`trash.test.ts`, `trash-investment-button.test.tsx`, `investment-trash.db.test.ts`).
`tsc` is clean on `src`; the only errors are in another session's untracked `context/changes/2026-10-01-ai-kosztorys-generation-tests/`. `eslint` is clean on the touched files.
