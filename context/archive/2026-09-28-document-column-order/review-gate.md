# Review-gate ledger — document-column-order (EX-884) · 2026-09-28

Scope: branch `document-column-order` vs `staging` (merge-base `0dc759bf`) — commits `ff966895`, `96e43151`, `c20e7eaa`, `7a986a1b`; 47 files, no untracked. Step 0.5 (browser verification) skipped: Playwright is not driven unprompted, and the worktree's symlinked `node_modules` blocks a dev server there.

## Findings

- [x] 🟡 WARNING · filed · impl-review · no `manual-checks.md` section, E2E neither authored nor filed — section `## document-column-order` added to `context/foundation/manual-checks.md`; E2E filed EX-891 (`e2e-backlog`)
- [x] 🔵 OBSERVATION · dismissed · code-review · `printableKeys` does not itself enforce the pin — its only input is `clientDocumentColumns`/`workerDocumentColumns`, which pin; a second pin would restate it
- [x] dismissed · code-review · `sanitizeDocumentRanks` re-implements `dropNonFiniteRanks` — it also filters by ceiling and pin and accepts `unknown`; the finite check is one clause, a second pass adds nothing
- [x] dismissed · comment-noise · judgment deletes `document-column-order-button.tsx:19-20` (why the reset target differs per audience), `view-settings-fields.tsx:49-50` (why shown locked instead of omitted), `document-column-order.test.ts:26-27`, `preview-columns.test.ts:73-74` — each carries a why the code does not say
- [x] filed · structure-scatter · `src/components/kosztorys/editor/dialogs/` · 40 flat files, 3 kinds, no sub-folders (pre-existing; this slice added 1) — own refactor, filed EX-890
- [x] dismissed · module-cohesion · 8 flagged files (`investor-actions.tsx`, `view-settings-fields.tsx`, `client-view-settings.ts`, `worker-view/settings.ts`, `column-config.ts`, `offer-print/columns.ts`, `build-offer-print-html.ts`, `kosztorys-client-view.ts`) — one concern each; slice touched a field/param
- [x] skipped · module-cohesion · `use-kosztorys-editor.ts` · 1341-line god module — known, EX-515/EX-521; slice added 2 pass-through lines
- [x] dismissed · tailwind-v4-audit · 0 findings

## Simplify pass

Applied the triaged fix-now set directly (no separate /simplify report) — 7 applied (dedup, 2 comment batches, stale-comment batch, docs, spec batch, asserts), 0 proposed, 3 dismissed; each folded into ## Findings.

## Tests & suite

- typecheck — pass
- lint — pass (0 errors, 82 pre-existing warnings)
- test — 4292 passed, 1 failed: `resolve-id.test.ts` „values follow collection: prefix pattern" on `table:kosztorys-snapshots` — from `0a9745fc` (investor-change-history, before the merge-base), not this slice
- test:integration — not run; the one DB spec this slice touched (`kosztorys-client-view.test.ts`) passes against 5435
