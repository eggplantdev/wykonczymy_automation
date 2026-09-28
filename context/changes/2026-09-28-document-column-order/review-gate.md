# Review-gate ledger — document-column-order (EX-884) · 2026-09-28

Scope: branch `document-column-order` vs `staging` (merge-base `0dc759bf`) — commits `ff966895`, `96e43151`, `c20e7eaa`, `7a986a1b`; 47 files, no untracked. Step 0.5 (browser verification) skipped: Playwright is not driven unprompted, and the worktree's symlinked `node_modules` blocks a dev server there.

## Findings
- [x] 🟡 WARNING · fixed · impl-review · specs broken by `7a986a1b` — dialog spec's firm order now ranks „Pozostało" first; resolver spec hides `remaining`; `preview-columns` drops `plannedGross`/`stageValueGross_7`/`discountAmountGross` and the per-etap-family case moved to `stageValueNet`; `settlement-columns` TOTALS/stage columns netto only
      test: TDD · unit — new `preview-columns` case „carries no brutto column" guards the owner ruling
- [x] 🔵 OBSERVATION · fixed · impl-review · weak asserts — worker print now asserts `headers[2]` = „Stawka j.m."; resolver case nulls the row's order itself (was relying on an earlier case) and asserts `{}` — pins the pre-deploy-row behaviour
- [x] 🟡 WARNING · fixed · impl-review · brutto removal not recorded in the plan — dated addendum in `plan.md` (`## Addendum — 2026-09-28`)
- [x] 🟡 WARNING · filed · impl-review · no `manual-checks.md` section, E2E neither authored nor filed — section `## document-column-order` added to `context/foundation/manual-checks.md`; E2E filed EX-891 (`e2e-backlog`)
- [x] 🔵 OBSERVATION · fixed · impl-review · `kosztorys-editor-domain-notes.md:311` („brutto idzie za netto") and the EX-631 paragraph („netto i brutto obok siebie") stale — rewritten; `:285` is the offer footer's netto/VAT/brutto total, not a column — left
- [x] 🔵 OBSERVATION · fixed · code-review · stored ranks are relative to the code list's indices, so a column inserted mid-list shifts unranked ones — by design (sparse ranks, same as the workbench); recorded in domain notes
- [x] 🔵 OBSERVATION · fixed · code-review · an offer row saved before deploy has NULL ranks and, since the row wins whole, shows the built-in order, not the firm's; reset is enabled — recorded in domain notes + a manual check
- [x] 🔵 OBSERVATION · dismissed · code-review · `printableKeys` does not itself enforce the pin — its only input is `clientDocumentColumns`/`workerDocumentColumns`, which pin; a second pin would restate it
- [x] fixed · code-review + structure-scatter · `document-column-order-button.tsx:25` `sameOrder` duplicated `sameKeys` in `ui/column-order-dialog.tsx:36` — one `sameKeys` export in `lib/table/column-order.ts`, both import it
- [x] dismissed · code-review · `sanitizeDocumentRanks` re-implements `dropNonFiniteRanks` — it also filters by ceiling and pin and accepts `unknown`; the finite check is one clause, a second pass adds nothing
- [x] fixed · code-review · stale gross comments — `column-config.ts:184`, `column-selection.ts:34`, `build-offer-print-html.ts:59`, `offer-print/styles.ts:107` (the worker half of that comment kept)
- [x] fixed · comment-noise · deletes: `client-view-settings.ts:76`, `kosztorys-client-view.ts:58`, `document-column-order-button.tsx:14`; trims: `document-column-order.ts:8` first sentence, migration `20260928_4:4` first sentence
- [x] dismissed · comment-noise · judgment deletes `document-column-order-button.tsx:19-20` (why the reset target differs per audience), `view-settings-fields.tsx:49-50` (why shown locked instead of omitted), `document-column-order.test.ts:26-27`, `preview-columns.test.ts:73-74` — each carries a why the code does not say
- [x] fixed · comment-noise · `kosztorys-client-view.test.ts:107` — rewritten with the resolver case
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
