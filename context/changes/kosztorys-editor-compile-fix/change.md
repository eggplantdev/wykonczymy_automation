---
id: kosztorys-editor-compile-fix
title: Restore React Compiler memoization to useKosztorysEditor + clear the verified EX-496 tail
status: implemented
branch: staging
created: 2026-07-17
updated: 2026-07-17
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

- **Phase 2 widened beyond the plan's "surgical" premise (owner decision, 2026-07-17).** The plan
  modeled three bail fixes. Two landed as written (computed-key hoist; `handleRemoveSection` forward
  ref). Bail #3's premise was wrong: the render-phase ref access wasn't reads-only — the `rowsRef`/
  `stagesRef` mirror **writes** bailed too, so the refs were removed entirely (reads rewritten to
  `rows`/`stages`). Removing them then exposed the real blocker the plan had fenced as EX-521: the
  interactive cell handlers (which capture `prevById`, a ref) were bundled into `columnOpts` and passed
  to the **plain function** `buildV2Grid` during render — React Compiler bails when a ref-capturing
  closure crosses a plain-function call in render (proven: the same closure as a JSX prop to a component
  compiles). Fix (chosen over defer-to-EX-521): the interactive handlers now reach their cells through
  the existing `KosztorysEditorProvider` context; `buildV2Grid` receives only pure display config plus a
  `rowActions` boolean. A fourth bail then surfaced (`PruneHoistedContexts`: `patchRows` was forward-
  referenced by `handleAddStage`/`handleRemoveStage`) — fixed by hoisting `patchRows` above its callers.
  Net: the hook now emits `_c` slots, guard green, typecheck/lint/suite clean. Touched:
  `use-kosztorys-editor.ts`, `kosztorys-v2-columns.tsx`, `kosztorys-v2-column-opts.ts`.

Plan: `plan.md` · Brief: `plan-brief.md`.

## Status: implemented, pre-review

All phases are committed (p1 `563859e`, p2 `4c7a1cd`, p3 `0e4bd16`, p4 `5e6a9a6`, close-out
`7fd332e`) with automated checks green. **The `slice-review-gate` has NOT run yet** — no review
fan-out, no `/simplify` pass, no `review-gate.md` ledger for this change. EX-496 sits `[in review]`
(the team has no `In Review` state) and manual-checks remain unticked, so it is **not** `Done` and
**must not be archived** until the gate runs and its findings + manual checks are resolved.

**Change B (EX-521, the god-hook split) is PARKED** — not started (owner, 2026-07-17). It carries a
dependency-install prerequisite (`@testing-library/react` + a DOM env, which the repo currently
lacks and which trips the arm64 `lightningcss` hazard) and real architectural risk, so it is not an
ad-hoc follow-on to A.
