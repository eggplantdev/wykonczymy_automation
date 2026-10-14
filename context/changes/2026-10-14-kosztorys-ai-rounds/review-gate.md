# Review-gate ledger — kosztorys-ai-rounds (EX-1057) · 2026-10-14

Scope: working tree vs HEAD `e1198ba3d` (nothing committed), the slice's own files only — a parallel
session's dirty files (`report-column.tsx`, `report-grid.tsx`, `section-header-cell.tsx`,
`globals.css`, `kosztorys-editor-body-report-language.test.tsx`, the textSize hunk in
`kosztorys-editor-body.tsx`) are out of scope. Step 0.5 browser pass skipped (Playwright only on an
explicit ask); manual checks live in `context/foundation/manual-checks.md` § EX-1057.

Fan-out: `/10x-impl-review`, `/code-review`, `feature-first-structure`, `module-cohesion-audit`,
`structure-scatter-audit`, `comment-noise-audit`, `primitive-reuse-scan`. `tailwind-v4-audit` dropped
(no class changes beyond the existing cell markup).

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `scripts/prod-client.ts` · REST returns `aiNewInformation` only once the code is deployed, so on a migrated-but-not-deployed prod the double-load guard sees no blocks and lets a second load through (and the round baseline reads Nowe informacje as empty) — `assertRoundFieldsDeployed`, called first by `round-case-prod.ts` and the `ROUND` branch of `load-draft-sql-prod.ts`
      test: no automated test — change-folder prod script with no harness; the read-only dry run hits the guard until EX-1057 is deployed
- [x] 🟡 WARNING · fixed · impl-review · `src/scripts/load-ai-draft.ts` · a draft row with a missing sekcja was skipped after earlier rows were written, leaving a half-loaded round the re-run guard then refuses — sekcje resolved and checked before the first write
      test: no automated test — local operator script with no harness; runbook step documents the refusal
- [x] 🟡 WARNING · dismissed · code-review · `scripts/load-draft-sql-prod.ts` · round sets Etap AI back to `analyzed` — intended cycle `new_information` → `analyzed` (plan line 304)
- [x] 🔵 OBSERVATION · fixed · impl-review / code-review · `kosztorys-editor-body.tsx` · „Dopasuj wysokość” ignored the 2-line recheck floor and shrank a flagged row to one line — `fitRowToContent` takes `max(contentLines, recheckLines)`, one `recheckLines` shared with `rowHeightFor`
      test: no automated test — one-line `Math.max` in the body; manual check added (§ EX-1057 „Dopasuj wysokość”)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/ai-round.ts` · `assertRoundDraft` let a row without a numeric `qty` through — rows now need a finite qty
      test: TDD · unit — `ai-round.test.ts` „refuses a row whose qty is undefined / NaN”
- [x] 🔵 OBSERVATION · fixed · impl-review / code-review · `scripts/load-draft-sql-prod.ts` · SQL `btrim` stripped spaces only while `appendRoundBlock`'s JS `trim` strips all whitespace — a field holding only a newline got the separator prepended; now `btrim(…, E' \t\r\n')`
      test: no automated test — SQL string inside a prod script; the dry run prints the statement
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/kosztorys/review-status.ts` · re-picking Zaakceptowana after a round dropped the work (AI przedmiar 0) didn't copy the 0 — `aiOffered` treats 0 as no offer; a lowered flag now copies any non-null AI przedmiar
      test: TDD · unit — `review-status.test.ts` „re-picking Zaakceptowana after the round dropped the work writes Przedmiar 0”
- [x] 🔵 OBSERVATION · fixed · code-review · runbook (`2026-10-01-…/change.md`) · draft rows match by sekcja + opis, so a pozycja the owner renamed since `kosztorys.txt` would be added again — runbook says to match on the current name; step 5 lists the new refusals
      test: no automated test — process rule, not code
