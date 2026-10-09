# Review-gate ledger — kosztorys-przedmiar-aktualny (EX-921) · 2026-10-07

Scope: `e935a89f...36b44d8e` (8 commits, 104 files), merged into `staging` as `7101a4dd`.
Step 0.5 (browser verification pass) skipped — the user's standing rule: no Playwright browser unless asked this turn; manual checks are non-blocking.
Fan-out: `/10x-impl-review` (APPROVED, 2 warnings) · `/code-review` (no critical/warning) · `tailwind-v4-audit` · `comment-noise-audit` (flag-only) · `feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`.

## Findings

- [x] 🔵 OBSERVATION · dismissed · impl-review · `current-planned-qty-cell.tsx:25` · read-only cell drops the grey „follows ofertowy" tone — deliberate, the cell's comment says the investor's and worker's documents get the figure alone; a locked investment losing the cue is accepted
      test: no automated test — no change
- [x] 🔵 OBSERVATION · dismissed · impl-review + code-review · `20261007_1_add_current_planned_qty.ts` · old code saving investor settings between migrate and deploy drops `currentPlannedNet` from the hidden set — window is seconds; run the prod migrate right before the push
      test: no automated test — deploy ordering
- [x] 🔵 OBSERVATION · skipped · impl-review + code-review · `review-status.ts:53` · „Odrzuć" in the AI review zeroes Przedmiar ofertowy but keeps a hand-typed Aktualizacja — follows the plan's „a hand edit survives an ofertowy rewrite"; changing it changes what „Odrzuć" does → owner's call
      test: TDD · unit — if the owner rules otherwise
- [x] skipped · code-review · `print/offer-columns.ts:61` · client paper heads `plannedNet` „Wartość netto" beside „Wartość netto aktualizacji przedmiaru" — pre-existing short header (EX-894), collides only when the owner unhides the aktualizacja value (off by default); client-document wording is the owner's call
- [x] dropped · code-review · `worker-view/settings.ts:20` · `hidePlannedOnceExecuted` now hides on the Aktualizacja — key is persisted in the firm-wide global; a rename needs a legacy-key map for a name
- [x] dismissed · comment-noise-audit · `kosztorys-v2-columns.tsx:178` · carries the column-order rationale
- [x] dropped · comment-noise-audit · `kosztorys-editor-body.tsx:606` · quoted example label — cosmetic
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
