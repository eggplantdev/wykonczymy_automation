# Review-gate ledger — subcontractor-ceiling-warn · 2026-09-20

**Change:** the 65% subcontractor-price ceiling stops refusing and starts warning. A crew genuinely
does cost more than 65% of the client price sometimes, and a kosztorys that cannot record it lies
(owner, 2026-09-20). The red cell and the toast stay; the write now commits.

**Shape:** `checkSubcontractorPrice` returns a two-tier `CellVerdictT = { severity: 'refuse' | 'warn' }`.
`refuse` (negative price only) un-writes and rolls back; `warn` (above ceiling) commits silently per
keystroke and is announced once on settle.

**Files (18, uncommitted on `staging`):** the 11 the slice started with —
`src/lib/kosztorys/{cell-edit,subcontractor-price-guard,discount-edit}.ts`,
`src/lib/kosztorys/work-catalogue/append-catalogue-items.ts`,
`src/components/kosztorys/editor/grid/cells/{use-cell-draft.ts,subcontractor-columns.tsx}`,
5 specs under `src/__tests__/` — plus 7 the review pulled in:
`src/lib/kosztorys/row-conditions/registry.ts`,
`src/components/tables/work-catalogue.tsx`,
`src/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.tsx`,
`src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts`,
`context/reference/kosztorys-editor-domain-notes.md`, and 2 more specs.

**Step 0.5 (browser verification) was NOT run** — the verification skill drives a browser and the
standing rule forbids that unprompted. Manual verification is therefore still owed before archive.

## Findings

