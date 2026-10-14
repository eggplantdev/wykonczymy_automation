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

- [x] 🟡 WARNING · dismissed · code-review · `scripts/load-draft-sql-prod.ts` · round sets Etap AI back to `analyzed` — intended cycle `new_information` → `analyzed` (plan line 304)
- [x] 🔵 OBSERVATION · dismissed · code-review · `load-draft-sql-prod.ts` · a round could run before the prod migration — superseded by the deploy guard (a field the code declares but the DB lacks fails the REST read)
- [x] 🔵 OBSERVATION · dismissed · code-review · `review-status.ts` · re-pick of Zaakceptowana overwrites a hand-typed Przedmiar — that is the meaning of accepting the round's figure; undo restores it
- [x] 🔵 OBSERVATION · dismissed · impl-review · `KosztorysItemT` · AI fields stay optional, so tsc won't catch a builder that omits them — accepted deviation; every copy path sets them (now via `NO_AI_DRAFT`) and `insert-rows` defaults `?? false`
- [x] 🔵 OBSERVATION · dismissed · impl-review · success criteria · Progress rows and manual checks unverified — the gate ticks them as legs pass (see Tests & suite); manual checks stay with the human
- [x] 🔵 OBSERVATION · dismissed · impl-review · `prod-client.ts` · `forAiAnalysis` / `AssetT` moved from `adopt-case-prod.ts`, outside the plan — plain move of shared code `round-case-prod.ts` needs, no behaviour change
- [x] filed · gate (E2E) · editor round flow · flag lowered by a Status re-pick / typed Przedmiar must persist across reload (client → action → DB → revalidation) — filed `EX-1015` (steps 8–10, `e2e-backlog`)
      test: e2e — deferred into EX-1015
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