- [x] 🔵 OBSERVATION · dismissed · code-review · `load-draft-sql-prod.ts` · a round could run before the prod migration — superseded by the deploy guard (a field the code declares but the DB lacks fails the REST read)
- [x] 🔵 OBSERVATION · dismissed · code-review · `review-status.ts` · re-pick of Zaakceptowana overwrites a hand-typed Przedmiar — that is the meaning of accepting the round's figure; undo restores it
- [x] 🔵 OBSERVATION · fixed · impl-review / code-review · `row-conditions/registry.ts` · `ai-recheck` inserted under `ai-to-review`'s comment — moved below `ai-to-review`, diff is a pure insertion
- [x] 🔵 OBSERVATION · dismissed · impl-review · `KosztorysItemT` · AI fields stay optional, so tsc won't catch a builder that omits them — accepted deviation; every copy path sets them (now via `NO_AI_DRAFT`) and `insert-rows` defaults `?? false`
- [x] 🔵 OBSERVATION · dismissed · impl-review · success criteria · Progress rows and manual checks unverified — the gate ticks them as legs pass (see Tests & suite); manual checks stay with the human
- [x] 🔵 OBSERVATION · dismissed · impl-review · `prod-client.ts` · `forAiAnalysis` / `AssetT` moved from `adopt-case-prod.ts`, outside the plan — plain move of shared code `round-case-prod.ts` needs, no behaviour change
- [x] filed · gate (E2E) · editor round flow · flag lowered by a Status re-pick / typed Przedmiar must persist across reload (client → action → DB → revalidation) — filed `EX-1015` (steps 8–10, `e2e-backlog`)
      test: e2e — deferred into EX-1015
- [x] fixed · feature-first-structure · `ai-review-columns.tsx` · `pickStatus` was a domain rule inside a cell file — moved to `lib/kosztorys/review-status.ts` beside `applyReviewRules`
- [x] fixed · module-cohesion-audit · `ai-review-columns.tsx` · `RECHECK_LABEL` defined in the cell — moved to `lib/kosztorys/labels.ts` with the other status labels
- [x] fixed · structure-scatter-audit · `collect-reasons-prod.ts`, `round-case-prod.ts` · each declared its own `ReviewedItemT` over the prod item — one `ItemT` in `prod-client.ts`
- [x] fixed · primitive-reuse-scan · `item-from-fields.ts`, `serialize-preset.ts`, `item-to-catalogue.ts`, `parse-labor-tab.ts`, `create-case-local.ts` · same five-field AI-null block in five builders — `NO_AI_DRAFT` in `lib/kosztorys/constants.ts`
- [x] fixed · comment-noise-audit · 9 comments across `review-status.ts`, `ai-review-columns.tsx`, `kosztorys-editor-body.tsx`, `kosztorys-items.ts`, `load-draft-sql-prod.ts`, `prod-client.ts`, two specs — deleted or trimmed to the why; „Placed once” rewritten, not deleted
- [x] dropped · structure-scatter-audit · `kosztorys-editor-body.tsx` · recheck height logic (~20 lines) could be its own hook — file is shared with a parallel session's in-flight hunk; not worth the churn
- [x] dropped · feature-first-structure · `prod-client.ts` `forAiAnalysis` · arguably belongs in `lib/` — the change scripts get archived with the change
- [x] dropped · structure-scatter-audit · `lib/kosztorys/` · crowded, could take an `ai-review/` folder — predates this slice
- [x] dropped · code-review · `ai-review-columns.tsx` `copyValue` trim / `rowHeightFor` identity on view toggle — cosmetic, no observable effect

## Simplify pass

Reviewer fixes applied in the main thread plus `primitive-reuse-scan` stood in for `/simplify` — 10 applied, 0 proposed, 4 dropped; each folded into `## Findings`.

## Tests & suite

- Touched specs (`pnpm exec vitest run` × 9 files) — 8 files / 121 tests passed; `serialize-apply-preset.test.ts` skipped (DB-gated, runs in `test:integration` @ 5435).
- After review fixes: ai-round, review-status, ai-review-conditions, ai-review-columns-status (DOM), item-patch-schema, row-height, ai-review-columns — 7 files / 89 tests passed.
- After `NO_AI_DRAFT`: item-from-fields, item-to-catalogue, parse-labor-tab, build-import-plan, catalogued-preset-items — 5 files / 78 tests passed; snapshot-format passed.
- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors in slice files; the 449 errors are all in `.playwright-mcp/` (gitignored browser-tool scratch), warnings only in files this slice doesn't touch.
- `pnpm test:integration` (5435, dump re-imported + migrated) — 141/143 files, 811/814 tests; `serialize-apply-preset` (6) and `insert-schema-drift` (5) pass. 3 failures, none in this slice:
  - `accept-worker-report.test.ts` „odrzuca every line…” — a reject runs `bumpInvestmentRevision` (`investments.updated_at = now()`), and the spec deep-compares the tree including `updatedAt`; committed EX-1049 code, reproduces in isolation.
  - `read-expense-draft-receipts.db.test.ts` × 2 — worker-expenses code from the EX-1053 WIP spike (`4dd5a4ac8`).
- Full `pnpm test` and `test:parity` — skipped by user (fast legs + integration chosen); touched unit/DOM specs ran above.