<!-- [box] · [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — why -->

**Przycięte przy archiwizacji (2026-09-22).** Wszystkie findingi `fixed` usunięte — trwałym zapisem
naprawy jest jej commit, a nie wiersz w ledgerze; co przeżywa, to negatywna przestrzeń, której git nie
utrzyma: co świadomie **odrzucono**, **porzucono**, **odłożono** albo **wyniesiono do Lineara**. Stan
sprzed przycięcia (obie sekcje razem): **16 fixed, 3 filed, 8 dismissed, 7 dropped, 3 skipped ·
0 otwartych.**

- [x] filed EX-819 · `owner ruling 2026-09-21` · `src/components/ui/decimal-field.tsx:85-94` +
      `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:109` +
      `src/components/kosztorys/summary/materials-net-pricing-control.tsx:65` ·
      **out-of-range has three different answers in the app, and two of them are silent.** The cell
      rolls back AND says so („Nieprawidlowa wartosc — przywrocono X"); `min`/`max` on a `DecimalField`
      snaps back with no word (`vat-rate-field.tsx:26-27`, and the mnoznik's `min={0}`); the two stawka
      VAT na materialy fields pass NO bounds and clamp inside `onCommit`
      (`Math.min(Math.max(percent, 0), 100)`), which does not reject the entry at all — it **writes a
      different number than was typed** and reports success. A fat-fingered `230` for `23` saves 100%
      and reprices the whole materialy plane; the comment beside it names that exact case as the
      intended behaviour. Reachability puts it ABOVE the mnoznik floor this finding started as: `-0,5`
      needs a deliberate minus, `230` is one extra digit.
      **Correction to the first draft of this line:** it claimed 4 callers depend on the silent snap.
      Only TWO callers pass bounds at all (`vat-rate-field`, the mnoznik); `discount-value-field` does
      not use `DecimalField`; the other two use the clamp instead. The fix is smaller than filed.
      **Proposed:** `DecimalField` rejects out-of-range the way a cell does — restore + one sentence —
      and the two materials fields drop the clamp for `min={0} max={100}`. That deletes the
      clamp-in-`onCommit` pattern, leaving one answer to out-of-range app-wide.
      **Filed EX-819** (2026-09-21), test disposition carried into the issue.
- [x] 🟡 WARNING · filed EX-820 · `simplify/altitude` · `src/lib/kosztorys/row-conditions/registry.ts:305,316` ·
      an accepted over-ceiling price now sits permanently in the „Problemy" menu. `kind: 'diagnostic'`
      routes it through `problem-conditions.ts:19` into a surface whose label is „Pokaż tylko to, co
      wymaga poprawki", whose trigger is a destructive triangle, and which by design exists only while
      something is wrong. The owner ruled the red cell and the toast in; this third surface was never
      part of that ruling, and unlike the other two it cannot be cleared — it says „zepsute" about a
      state the owner just called legitimate. Same entry also still collapses both tiers into one
      count under a label („ze zbyt wysoką stawką") that names only the warn one.
      Changes what the user SEES on a surface the owner didn't rule on → surfaced, not applied.
      **Sharpened by the mnożnik fix above (2026-09-21):** this is no longer a per-row edge. With the
      cap gone, one keystroke in the toolbar puts EVERY „auto" pozycja over the ceiling at once — a
      thousand-row kosztorys goes fully red and its entire „Problemy" list fills with a state the owner
      deliberately made legal. The alarm's own premise („wymaga poprawki") is then false for every
      entry in it.
      **Filed EX-820** (2026-09-21) with the three options — leave it, split the two tiers, or move
      the warn tier off the alarm — plus the dead `RowConditionT.tone` field as related cleanup.

- [x] 🟡 WARNING · dismissed · `structure-scatter` + `module-cohesion` · `src/lib/kosztorys/work-catalogue/append-catalogue-items.ts` ·
      "the verdict's severity is discarded at the server seam". Verified unreachable: `money()` enforces
      `.min(0)` at **both** the form layer (`moneyIssue`) and the domain layer (`z.number().min(0)`), so
      the only refusing verdict cannot fire on that path.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/kosztorys/cell-edit.ts` (`cellPaste`) ·
      a pasted over-ceiling price lands with no toast. Intended: paste has no settle, and the red cell
      it leaves behind is visible at paste time.
- [x] dismissed · `structure-scatter` · `src/lib/kosztorys/row-conditions/registry.ts:305,316` ·
      **supersedes the Step-1 "needs a third `tone`" finding.** `RowConditionT.tone` is declared in
      `row-conditions/types.ts:51` and written 12× in the registry, and read **nowhere** in the app —
      verified by grep across `src`, including the tests. Adding a third tone would change metadata no
      renderer consults. The vocabulary that actually renders the claim is `kind`, which is the open
      „Problemy" finding above.
- [x] dropped · `simplify` (altitude) · `src/lib/kosztorys/row-conditions/types.ts:51` ·
      `tone` is dead and could be deleted with its 12 registry writes. Unrelated to this slice — it
      predates the ceiling change entirely — so sweeping it in here would be scope the user didn't ask
      for. **Offered separately** rather than filed.
- [x] dropped · `simplify` (altitude) · `src/lib/kosztorys/subcontractor-price-guard.ts:2` ·
      "a domain rule imports its verdict type from the grid's editing machine — the dependency points
      the wrong way." Real direction, but there is no better home: `CellVerdictT` has **two** producers
      (this guard and the rabat policy in `discount-edit.ts`) and one consuming machine, so it is the
      edit contract's own vocabulary and a guard implementing that contract importing it is ordinary.
      Reason recorded in place of the Step-1 "cosmetic rename" dismissal, which answered the shallow half.
- [x] skipped · `simplify` (efficiency) · `src/lib/kosztorys/row-conditions/registry.ts:309,319` ·
      the two predicates ask `checkSubcontractorPrice(…) != null`, so every **breaching** row allocates
      a verdict object plus a full Polish sentence (an `Intl` format via `formatNet`) on a per-keystroke
      recount, and throws all but the nullness away. A message-free `subcontractorPriceProblem(row,
view)` with `checkSubcontractorPrice` as the thin message wrapper is the right shape. Not applied:
      the agent's "2000 discarded formats per keystroke" assumes every row breaches — only breaching
      rows pay, so on a realistic kosztorys this is well under a millisecond — **and** the call site it
      would optimize is itself the open „Problemy" question above. Refactoring underneath an unresolved
      semantics decision is work that gets redone.
- [x] skipped · `module-cohesion` · `src/lib/kosztorys/discount-edit.ts` ·
      `DiscountTypeSwitchT` could consolidate with its neighbours. Pre-existing, untouched by this
      change, large enough to deserve its own review.
- [x] dropped · `simplify` (simplification) · `src/__tests__/lib/kosztorys/cell-edit.test.ts:19,25` ·
      the `capped` / `warned` stand-in policies could come from one factory. Params would equal the
      code — a 3-line factory to replace two 4-line literals that differ by two string constants.
- [x] dropped · `simplify` (simplification) · `src/lib/kosztorys/subcontractor-price-guard.ts:40` ·
      `isOverCeiling(price, row)` could take `clientPrice: number` instead of a one-field row. Rejected:
      two bare `number` parameters can be transposed silently and still typecheck; the row wrapper is
      what makes that impossible.
- [x] dropped · `feature-first-structure` · `subcontractor-columns.tsx` ·
      `CellTooltip` could move to its own file. One consumer, small, not worth the churn.
- [x] dropped · `code-review` · specs ·
      coverage nits: paste under the real subcontractor policy, and `own_tools` driven through the
      cell. The stand-in policies already cover both machine branches.

## Findings — second pass (2026-09-21, the mnożnik follow-up)

The mnożnik fix above was written AFTER the Step-1 fan-out and so had never been reviewed itself.
Re-gated `subcontractor-price-guard.ts`, `kosztorys-global-settings.tsx` and the new
`kosztorys-global-settings.test.tsx` — two read-only agents (correctness / quality), then the fixes.
The 17 files last touched 2026-09-20 were NOT re-reviewed: they are unchanged since the pass above.

    przez focus` asserts silence on a bare focus-pass. Written red first: it failed with exactly one
      „Mnożnik 0,9 przekracza 65%…" toast, then went green on the guard.

- [x] dismissed · `reuse` · `subcontractor-price-guard.ts:64` ·
      "`coeffCeilingWarning` returns `string | null` while its sibling returns `CellVerdictT | null`,
      and `'warning'` is hardcoded at the call site." The shape difference is the point: the coeff has
      exactly ONE tier (it can only warn — the floor is `min={0}`, a different mechanism), so a
      `refuse | warn` union there would advertise a choice that does not exist and invite a consumer to
      branch on it.
- [x] dismissed · `module-cohesion` · `subcontractor-price-guard.ts` ·
      "the module name no longer covers its contents; `client-share-ceiling.ts` would." All five exports
      serve the one 65% rule, and the mnożnik IS the subcontractor-price multiplier — the name still
      reads true. A 7-importer rename for a nuance is churn.
- [x] dropped · `code-review` · `subcontractor-price-guard.ts:66` ·
      `formatCoeff` renders 6 decimals, so a coeff of `0,6500001` prints as „Mnożnik 0,65 przekracza
      65%…" — a sentence contradicting itself. Requires typing seven decimals into the mnożnik; at that
      reachability the rounding is not worth a special case.
- [x] skipped · `code-review` · `use-kosztorys-settings.ts:91-102` ·
      `applyGlobalCoeff`'s failure path rolls back the rows' denormalized coefficients but not
      `tree.globalCoeffs`, so after a failed save the toolbar can keep showing a red 0,9 that was never
      persisted, until `router.refresh` lands. Real, but it is the rollback path's own asymmetry and
      predates this change — the ceiling only made it visible. Belongs with whoever fixes that rollback.
- [x] filed EX-819 (comment) · `code-review` · `src/lib/actions/kosztorys.ts:76-81` ·
      `investmentCoeffsSchema` carries neither `.min()` nor `.max()` while every sibling schema in the
      file does, so the client-side `min={0}` is the SOLE guard against a negative mnożnik reaching the
      DB — and it is the silent snap-back EX-819 is already about. Added there rather than filed anew,
      with an integration-level assertion added to that issue's test disposition.
      test: test-driven-debugging · integration — carried into EX-819.
- [x] dismissed · `docs` · `context/changes/2026-09-18-lead-delivery/{change.md,plan-brief.md}` ·
      the other two dirty files, a different change. Pure decision records (two owner rulings, `## Open`
      emptied). The one thing that could have rotted — „`landing_26`'s `AGENTS.md` gets the carve-out
      written down" stated as a promise while `## Open` goes empty — **verified landed**:
      `/workspace/yolo/landing_26/AGENTS.md` carries the scoped carve-out, dated 2026-09-21.
- [x] dismissed · `tailwind-v4` · the three re-reviewed files ·
      no arbitrary `[…]` values, no `var(--token)` in brackets, no inline styles. No responsive prefix
      at all, so the overridden 768/1024/1280 scale is not in play — the toolbar row wraps instead.
- [x] dismissed · `feature-first-structure` · `kosztorys-global-settings.tsx:33` ·
      `CoeffField` colocated as a private sub-component. One consumer, one directory → colocated is the
      rule, and the extraction is what makes it impossible to apply the warn behaviour to only one plane.

## Simplify pass

Ran `/simplify` — 4 agents (reuse / simplification / efficiency / altitude): **4 applied, 4 dropped,
1 skipped, 1 left open for you**; every finding folded into `## Findings` above tagged `simplify`. No
separate report file. Reuse returned no findings of its own beyond the `formatPercent` near-match.

Two agents converged independently on the `warning`-on-`commit` leak, which is the pass's main catch.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec vitest run src/__tests__/lib/kosztorys/ src/__tests__/components/kosztorys/editor/grid/cells/ src/__tests__/components/tables` — **1100 passed, 45 skipped, 0 failed** (one fewer than before: the deleted subset spec).
- `subcontractor-price-edit.test.tsx` after adding the unmount guard — **10 passed**.
- After the mnożnik fix (2026-09-21), same three trees re-run — **1363 passed, 45 skipped, 0 failed**
  (`kosztorys-global-settings.test.tsx` adds 4).
- Second pass (2026-09-21, after the no-op-blur fix + constant dedup): `pnpm exec tsc --noEmit` clean;
  `vitest run src/__tests__/lib/kosztorys/ src/__tests__/components/kosztorys/ src/__tests__/components/tables`
  — **1364 passed, 45 skipped, 0 failed** (one more than before: the new focus-pass regression spec).
  `eslint` + `prettier --check` clean on all seven touched files.
- Full suite (`lint` / `build` / `test:e2e`): **not run** — awaiting the user. `test:e2e` is ~1h and is never run unprompted.
- Known ambient noise, not a failure: `connect ECONNREFUSED 127.0.0.1:465` from Payload's Nodemailer
  transport verification. Known flake, untouched by this slice:
  `src/__tests__/components/filters/search-filter-input.test.tsx` fails only under full-suite load.

## Archive blockers

1. ~~Two open `[ ]` findings~~ — **both filed 2026-09-21**: EX-819 (out-of-range has three answers,
   two silent) and EX-820 („Problemy" calls an accepted over-ceiling price broken). The second pass
   added 11 more findings, all terminal. **No open boxes left in either section.**
2. Step 0.5 browser verification was never run (the verification skill drives a browser; not run unprompted).
3. Full suite (`lint` / `build` / `test:e2e`) not run.
4. Nothing is committed yet.
