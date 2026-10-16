# Review-gate ledger — offer-planned-discount-amount · 2026-10-16

Scope: `e53d16503..ef031e491` (branch `offer-planned-discount-amount`, base `staging`).
Checks: 10x-impl-review, code-review, comment-noise-audit, module-cohesion-audit.
Dropped: tailwind-v4-audit (no `className` in diff), feature-first-structure + structure-scatter-audit
(no new source files — only one new spec), Step 0.5 browser pass (not requested this session).

## Findings

- [x] 🔵 OBSERVATION · fixed · impl-review+code-review+cohesion+simplify · `src/lib/kosztorys/print/offer-columns.ts:57` · „— po rabacie" written twice (PDF + grid) — one `withAfterDiscountSuffix` in column-config.ts, PDF calls it
- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/lib/kosztorys/columns/column-config.test.ts:9` · suffix assertion built from the function under test — literal labels for all four ids
- [x] 🔵 OBSERVATION · dropped · impl-review+code-review · `src/lib/kosztorys/settlement-columns.ts:51` · `hasPlannedDiscount` reads przedmiar only; a rabat row with przedmiar 0 but aktualizacja > 0 leaves „aktualizacji" headers unsuffixed — header hint only, state is rare; widening it would also un-drop an empty column
      test: no automated test — no change made
- [x] 🔵 OBSERVATION · dismissed · code-review · `client-view-settings-form.tsx:34` · „Opcje" checklist shows no suffix — by design, a setting keeps one stable name (COLUMN_LABELS)
- [x] 🔵 OBSERVATION · dismissed · code-review · `column-totals.ts:40` · totals computed on crew planes — harmless, same as plannedNet
- [x] 🔵 OBSERVATION · dismissed · impl-review · `column-config.ts:116` · Polish suffix on a translatable path — planned labels are not translated; unreachable today
- [x] 🔵 OBSERVATION · dismissed · impl-review+reuse · `calc.ts:175` · deviates from plan's `rowDiscountForView(row, plannedQty)` — deliberate: returns 0 for przedmiar ≤ 0 instead of a negative rabat
- [x] fixed · simplify · `column-selection.ts:143` · two identical picker-item literals — `toggleItem` helper
- [x] fixed · simplify · `offer-columns.ts:85` · `hasDiscount = false` default hid a forgotten argument — required
- [x] dropped · simplify · `column-config.ts:86` · `undefined` placeholder before the options bag — moving `dictionary` into the bag churns 5 untouched callers
- [x] dropped · simplify · `settlement-columns.test.ts:103`, `kosztorys-calc.test.ts:346` · overlapping predicate cases / repeated fixture spread — minor
- [x] dropped · simplify · `use-kosztorys-editor.ts:528`, `print/offer.ts:36` · `hasPlannedDiscount` scanned twice — µs at 1000 rows
- [x] dismissed · module-cohesion · `settlement-columns.ts:51` · `hasPlannedDiscount` placement — emptiness predicate first, documented double use
- [x] fixed · comment-noise · `column-config.ts:81`, `settings-new-column.test.ts:7` · comments restated code / ordinal history — trimmed
- [x] fixed · comment-noise · `settings.test.ts:55` · history comment, covered by settings-new-column spec — deleted

## Simplify pass

Ran /simplify (4 agents) — 2 applied, 0 proposed, 6 dropped/dismissed; each folded into ## Findings (tagged simplify). No separate report file.

## Tests & suite

Not run — the repo hook allows tests/typecheck/lint only on an explicit „odpal testy”. Touched specs + typecheck owed.

---

# Follow-up gate — rabat sums on the investor PDF · 2026-10-16

Scope: `964ad22a2..711b3b75a` (5 files, no new files). Checks: code-review (correctness + comment noise).
Dropped: 10x-impl-review (follow-up not in plan.md), structure audits (no new files, no new module),
tailwind-v4-audit (no `className`), Step 0.5 browser pass (not requested).

## Findings

- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/lib/kosztorys/print/offer.test.ts:321` · client-plane pin of the rabat sum unguarded — subcontractor-plane case now uses a discounted row and asserts `plannedDiscountAmount` = 50
      test: TDD · unit — assertion added beside the netto pin
- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/lib/kosztorys/print/offer.test.ts:478` · global-discount case didn't assert the footer — `not.toContain('W tym rabat')` added
      test: TDD · unit — the assertion is the guard
- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/lib/kosztorys/print/offer.test.ts:497` · hidden-rabat case passed vacuously without a totals box — asserts „Razem netto" present
      test: TDD · unit — the assertion is the guard
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/print/build-html.ts:133` · „W tym rabat" under a post-rabat „Razem netto" can read as "part of" — wording dictated by the user this session
      test: no automated test — wording ruling
- [x] 🔵 OBSERVATION · dropped · code-review · `src/__tests__/lib/kosztorys/print/offer.test.ts:490` · adjacency assertion breaks if a column between netto and rabat becomes default-visible — fails loud, not silently; churn not worth it
      test: no automated test — no change made
- [x] fixed · code-review · `src/lib/kosztorys/print/offer.ts:49` · `columns.some(key ===)` twice — `printed(key)` helper
- [x] fixed · comment-noise · `src/lib/kosztorys/print/offer.ts:58` · totalKeys comment hard to parse — rewritten as the failure it prevents
- [x] fixed · comment-noise · `src/lib/kosztorys/print/offer.ts:62` · totalDiscount comment restated the condition — deleted
- [x] dropped · code-review · `src/lib/kosztorys/print/offer.ts:23` · `OFFER_TOTAL_KEYS` not `as const` — trivial

## Simplify pass

Ran /simplify inline (proportional: 5-file follow-up) — 0 applied beyond the code-review fixes above, 0 proposed.

## Tests & suite

Not run — awaiting „odpal testy”. Owed: `src/__tests__/lib/kosztorys/print/offer.test.ts` + typecheck.
