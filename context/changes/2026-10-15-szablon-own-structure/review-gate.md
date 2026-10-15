# Review-gate ledger — szablon-own-structure (EX-1075) · 2026-10-15

Scope: `9e08387a6...HEAD` (merge-base with `staging`), 9 commits (p1–p8 + epilogue), 172 files.
Step 0.5 (browser verification) skipped — it drives Playwright, which runs only on an explicit ask;
the slice's manual checks sit unticked in `context/foundation/manual-checks.md`.

## Findings

- [x] 🟡 WARNING · dismissed · impl-review + code-review · `src/lib/db/investment-gate.ts`, `src/lib/queries/investments.ts`, snapshot cron · old `status='szablon'` investments are visible in lists/booking/kosz/cron between deploy and M2 — the window the plan accepts; M2 runs right after the deploy and Phase 9 stays an open Progress box, so it can't be forgotten
      test: no automated test · — deploy-window state, not code behaviour; M2 itself owes its own spec when authored
- [x] 🟡 WARNING · dismissed · impl-review · `src/lib/db/template-tree.ts`, `src/lib/kosztorys/templates/serialize-template.ts` · readers don't filter `trashed_at`; liveness is the caller's gate — the investment-plane readers work the same way, and every caller goes through `templateGateFor` or the route
      test: no automated test · — no reachable defect today
