# Kosztorys Editor — React Compiler Unblock + EX-496 Tail — Plan Brief

> Full plan: `context/changes/kosztorys-editor-compile-fix/plan.md`
> Audit (stale — see below): `context/changes/kosztorys-v2-audit/audit.md`

## What & Why

`use-kosztorys-editor.ts` emits **zero** `_c` cache slots — React Compiler silently bails on three
constructs, and because `panicThreshold` defaults to skip-and-continue there is no build error, lint
warning, or console message. So every _compiled_ downstream consumer (`kosztorys-toolbar-actions`
`_c(21)`, the datasheet grid's `columns`) misses on every keystroke. Restore compilation, then lock it
behind an automated guard so it can never silently regress again.

## Starting Point

The hook (740 lines) is the one file in the feature the compiler skips; every sibling compiles. Three
sequential bails: a computed key with a call-expression value (`:405`), a forward reference
(`handleRemoveItem`→`handleRemoveSection`, `312→457`), and render-phase ref reads
(`getRemovePlan`/`removalPlan` read `stagesRef.current`). The EX-496 audit that found this ran
2026-07-16 on an older branch and is **substantially stale** — re-verification on 2026-07-17 shows
four of its findings already resolved.

## Desired End State

The standalone compile emits `_c(n)` for `useKosztorysEditor` and logs no bail; a Vitest test fails
the suite if that regresses. The 13 no-op `ViewPricingT` casts and the two dead return keys are gone,
finding #4 is decided, and the three structural extractions (`settlement.ts`, `HEADER_TIPS`, `Pick<>`)
have landed. No behavior changes — this is identity-stability + cleanup.

## Key Decisions Made

| Decision                       | Choice                                                | Why                                                                                                                               | Source |
| ------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Bundle 496 + 521?              | Two separate changes; this is A                       | Different risk/testing profiles; 496 is surgical, 521 is structural — 496 is Urgent and shouldn't wait behind the split's harness | Plan   |
| Guard against silent re-bail   | Automated compile-assert test (Vitest + babel plugin) | The bug _is_ a silent de-opt; only reading the compiled output catches recurrence                                                 | Plan   |
| Fix the ref-during-render bail | Narrow — render path reads `stages`; keep the refs    | Ref removal is EX-422 / EX-521 scope; narrow fix unblocks the compiler without widening                                           | Plan   |
| Cleanup scope                  | Everything still-open incl. `settlement.ts`           | User chose full EX-496 closure in this change                                                                                     | Plan   |
| Already-resolved findings      | Dropped from scope (#2, #3, #5, #8)                   | Re-verified fixed on current `staging`                                                                                            | Plan   |

## Scope

**In scope:** the 3 compiler-bail fixes + automated guard; drop dead `widthsKey`/`stagesKey`; remove
the 13 `ViewPricingT` casts; verify/decide the `investments` cache tag (#4); extract `settlement.ts`,
`HEADER_TIPS`, `Pick<>`-narrow the opts bag.

**Out of scope:** the hook split (EX-521 / Change B); removing `rowsRef`/`stagesRef` (EX-422); the four
already-resolved findings; any `setRows`-invariant or behavior change.

## Architecture / Approach

Test-first on the compiler fix: author the compile-assert guard, watch it fail on current code (the
failure reproduces the silent de-opt), then land the three surgical bail fixes to green — which
doubles as the recompile proof. Cleanup and structural extractions follow, each gated by typecheck +
the now-green guard + the existing behavior suite.

## Phases at a Glance

| Phase                         | What it delivers                                                                          | Key risk                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Compile-assert guard (red) | Vitest test compiling the hook via `babel-plugin-react-compiler`, failing on current code | Harness fails for the wrong reason (babel resolution) — confirm red is the _bail_   |
| 2. Compiler unblock (green)   | 3 bail fixes; `_c(n)` restored                                                            | A fix changes behavior — mitigated by the green existing suite + manual editor pass |
| 3. Dead code + casts + #4     | Remove dead keys, strip 13 casts, decide the cache tag                                    | A cast bridges a real mismatch — typecheck gates each removal                       |
| 4. Structural extractions     | `settlement.ts`, `HEADER_TIPS`, `Pick<>`                                                  | `settlement.ts` relocation drift — typecheck + suite catch it                       |

**Prerequisites:** none (Change B depends on _this_, not vice versa). **Do not `pnpm add`** the babel
deps — resolve them from the pnpm store (arm64 `lightningcss` hazard, per `AGENTS.md`).
**Estimated effort:** ~1–2 sessions across 4 phases; Phases 1–2 are the Urgent core and can ship alone.

## Open Risks & Assumptions

- The compile-assert harness must resolve `@babel/core` + `babel-plugin-react-compiler@1.0.0` from the
  pnpm store (not hoisted) and parse with `{ plugins: ['jsx', 'typescript'] }` — the audit documents
  the exact resolution.
- Bail #3's narrow fix assumes handlers re-close over fresh `stages` each render (true since the
  mount-frozen closure was removed in `ee497cb`); if a render path still needs the ref, the fix widens
  toward EX-422.
- Finding #4 may be a no-op (items-only tagging already correct); the phase decides rather than assumes.

## Success Criteria (Summary)

- Standalone compile of `use-kosztorys-editor.ts` emits `_c(n)`; the Vitest guard is green and stays green.
- Editor behaves identically end-to-end (stages, items, sections, settings) with the existing suite green.
- The 13 casts and two dead keys are gone; `settlement.ts` / `HEADER_TIPS` / `Pick<>` have landed; #4 decided.
