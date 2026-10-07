# Review-gate ledger — kosztorys-przedmiar-aktualny (EX-921) · 2026-10-07

Scope: `e935a89f...36b44d8e` (8 commits, 104 files), merged into `staging` as `7101a4dd`.
Step 0.5 (browser verification pass) skipped — the user's standing rule: no Playwright browser unless asked this turn; manual checks are non-blocking.
Fan-out: `/10x-impl-review` (APPROVED, 2 warnings) · `/code-review` (no critical/warning) · `tailwind-v4-audit` · `comment-noise-audit` (flag-only) · `feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `plan.md` Progress 1.4/1.5/1.6/1.8 · ticked with no green run on record — ran all four against the 5435 test DB (42 passed, none skipped), ticked
- [x] 🟡 WARNING · fixed · impl-review · `plan.md` · off-plan changes (sort case, layer-neutral column, e2e selector, labor-tab null, „Postęp" counter) unrecorded — `## As built` addendum
- [x] 🔵 OBSERVATION · fixed · impl-review · `remaining-overrun-tone.test.ts`, `subcontractor-due-by-plane.test.ts` · no spec asserted the overrun on a row where aktualizacja ≠ ofertowy — split cases added (the due itself never reads the przedmiar, so that spec's case pins `hasStagesOverPlanned`)
      test: TDD · unit — both cases fail if the reader falls back to Przedmiar ofertowy
- [x] 🔵 OBSERVATION · dismissed · impl-review · `current-planned-qty-cell.tsx:25` · read-only cell drops the grey „follows ofertowy" tone — deliberate, the cell's comment says the investor's and worker's documents get the figure alone; a locked investment losing the cue is accepted
      test: no automated test — no change
- [x] 🔵 OBSERVATION · fixed · impl-review · `subcontractor-price-edit.ts:35`, `cell-edit.ts:128` · comments claimed the stawka is the only null-clearing policy / two domain policies — reworded to include the Aktualizacja
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `uk.ts:294`, `ru.ts:295` · `tipRemainingForPlane` overrun clause still named the old quantity — now names the updated one
      test: no automated test — copy
- [x] 🔵 OBSERVATION · dismissed · impl-review + code-review · `20261007_1_add_current_planned_qty.ts` · old code saving investor settings between migrate and deploy drops `currentPlannedNet` from the hidden set — window is seconds; run the prod migrate right before the push
      test: no automated test — deploy ordering
- [x] 🔵 OBSERVATION · skipped · impl-review + code-review · `review-status.ts:53` · „Odrzuć" in the AI review zeroes Przedmiar ofertowy but keeps a hand-typed Aktualizacja — follows the plan's „a hand edit survives an ofertowy rewrite"; changing it changes what „Odrzuć" does → owner's call
      test: TDD · unit — if the owner rules otherwise
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md` · four paths landed elsewhere than planned — listed in `## As built`
- [x] fixed · code-review · `review-lines-table.tsx:241` · warning „Przekroczono przedmiar" compares against the Aktualizacja — „Przekroczono aktualizację przedmiaru"; manual check extended
- [x] skipped · code-review · `print/offer-columns.ts:61` · client paper heads `plannedNet` „Wartość netto" beside „Wartość netto aktualizacji przedmiaru" — pre-existing short header (EX-894), collides only when the owner unhides the aktualizacja value (off by default); client-document wording is the owner's call
- [x] dropped · code-review · `worker-view/settings.ts:20` · `hidePlannedOnceExecuted` now hides on the Aktualizacja — key is persisted in the firm-wide global; a rename needs a legacy-key map for a name
- [x] fixed · tailwind-v4-audit · `price-cell.tsx:56`, `current-planned-qty-cell.tsx:32` · `'text-muted-foreground italic'` duplicated as one meaning — `DERIVED_TONE` (`components/kosztorys/derived-tone.ts`, beside `FLAGGED_TONE`)
- [x] fixed · comment-noise-audit · `current-planned-qty-cell.tsx:14-16` · tone rationale — moved onto `DERIVED_TONE`
- [x] fixed · comment-noise-audit · `column-values.ts:63` · restated `remaining`'s argument — deleted
- [x] fixed · comment-noise-audit · `calc.ts:245` · first sentence restated `??` — trimmed
- [x] fixed · comment-noise-audit · `column-totals.test.ts:224` · „any more" vanished-state — trimmed
- [x] fixed · comment-noise-audit · `sort-value.ts:62-68` · the divergence comment sat above the new `currentPlannedQty` case — moved back over its own case
- [x] dismissed · comment-noise-audit · `kosztorys-v2-columns.tsx:178` · carries the column-order rationale
- [x] dropped · comment-noise-audit · `kosztorys-editor-body.tsx:606` · quoted example label — cosmetic
- [x] fixed · comment-noise-audit · `settlement-rows.ts:77` · `rowRemainingForExecutedQty`'s `plannedQty` param receives the Aktualizacja — renamed `scopeQty`
- [x] dropped · comment-noise-audit · column id `plannedNetForPlane` reads the Aktualizacja — persisted id in saved settings and ranks; a rename needs a legacy-key map for a name
- [x] dismissed · primitive-reuse-scan · `current-planned-qty-cell.tsx` vs `DecimalCell` · folding needs a nullable policy, a display resolver and a tone parameter — the parameters would be the code
- [x] dropped · feature-first-structure · `current-planned-qty-cell.tsx` vs `decimal-column.tsx` naming — cosmetic
- [x] dismissed · suite · `src/scripts/load-ai-draft.ts:85` · tsc error — another session's in-flight file (kosztorys-ai), clean on re-run

## Simplify pass

The reviewers' reuse/simplification/altitude findings were applied directly (11 fixed, folded into ## Findings); no separate `/simplify` agent was run over a diff the four reviewers had already swept.

## Tests & suite

- Touched + new specs: 6 files, 137 passed.
- Plan 1.4/1.5/1.6/1.8 DB specs vs test DB (5435): 4 files, 42 passed.
- `tsc --noEmit`: clean. ESLint on touched files: clean.
- Full suite / `pnpm test:integration`: not run — owed on the user's go.
