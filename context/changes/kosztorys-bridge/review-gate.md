# Review-gate ledger — kosztorys-bridge · 2026-07-18

## Findings

<!-- ONE checkbox per finding; most-severe first. -->

### From Step 0.5 (verification pass)

- [x] fixed · verify · `src/components/forms/deposit-form/deposit-form.tsx:50` · empty-string SelectItem crashed the zaliczka etap select — fixed with `NO_STAGE='none'` sentinel (commit aad42dda)
      test: test-driven-debugging · e2e — browser-only Radix render crash; regression guard filed to e2e-backlog as **EX-531** (deposit→zaliczka flow). Box closed on filing.

### From Step 1 (review fan-out)

- [x] 🟡 WARNING · fixed · code-review · `src/lib/queries/reference-data.ts:169` · `fetchReferenceData` blob feeds the deposit form's etap dropdown from a 6th SQL query but its tags array lacked `CACHE_TAGS.kosztorysStages` → stale etap list after a stage add/rename/delete. Added the tag.
- [x] fixed · code-review · `src/lib/queries/reference-data.ts:244` · `fetchZaliczkiByStage` cached only under `CACHE_TAGS.transfers`; a stage delete (ON DELETE SET NULL) untags its deposits without busting the transfers tag → stale editor join. Added `CACHE_TAGS.kosztorysStages`.
- [x] fixed · impl-review · `src/components/kosztorys/kosztorys-editor-body.tsx:119` · Podsumowanie `zaliczkiNet` summed over ALL `zaliczkiByStage` keys; a cross-investment stale key would diverge from KosztorysEtapTotals (which sums over `stages`). Reconciled to `stages.reduce`.
- [x] fixed · impl-review · `src/lib/actions/transfers.ts:50` · stale/deleted `kosztorysStage` id made `findByID` throw Payload's English NotFound instead of the Polish `'Wybrany etap nie należy do tej inwestycji.'`. Switched to `find` + where so an empty result flows through the Polish branch.
- [x] fixed · code-review · `src/components/forms/form-fields/entity-combobox-field.tsx:49` · `listeners?: any` (eslint-disabled) → typed `{ onChange?: () => void }` (only member used at call sites).
- [x] fixed · code-review · `src/lib/kosztorys/settlement.ts:89` · non-null assertion `totals.get(st.id)!` (map pre-seeded so safe, but global rule avoids `!`) → `?? 0`.
- [x] dismissed · impl-review · `src/components/kosztorys/kosztorys-v2-columns.tsx` · `markLayerBoundary` change flagged — NOT this slice; co-tenant's uncommitted work in the shared tree. Left untouched per the never-mutate-a-parallel-tree rule.
- [x] dismissed · code-review · pre-existing floating-promise / 404 patterns outside this diff — not introduced by the slice; out of scope.
- [x] dropped · comment-noise · two mild comment restatements in the Podsumowanie/EtapTotals additions — not worth the churn.
- [x] dismissed · impl-review · Robocizna base (F3) — **owner ruled Executed (current), 2026-07-18**: „Robocizna" stays on suma prac wykonanych (`T`-derived `doZaplatyNet`), and „Aktualnie do zapłaty (R + M)" nets `executed − zaliczki + Materiały`. No code change; netting semantics confirmed.

### From Step 2 (/simplify)

