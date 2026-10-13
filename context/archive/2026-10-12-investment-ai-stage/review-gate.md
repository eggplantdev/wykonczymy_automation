# Review-gate ledger — investment-ai-stage (EX-1046) · 2026-10-12

Scope: uncommitted working tree on `staging` vs `HEAD` (472c6cb28), limited to this slice's paths —
the tree also carries other sessions' dirty files, which are out of scope.

## Findings

_Trimmed at archive (2026-10-12): 21 fixed findings removed; their record is the commits. Dismissed / dropped / filed kept._

- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/reference-data.ts:79` · every page's SELECT reads `ai_stage`, so a deploy before the migration breaks all pages — known and planned: prod migrate before push, `db:migrate:preview` before a staging deploy
      test: no automated test — deploy ordering, not code
- [x] 🔵 OBSERVATION · dismissed · code-review · `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/collect-reasons-prod.ts:16` · trashed investments not excluded — read-only one-off; a trashed investment's Powód zmiany is still valid knowledge
      test: no automated test — one-off script
- [x] dropped · simplify · `collect-reasons-prod.ts:19-37` · 2N serial prod fetches where N+1 would do — one-off CLI over a few investments, seconds at most
- [x] dismissed · structure-scatter-audit + simplify · `src/types/table-rows.ts:73` · "`InvestmentRowT.aiStage` has no reader" — `InvestmentRefT` requires it and the row is handed to `EditInvestmentDialog` / `RequestReviewButton` / `TrashInvestmentButton`
- [x] dismissed · simplify · `src/components/tables/investments.tsx` · column id kept `hasAiDraft` — renaming rewrites stored column visibility/order
- [x] dismissed · comment-noise-audit · `src/lib/constants/investment-ai-stage.ts:1` · "No `server-only`" line — real rationale, mirrors `investment-status.ts`
- [x] dismissed · module-cohesion-audit · slice files · all flags benign
- [x] dismissed · tailwind-v4-audit · slice files · 0 findings
- [x] dropped · e2e · investment page select + listing filter · a plain select on a desktop-only management page — the DOM spec covers save/revert, the action DB spec the persisted write, manual checks the rest (owner, 2026-10-12)

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 3 applied, 1 dropped, 2 dismissed; each folded into ## Findings (tagged simplify).

## Tests & suite

- `vitest run` — `investment-ai-stage.test.ts`, `ai-stage-select.test.tsx`, `investment-info-fields.test.ts`, `shape-investments.test.ts`, `tables/investments.test.tsx`, `summary-investment-tab.test.tsx`: 58/58 green (2 red on the first run — the `pick` matcher, fixed above)
- `investment-ai-stage.db.test.ts` against 5435: 8/8 green
- `pnpm typecheck`: clean
- Full suite / E2E: not run (user rule — slice specs + typecheck only)
