---
id: kosztorys-editor-compile-fix
title: Restore React Compiler memoization to useKosztorysEditor + clear the verified EX-496 tail
status: archived
branch: staging
created: 2026-07-17
updated: 2026-07-17
archived_at: 2026-07-17T13:35:54Z
---

# Kosztorys editor — React Compiler unblock + EX-496 cleanup tail (EX-496)

`src/components/kosztorys/use-kosztorys-editor.ts` emits **zero** `_c` cache slots — React Compiler
silently bails on three constructs, so every compiled downstream consumer (`kosztorys-toolbar-actions`
`_c(21)`, the datasheet grid's `columns`) misses on every keystroke. This change restores compilation
under an automated guard, then clears the still-open EX-496 cleanup tail.

- **Linear:** [EX-496](https://linear.app/ex-plant/issue/EX-496/kosztorys-v2-audit-usekosztoryseditor-is-not-compiled-by-react) (Urgent). Audit doc: `context/changes/kosztorys-v2-audit/audit.md`.
- **Split from the audit:** this is **Change A** of a two-change split. **Change B** = EX-521 (the
  god-hook decomposition), which builds on A's compiled + guarded baseline. A ships first.
- **Audit is stale (ran 2026-07-16 on `f8acf24`).** Re-verified every EX-496 finding against current
  `staging` on 2026-07-17: bugs #2 (sort no-op, EX-487), #3 (coeff/VAT swallow, EX-496-partial +
  EX-522), #5 (ownership, actions now derive investment from the section), and #8 (dead
  `kosztorysDoneNetForView`, removed) are **already resolved**. This change owns only what's still open.
- **#4 (missing `investments` cache tag) — FIXED 2026-07-17, ahead of the plan.** The three settings
  actions (`updateInvestmentCoeffsAction`/`updateInvestmentVatAction`/`updateInvestmentGlobalDiscountAction`)
  mutate an `investments` row but tagged only the denormalized sheet cache; the `investments` tag was
  bumped only by the collection afterChange hook (lazy `revalidateTag`, action-at-a-distance). Added
  `'investments'` to all three tag arrays (immediate `updateTag`, matching `restoreSnapshotAction`).
  typecheck clean.
- **Still open:** the three compiler bails (#1), the 13 no-op `ViewPricingT` casts (#6), dead
  `widthsKey`/`stagesKey` (#7), plus the three structural extractions (settlement.ts / HEADER_TIPS / Pick<>).

- **Phase 2 (the compiler unblock) was tried, then REVERTED — it caused a perf regression (owner
  confirmed by manual A/B, 2026-07-17).** The compiler bail could only be cleared by removing the
  `rowsRef`/`stagesRef` mirrors (their render-phase read AND write both bailed) and moving the
  interactive cell handlers off `columnOpts` into the `KosztorysEditorProvider` context so they no
  longer cross a plain-function (`buildV2Grid`) call during render. That wiring backfired: the context
  **value is the whole hook return object, whose identity churns every render**, and **React re-renders
  every context consumer on a value-identity change — `React.memo` / datasheet-grid's per-row
  memoization does not stop it.** So `RowActionsCell` / `SectionNameGridCell` / `StageHeaderCell`
  (per-row / per-header) all re-rendered on every keystroke instead of only the edited cell → "slow and
  jumpy" on a grid that can hit 1000+ rows. The un-memoized hook had been smooth for its whole life; the
  memoization it was chasing was never the bottleneck, and the fix introduced a real one. Reverted p2's
  runtime change (props path + refs restored) via `git revert 4c7a1cd`; p3/p4 cleanups auto-merged
  around it and stayed. The p1 compile-assert guard was deleted with it — its premise (hook emits `_c`)
  is exactly what we gave up.
  - **Deeper reason it can't be salvaged cheaply:** compiler memoization needs _no_ refs, but stable
    handler identity (what would keep the context value from churning) _needs_ refs — and
    `getRemovePlan` closes over render-fresh `rows` regardless. Reconciling the two is the cohesive
    stateful-unit restructuring already scoped as **EX-521**. So EX-496 #1 (memoize the hook) is
    **reopened, blocked on EX-521**, not achievable as a standalone surgical fix.

Plan: `plan.md` · Brief: `plan-brief.md`.

## Status: implemented (cleanups only), pre-review

**What shipped and stands:** #4 `investments` cache tag (`aa35411`), #6 no-op `ViewPricingT` cast
removal + #7 dead `widthsKey`/`stagesKey` removal (p3 `0e4bd16`), and the `Pick<>` opts narrowing (p4
`5e6a9a6`). **What was reverted:** #1 the React-Compiler memoization (p2 `4c7a1cd` + the p1 guard) —
see the bullet above; reopened as blocked-on-EX-521.

The revert is **uncommitted-then-committed here**; automated `pnpm typecheck` clean, and the owner
confirmed the editor is smooth again.

**Change B (EX-521, the god-hook split) is PARKED** — not started (owner, 2026-07-17). It carries a
dependency-install prerequisite (`@testing-library/react` + a DOM env, which the repo currently
lacks and which trips the arm64 `lightningcss` hazard) and real architectural risk, so it is not an
ad-hoc follow-on to A. EX-496 #1 now waits on it.