- [x] fixed · simplify · `src/lib/kosztorys/money-axis.ts:12` · added `axisShows(axis)` helper and deduped the `showNet`/`showGross` derivation across podsumowanie / etap-totals / totals-bar (was 3 verbatim copies).
- [x] fixed · simplify · `src/lib/kosztorys/settlement.ts:87` · `stageTotalsForView` re-priced each row's net once per stage; hoisted `netForQtyForView` out of the stage loop (≈10×→1× per row in a hot memo). Behavior-identical (`stageValueForView = netForQtyForView × qty/totalQty`), verified by kosztorys-settlement.test.ts. Dropped the now-unused `stageValueForView` import.
- [x] dropped · simplify · `kosztorys-editor-body.tsx` + `kosztorys-etap-totals.tsx` · Σ zaliczki reduced twice — trivial one-liner, not a helper reimplementation; deduping would worsen the etap-totals prop contract (it needs the map anyway). Not worth the churn.
- [x] dropped · simplify · `deposit-form.tsx:133,143` · two back-to-back `showsInvestment(currentType)` guards could nest — cosmetic, borderline.
- [x] dismissed · simplify · `transfers.ts:61` · bare `console.log('[PERF] …')` vs SENTRY marker — matches surrounding perf-log convention, intentional.
- [x] dismissed · simplify · `kosztorys-v2-columns.tsx` komentarz/`markLayerBoundary` — co-tenant's uncommitted work in the shared tree, not this slice.
- [x] fixed · simplify · `kosztorys-etap-totals.tsx:37` · Netto / Brutto / Zaliczki were three near-identical `<tr>` + `stages.map` blocks (owner-flagged) — collapsed into one `row(label, cell, total)` helper. No behavior change.
- [x] fixed · simplify · `kosztorys-podsumowanie.tsx:64` · the „Aktualnie do zapłaty (R + M)" footer `<tr>` re-implemented the `row` helper's netto/brutto structure — folded into `row` by making `share` optional (`'share' in line`). No behavior change.
- [x] fixed · simplify · `summary-economics.ts:8` · `{ net, gross: toGross(net, vatRate) }` was built in both `computePodsumowanie`'s `line()` and `computeDoZaplatyRM` — extracted `moneyPair(net, vatRate)`; `SummaryLineT = MoneyPairT & { share }`. Specs green.
- [x] fixed · simplify · `sum-transfers.ts:259` · deposit-type SQL literal `('INVESTOR_DEPOSIT','COMPANY_FUNDING','OTHER_DEPOSIT')` repeated across `sumRegisterBalance`, `sumAllRegisterBalances`, and the slice's new `sumDepositRowsForInvestment` — extracted a `depositTypesInList` `sql` fragment derived from the single `DEPOSIT_TYPES` const and used it in all three. **Dedup is never out of slice scope** (owner, 2026-07-18) — a fix touching pre-existing/adjacent code is still in scope. Behavior-preserving: bound-param enum `IN` verified against the real DB (237 rows); typecheck + 42 balance/deposit specs green.

### From primitive-reuse-scan (post-/simplify, pre-commit)

Catalogued the repo's primitive homes (`components/ui`, `hooks`, `lib/**`, `types`, feature `use-*`) and matched the diff's new symbols against it. **Clean** — this set is itself the `/simplify` output, so its new symbols are the reuse wins, not reinventions:

- [x] dismissed · reuse-scan · `money-axis.ts:14` · `axisShows` — no pre-existing net/gross-flag helper; this is the extraction the 3 summary components now share.
- [x] dismissed · reuse-scan · `summary-economics.ts:7` · `moneyPair` — no other net+gross pair builder in the catalogue; wraps `toGross`.
- [x] dismissed · reuse-scan · `sum-transfers.ts:15` · `depositTypesInList` — no shared deposit-type SQL fragment existed; derived from the single `DEPOSIT_TYPES` const.
- [x] dropped · reuse-scan · `kosztorys-etap-totals.tsx:38` + `kosztorys-podsumowanie.tsx:38` · two local `row` helpers — structurally distinct tables (per-etap columns vs fixed netto/brutto/udział); a forced shared primitive would be worse, not a dupe.
- [x] dropped · reuse-scan · `kosztorys-totals-bar.tsx` · repo has two parallel net-money formatters (`lib/kosztorys/format.ts › formatNet` vs `lib/utils/format-currency.ts › formatPLN`) — pre-existing; this diff introduced neither, so out of the scan's diff-scoped remit. Noted for a future consolidation pass, not filed here.

## Simplify pass

Ran /simplify (4 cleanup agents: reuse / simplification / efficiency / altitude) — 2 applied, 0 proposed, 4 dropped/dismissed; each folded into ## Findings above (tagged simplify). Typecheck + settlement/summary/zaliczki specs green.

## Tests & suite

- Unit specs (slice): summary-economics (8), zaliczki (4), kosztorys-settlement (4), transfer-schema (35) — green.
- Full unit suite: `pnpm exec vitest run` → 1048 passed, 40 skipped (DB-integration/nodemailer-gated, pre-existing). Green.
- `pnpm typecheck` → clean (after each fix + the /simplify cleanups).
- Browser E2E: **owed, filed to e2e-backlog as EX-531** (deposit→zaliczka flow incl. the SelectItem crash regression) — not authored inline; deferred per the review-gate E2E-backlog path.
- Heavy legs (`test:e2e`, `next build`) NOT run — deferred; slice is parked in review pending owner sign-off on netting semantics (F3). Run before merge to `main`.
