Scope: net Change A diff vs `af6d176` (before `aa35411`). Memoization (p2) was reverted,
so the reviewable surface is **cleanups only**:

- `src/lib/actions/kosztorys.ts` — #4 `investments` cache tag on the three settings actions.
- `src/components/kosztorys/kosztorys-v2-columns.tsx` — dropped no-op `ViewPricingT` casts + `Pick<>`-narrowed leaf opts.
- `src/components/kosztorys/use-kosztorys-editor.ts` — dropped dead `widthsKey`/`stagesKey`.

Surviving fan-out checks: `/10x-impl-review`, `/code-review`, `comment-noise-audit`.
Dropped (don't apply): `tailwind-v4-audit` (no className/style change), `structure-scatter-audit`

- `feature-first-structure` (no new/moved files), `module-cohesion-audit` (no structural change).
  No Step 0.5 verification pass (no `verify-manual-checks` skill; owner already A/B-verified smoothness).

## Findings

<!-- one checkbox per finding, all sources fold here; most-severe first -->

- [x] 🔵 · fixed · `code-review` / `comment-noise` · `src/lib/actions/kosztorys.ts:114-116,130-132,149-152` · the three rewritten cache-tag comments assert a "sheet cache" / "item-section tags cover the denormalized copy" — but `getKosztorysTree` is uncached and NO `unstable_cache` reader is tagged `kosztorysItems`/`kosztorysSections`; only `investments` invalidates a live reader (`getInvestment`, `fetchReferenceData`). Rewrote the comments to name the real `investments`-tagged readers and drop the phantom-cache framing. — the `investments` tag addition itself is correct & load-bearing.
      test: no automated test — comment-accuracy only, no runtime behavior changed.
- [x] · dismissed · `impl-review` (F2) · `kosztorys-v2-columns.tsx:45` · header-tips module filename differs from plan's `e.g.` example — plan wrote "e.g.", module is real/single-source/imported correctly; not drift.
- [x] · skipped · review-side-finding · `src/lib/actions/kosztorys.ts:117,133,152` + collection hooks · `kosztorysItems`/`kosztorysSections` tags currently have NO cached reader → invalidating them is a no-op today. **Pre-existing** (predates Change A — the change only added `investments`), out of this cleanup slice's scope, and plausibly reserved for a future cached sheet reader during the v2 build. Not stripped (behavior-neutral today, removal is out of scope + speculative). Surfaced to owner.
- [x] · dismissed · `impl-review` (F1) · `manual-checks.md:443` · `investments` cache-tag manual check still unticked — that's the archive-gate manual-verification blocker, tracked in the archive gate below, not a code defect.

- [x] · fixed · `simplify` (reuse) · `src/lib/kosztorys/sort-value.ts:25` · same `as unknown as ViewPricingT` double-cast the columns cleanup deleted, still threaded through a `pricing` local + `ViewPricingT` import in the sort helper. Dropped the cast/local/import; pass `row` directly — proven safe by the identical columns.tsx cleanup (KosztorysV2RowT ⊇ ViewPricingT). Consistency tail of the reviewed cleanup, adjacent file, in scope.
- [x] · dismissed · `simplify` (simplification) · `kosztorys.ts:114,130,150` · three cache-tag comments share a near-identical trailing sentence — DRYing into a constant/helper costs more indirection than the repetition; per-action first sentence is distinct. Leave.
- [x] · dismissed · `simplify` (altitude) · `kosztorys.ts:117,133,152` · three `investments`-tag additions don't warrant a shared invalidation helper — tag sets legitimately differ (coeffs also `kosztorysSections`); `protectedAction`'s tag-array arg IS the shared primitive. Correct altitude.

impl-review: **APPROVED** (0🔴 / 0🟡 / 2🔵). code-review: **no correctness bugs** (1🔵, fixed above). comment-noise-audit: 0 deleted / 0 trimmed / 0 flagged. simplify: 1 fixed, 2 dismissed.

## Simplify pass

Ran /simplify — 1 applied, 0 proposed, 2 dismissed; each finding folded into ## Findings (tagged simplify). Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.glzpVLEb8M.md`

## Tests & suite

- typecheck (my slice): **clean** — neither `sort-value.ts` nor `kosztorys.ts` (my only edits) appears in tsc output.
- typecheck (full project): **red**, NOT attributable to this slice — 3 errors all in a concurrent agent's uncommitted `kosztorys-progress-percent-view-invariant` work (`kosztorys-editor-toolbar.tsx` `totalPlannedNet`, `kosztorys-v2-rows.test.ts` index-signature). Not touched by this gate.
- lint / unit / build: deferred — a clean full-suite run is impossible while the parallel agent's in-flight edits pollute the tree.
- No new tests owed: the code finding was comment-accuracy (no test); the sort-value cleanup is a behavior-identical no-op refactor; #4 cache-tag shipped earlier with a registered manual check. No browser-level risk → no E2E owed.

## Archive gate — NOT archived (in review)

- Findings blocker: **clear** — every `## Findings` box is `[x]`, no open findings.
- Manual-verification blocker: **open** — `manual-checks.md:443` (#4 cache tag: VAT/coeff/discount reflects in grid+sums without reload) still `[ ]`. Perf check (`:439`) signed off.
- → Slice stays **in review**. Not in `roadmap.md` (Linear-only slice); EX-496 status line posted (comment `11f401b2`). Prod migration N/A (no schema change in this slice).
