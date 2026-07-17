---
id: kosztorys-editor-compile-fix
title: Restore React Compiler memoization to useKosztorysEditor + clear the verified EX-496 tail
status: implementing
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

Plan: `plan.md` · Brief: `plan-brief.md`.
