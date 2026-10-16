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
