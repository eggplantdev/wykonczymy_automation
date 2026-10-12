# Review-gate ledger — investment-ai-stage (EX-1046) · 2026-10-12

Scope: uncommitted working tree on `staging` vs `HEAD` (472c6cb28), limited to this slice's paths —
the tree also carries other sessions' dirty files, which are out of scope.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · plan `## Progress` · no automated criterion had run — all ran green (see ## Tests & suite); the DB spec reported 8 tests, not a silent skip
- [x] 🟡 WARNING · fixed · code-review + impl-review + feature-first · `src/components/investments/ai-stage-select.tsx:37` · action awaited bare — a transport rejection escaped the transition with no revert and no toast; now wrapped in `settleAction`
      test: TDD · unit (dom) — `ai-stage-select.test.tsx` rejects with `TypeError('Failed to fetch')`, asserts the error toast and the reverted label (not run yet — see the open box above)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/reference-data.ts:79` · every page's SELECT reads `ai_stage`, so a deploy before the migration breaks all pages — known and planned: prod migrate before push, `db:migrate:preview` before a staging deploy
      test: no automated test — deploy ordering, not code
- [x] 🔵 OBSERVATION · dismissed · code-review · `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/collect-reasons-prod.ts:16` · trashed investments not excluded — read-only one-off; a trashed investment's Powód zmiany is still valid knowledge
      test: no automated test — one-off script
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/types/table-rows.ts:73` · `aiStage` sat above the comment that explains why the row carries it — moved below
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/foundation/manual-checks.md` · no manual-checks section for the slice — added (7 boxes)
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/components/investments/investment-data-table.tsx:30` · filter option „—” read as a separator — now „Brak” (later renamed „Uzupełnianie informacji”)
- [x] fixed · verify (owner) · `src/app/(frontend)/inwestycje/[id]/page.tsx:99` · select sat in the header toolbar — moved into the info list as an „Etap AI” row (`soft` variant, no „Etap AI:” prefix); header buttons mixed `sm` and `xs` — `SheetButton` / `OpenKosztorysV2Button` take `size`, the header passes `sm` (tables keep `xs`)
- [x] fixed · verify (owner) · `src/lib/constants/investment-ai-stage.ts:1` · options had no explanation and „Przeanalizowana” was missing — stored stage `analyzed` added (replaces derived „Szkic wgrany”; migration enum edited, local 5433/5435 got `ADD VALUE`), each stage carries a description, shown under each option inside the list with the kosztorys menus' `MenuItemBody` (moved `kosztorys/editor/actions/` → `ui/`, now shared by menus and `SimpleSelect`); `SimpleSelect` hands `SelectValue` the icon + name so the trigger doesn't mirror the description. A first attempt with a new `SelectItem` layout stacked the icon above the name (Radix `ItemText` drops `className`) and was reverted; options carry icons like `SETTLEMENT_MODE_SELECT_OPTIONS`; variant `toolbarSm`, not the unused-elsewhere `soft`
- [x] fixed · verify (owner) · `src/components/investments/investment-info-fields.tsx:30` · the row was appended on the page, so the kosztorys „Inwestycja” tab (same builder) never showed it — the row moved into `buildInvestmentInfoFields`, `isReadOnly` drops it for `/kosz`
- [x] fixed · verify (owner) · `src/lib/constants/investment-ai-stage.ts:44` · the empty stage read „—” with a meaningless icon — named „Uzupełnianie informacji” (`AI_STAGE_GATHERING`, still stored as `null`; interim „Oczekuje” / „Gromadzenie wstępnych informacji” renamed by the owner) with a `FolderInput` icon and a description; the listing cell and the filter use the same name
- [x] fixed · verify (owner) · `src/components/ui/simple-select.tsx:94` · the open list stretched to its longest description — a list whose options carry descriptions is `w-80`, the width of the kosztorys menus that use the same `MenuItemBody`
- [x] fixed · verify (owner) · `src/components/tables/investments.tsx:123` · the listing's „Analiza AI” cell was plain text that wrapped „Uzupełnianie informacji” onto two lines — `AiProgressBadge`, one tone per step on `BADGE_BASE` like `InvestmentStatusBadge`
- [x] fixed · code-review · `src/components/investments/ai-stage-select.tsx` · `router.refresh()` redundant after `updateTag` — dropped
- [x] fixed · code-review · `src/__tests__/collections/investments-ai-stage.db.test.ts` · duplicated the action DB spec — deleted
- [x] fixed · feature-first-structure + structure-scatter-audit · `src/lib/investments/ai-progress.ts` · the listing step lived apart from the stage it folds — merged into `src/lib/constants/investment-ai-stage.ts`, spec moved to `src/__tests__/lib/constants/`
- [x] fixed · simplify · `src/components/investments/ai-stage-select.tsx:31` · hand-rolled optimistic value + snapshot revert — `useOptimistic(aiStage)` (precedent `fleet/vehicle-flags.tsx`), falls back to the prop when the transition ends
- [x] fixed · simplify · `src/lib/constants/investment-ai-stage.ts:6` · inline `.find` parse — `isInvestmentAiStage` guard, like `isVatPlane` / `isLanguage` (supersedes the structure audit's "dropped" on the same line)
- [x] fixed · simplify · `src/lib/constants/investment-ai-stage.ts:28` · `AI_PROGRESS_LABELS.none` was the cell glyph, so the filter special-cased it — label is „Brak”, the cell (which already branches on `none`) prints „—”
- [x] dropped · simplify · `collect-reasons-prod.ts:19-37` · 2N serial prod fetches where N+1 would do — one-off CLI over a few investments, seconds at most
- [x] dismissed · structure-scatter-audit + simplify · `src/types/table-rows.ts:73` · "`InvestmentRowT.aiStage` has no reader" — `InvestmentRefT` requires it and the row is handed to `EditInvestmentDialog` / `RequestReviewButton` / `TrashInvestmentButton`
- [x] dismissed · simplify · `src/components/tables/investments.tsx` · column id kept `hasAiDraft` — renaming rewrites stored column visibility/order
- [x] fixed · comment-noise-audit · `src/types/table-rows.ts` · JSDoc on `aiProgress` restated the type — deleted
- [x] fixed · comment-noise-audit · `src/migrations/20261012_0_add_investment_ai_stage.ts:1` · header narrated the SQL — trimmed to the null-means-„—” rationale
- [x] fixed · comment-noise-audit · `src/__tests__/lib/actions/investment-ai-stage.db.test.ts` · comment restated the assertions — deleted
- [x] dismissed · comment-noise-audit · `src/lib/constants/investment-ai-stage.ts:1` · "No `server-only`" line — real rationale, mirrors `investment-status.ts`
- [x] dismissed · module-cohesion-audit · slice files · all flags benign
- [x] dismissed · tailwind-v4-audit · slice files · 0 findings
- [x] dropped · e2e · investment page select + listing filter · a plain select on a desktop-only management page — the DOM spec covers save/revert, the action DB spec the persisted write, manual checks the rest (owner, 2026-10-12)
- [x] fixed · suite · `src/__tests__/components/investments/ai-stage-select.test.tsx:21` · `pick` matched the option by its exact name, which now runs on into the description — matches the name's prefix

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 3 applied, 1 dropped, 2 dismissed; each folded into ## Findings (tagged simplify).

## Tests & suite

- `vitest run` — `investment-ai-stage.test.ts`, `ai-stage-select.test.tsx`, `investment-info-fields.test.ts`, `shape-investments.test.ts`, `tables/investments.test.tsx`, `summary-investment-tab.test.tsx`: 58/58 green (2 red on the first run — the `pick` matcher, fixed above)
- `investment-ai-stage.db.test.ts` against 5435: 8/8 green
- `pnpm typecheck`: clean
- Full suite / E2E: not run (user rule — slice specs + typecheck only)