- [x] 🟡 WARNING · dismissed · impl-review + code-review · `src/lib/actions/template-action.ts`, `kosztorys-presets.ts` overwrite · trashed check runs before the write transaction — same pattern as `investmentAction`; `replaceTemplateLayout`'s `FOR UPDATE` and restore-from-kosz make the window harmless
      test: no automated test · — race window, mirrors the investment twin
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/lib/db/work-catalogue.ts:246` · doc comment of `findLinkedCatalogueItem` sat above `findTemplateItemCatalogueEntry` — moved back
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/db/template-structure.ts:129` · `insertTemplateItems` fell back to id 0 for a missing RETURNING row — now throws
      test: no automated test · — unreachable (the insert returns every row); throwing makes it loud, not tested
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/actions/work-catalogue.ts:149` · deleting a katalog entry cascaded prace out of szablony without moving their revision, so an open szablon editor kept the dead praca — now bumps `bumpTemplateRevision` per affected szablon
      test: TDD · integration — `work-catalogue-delete-templates.db.test.ts` asserts the szablon's `updated_at` moved
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/template-structure.ts` (katalog edit from a szablon cell) · other szablony using the same entry aren't marked edited — a katalog edit is a katalog change (the /katalog-prac edit doesn't mark them either); only a structural cascade (delete) moves them
      test: no automated test · — intended behaviour
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/actions/template-action.ts` · gate revalidates only `presets`, not `entityTag('template', id)` — nothing caches the szablon tree, so no reader holds that tag
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/collections/templates.ts` · REST read shows trashed szablony to management — intended; the AI scripts read `trashedAt` themselves
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/actions/template-structure.ts:404` · `translateSectionName` called when the section already exists — runs in `after()`, and the kosztorys twin (`catalogue-to-kosztorys.ts:95`) does the same
- [x] 🔵 OBSERVATION · dismissed · code-review · shared editor menus · investment-plane imports (`useKosztorysSettings`, `applyCatalogueToKosztorysAction`) are unreachable in szablon mode only because their UI is hidden — noted for future reuse of those menus; no defect today
- [x] fixed · feature-first-structure + structure-scatter · `src/lib/kosztorys/create-template.ts` · szablon logic outside `lib/kosztorys/templates/` — moved into it
- [x] fixed · feature-first-structure + structure-scatter · `src/lib/db/templates.ts` · three reverse lookups katalog → szablony lived with the szablon rows — moved to `src/lib/db/catalogue-usage.ts` (spec block moved to `catalogue-usage.db.test.ts`)
- [x] fixed · module-cohesion · `src/lib/kosztorys/work-catalogue/read-catalogue-items.ts` · two action input schemas beside a DB reader — split to `insert-catalogue-items-schema.ts`
- [x] fixed · structure-scatter · `src/components/kosztorys/editor/{editor,kosztorys-editor,template-editor}-actions.ts` · plane adapters at the editor root, away from their context — moved into `editor/actions/`
- [x] dismissed · feature-first-structure · `src/lib/kosztorys/preset-labels.ts` · flat file — both planes read it (`reload-from-preset.ts`, the szablon actions), so it isn't szablon-only
- [x] dismissed · feature-first-structure · `src/lib/kosztorys/work-catalogue/template-catalogue-patch.ts` · szablon logic in `work-catalogue/` — not added by this slice, and it writes katalog rows
- [x] dismissed · feature-first-structure · `src/lib/db/template-structure.ts:159,259` · multi-statement functions in `lib/db` — mirror the kosztorys `lockAndCheckLayout` / layout-insert precedent in the same layer
- [x] dismissed · feature-first-structure + structure-scatter · `src/lib/actions/template-structure.ts:207,297,348` · placement helpers may duplicate `place-catalogue-items.ts` — they don't: that one copies katalog values into `kosztorys_items`, these write refs
- [x] dismissed · feature-first-structure · `src/lib/kosztorys/add-item-schema.ts:2` · `lib` imports a schema from `components/forms` — carried over unchanged from `lib/actions/kosztorys.ts`, not introduced here
- [x] dropped · feature-first-structure · `lib/queries/presets.ts`, `components/presets/` · „preset" vs „template" naming split — renaming the legacy preset surface is churn with no behaviour gain
- [x] dismissed · module-cohesion · `src/lib/kosztorys/add-item-schema.ts:35` · `TEMPLATE_ITEM_NEEDS_CATALOGUE` beside the add-item schema — its one consumer is a `'use server'` file (can't export a const) and the spec imports it
- [x] dismissed · module-cohesion · `src/lib/actions/template-structure.ts` (408 lines) · candidate split — one entity's structure writes; not a grab-bag
- [x] dismissed · module-cohesion · `src/lib/actions/kosztorys-presets.ts` · three szablon-plane twins in a kosztorys-named file — the file's concern is the szablon operations (save / reload / append) on both planes, and the twins share eight private schemas and messages with their siblings; a split would need a third module for those
- [x] dropped · module-cohesion · `src/lib/kosztorys/snapshot-taken-by-names.ts` · a `payload.find` in `lib/kosztorys/` — one small cohesive helper; moving it buys nothing
- [x] dropped · module-cohesion · `src/lib/kosztorys/preset-labels.ts` · could join `labels.ts` — that file is UI display labels; these are version labels
- [x] dismissed · structure-scatter · `lib/db`, `lib/actions` flat · not scatter this slice caused
- [x] fixed · comment-noise · `src/__tests__/helpers/template.ts:60` · comment restated `addTestTemplateSection` — deleted
- [x] fixed · comment-noise · `src/components/kosztorys/editor/actions/editor-actions-context.tsx:7` · trimmed the „not a field of KosztorysEditorProvider" narration
- [x] fixed · comment-noise · `src/components/kosztorys/editor/actions/editor-actions.ts:19` · first sentence restated the type — deleted
- [x] fixed · comment-noise · `src/__tests__/lib/actions/template-structure.test.ts:64` · comment restated `onTemplatePlaneOnly` — deleted
- [x] fixed · comment-noise · `src/lib/kosztorys/seed-from-preset.ts:11` · „Seed orchestration behind the investment-create flow" restated the name — deleted
- [x] dropped · comment-noise · `append-preset-sections.test.ts:77`, `serialize-apply-preset.test.ts:149`, `queries/kosztorys.ts:64`, `actions/template-tree.ts:64`, AI case scripts (`adopt-case-prod.ts:14`, `create-case-local.ts:16`, `new-case-prod.ts:19`) · judgment-call deletes — each carries something the name doesn't (fixture shape, the UI label, why the old PRESET_IDs no longer work)
- [x] dismissed · tailwind-v4-audit · — nothing found
- [x] 🟡 WARNING · fixed · suite · `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts` · the slice added the `templateSnapshots` / `templateTrash` steps to the cleanup cron, but the route spec still expected the old keys, and the unmocked steps threw (`ok: false`) — now mocks both and asserts both keys, including the all-fail → 500 case
      test: no automated test · unit — the spec itself is the guard; 11/11 green
- [x] fixed · simplify (altitude) · `src/components/kosztorys/editor/actions/editor-actions.ts` · the plane flag was passed beside the action set, so the two could disagree — `EditorActionsT.isTemplate`, read from the set
- [x] fixed · simplify · `src/lib/actions/kosztorys-presets.ts` · both „Sekcja z szablonu" append actions resolved the picked sections by hand — shared `templates/resolve-section-slices.ts`
- [x] fixed · simplify · `src/lib/db/template-snapshots.ts` · retention bands copied from the kosztorys GC — one `gcRetentionBands(db, scope)` in `snapshots.ts`
- [x] fixed · simplify · `src/lib/db/template-structure.ts` · `lockAndCheckTemplateLayout` re-implemented the layout permutation check — `coversExactly` in `reorder-layout.ts`, used by both planes
- [x] fixed · simplify · `src/lib/db/template-structure.ts` · `TemplateSectionPatchT` duplicated `SectionPatchT` — removed
- [x] fixed · simplify · `src/lib/kosztorys/work-catalogue/template-catalogue-patch.ts` · `splitTemplatePatch` returned a `rowPatch` nobody read — `pickCataloguePatch`
- [x] fixed · simplify · `src/lib/actions/kosztorys.ts` · dead `Payload` import and a stale „Patch schemas" header — removed
- [x] fixed · simplify · `src/lib/kosztorys/templates/serialize-template.ts` · `sectionIds` param unused after the slice resolver landed — removed (with its spec case)
- [x] fixed · simplify · `src/lib/kosztorys/templates/restore-template-snapshot.ts` · raw SQL for live katalog ids duplicated `insert-kosztorys-tree.ts` — `existingCatalogueIds` in `lib/db/work-catalogue.ts`
- [x] fixed · simplify · `src/lib/db/template-structure.ts` · `insertTemplateSection` + a follow-up UPDATE for the color — the insert takes `color`
- [x] fixed · simplify · `src/lib/db/template-tree.ts` · duplicate `sectionId` line in `mapTemplateItem` — removed
- [x] fixed · simplify · `src/lib/db/template-structure.ts` · `nextTemplateSectionOrder` copied the kosztorys max+1 query — scoped `nextDisplayOrder(db, scope, ownerId)`
- [x] fixed · simplify · `src/lib/db/template-tree.ts`, `src/lib/actions/kosztorys.ts` · per-section numbering loop written twice — `numberWithinSections` in `display-order.ts`
- [x] fixed · simplify · `src/lib/actions/template-structure.ts` · katalog-translation lookup copied from `kosztorys.ts` — `work-catalogue/catalogue-translations-for.ts`
- [x] fixed · simplify · `src/__tests__/lib/actions/template-trash.db.test.ts` · local `trashDaysAgo` — shared helper, `TrashableTableT` gains `'templates'`
- [x] fixed · simplify (efficiency) · `src/lib/kosztorys/templates/replace-template-layout.ts` · SELECT FOR UPDATE then two stamp UPDATEs — one `markTemplateTreeReplaced` up front takes the row lock
- [x] fixed · simplify (efficiency) · `src/lib/actions/work-catalogue.ts` · per-szablon bump loop on katalog delete — one `markTemplatesHoldingCatalogueItemReplaced` UPDATE
- [x] fixed · simplify · `src/lib/actions/kosztorys-presets.ts` · `saveTemplateAsPresetAction` awaited then returned — returns the transaction directly
- [x] fixed · simplify · `src/lib/actions/catalogue-to-kosztorys.ts` · double blank line
- [x] dropped · simplify (altitude) · editor storage-key ternaries / `storagePrefix` · one-liners, and the persisted key names differ per plane by design
- [x] dropped · simplify · slot resolver kosztorys ↔ szablon merge · the parameters would equal the code (plane-specific owner query + scope)
- [x] dropped · simplify · remaining one-line `trashed_at = now()` writes in 6 specs · the helper call isn't shorter
- [x] dropped · simplify · section-by-name query sharing across planes · needs three plane callbacks
- [x] dropped · simplify · `reloadSchema` field name, inline `SELECT name FROM investments` · naming nit / one-off read
- [x] dropped · simplify (efficiency) · double szablon-row read in an action · one PK read
- [x] dropped · simplify (efficiency) · `savePresetAction` serialization · low cost, rare action
- [x] dismissed · simplify (efficiency) · narrowing sections in memory after a full serialize · same read either way; `sectionIds` removed anyway
- [x] dismissed · simplify · `InvestmentGateT` looked duplicated · it's a mixin spread into `investmentGateForRow` and `worker-report-share`
- [x] dismissed · simplify (efficiency) · `markTemplateEdited` runs twice via the `templateAction` tail · one PK UPDATE

- [x] fixed · reuse-scan · `src/lib/actions/template-structure.ts:242` · „Dodaj pracę" row prep (text check, translation) and result tail (ceiling + untranslated warnings) copied from `addItemAction` — in-diff copy of `src/lib/actions/kosztorys.ts:460`; both now call `prepareNewItemRow` / `addedItemResult` (`src/lib/kosztorys/new-item-row.ts`)
- [x] fixed · reuse-scan · `src/lib/actions/template-snapshots.ts:53` · version-label schema — in-diff copy of `kosztorys-snapshots.ts:28`; shared `snapshotLabelSchema` (`src/lib/kosztorys/snapshot-label-schema.ts`)
- [x] fixed · reuse-scan · `src/lib/db/template-snapshots.ts:55` · snapshot-meta row mapper — in-diff copy of `src/lib/db/snapshots.ts:134`; shared `snapshotMetaOf` (uses `numOrNull` / `textOrNull` from `row-coerce.ts`)
- [x] fixed · reuse-scan · `src/lib/actions/kosztorys-presets.ts:71` · live-katalog-id lookup via `listCatalogueItemsByIds` + Set — existing primitive `existingCatalogueIds` at `src/lib/db/work-catalogue.ts:46`
- [x] fixed · reuse-scan · `src/lib/db/template-structure.ts:241` · hand-rolled nullable-text coercion — existing primitive `textOrNull` at `src/lib/db/row-coerce.ts:11`
- [x] fixed · reuse-scan · `src/lib/kosztorys/templates/template-layout.ts:15` · display-order comparator written twice in one file — hoisted `byDisplayOrder`
- [x] dismissed · reuse-scan · template layout lock/apply, slot resolver, section-name reads, `templateAction`, `templateGateFor`, trash db/purge, collection access blocks, translation fill, usage-name lookups · checked against their kosztorys/entity twins — different tables, gates or return shapes, or already reuse the shared primitive (`purgeTrashedRows`, `isNameConfirmed`)

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 20 applied, 0 proposed, 10 dropped/dismissed; each folded into ## Findings (tagged `simplify`). Then `primitive-reuse-scan` (catalogue of `.reuse-scan.json` homes vs the slice's new files) — 6 fixed, 1 dismissed group, tagged `reuse-scan`.

## Tests & suite

- typecheck — green (after `generate:importmap`), re-run green after the simplify pass
- lint — green on this slice; 1 pre-existing error from `main` (`use-investment-from-url.test.ts:21`, rules-of-hooks, f004b9d08) left alone
- test:integration — 150/150 files green after the purge-spec fix (epilogue)
- after simplify — 23 touched spec files (154 tests) + the cron cleanup route spec (11) green
- after reuse-scan — typecheck green; 9 covering spec files (63 tests) green; eslint on touched files 0 errors
- build (`next build --webpack`) — green
- `pnpm test` (unit) — not run: plan marks it owner's go
- e2e — not run (owner runs it)
