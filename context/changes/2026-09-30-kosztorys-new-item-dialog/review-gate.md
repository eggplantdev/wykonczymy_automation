# Review-gate ledger — kosztorys-new-item-dialog · 2026-09-30

Scope: `e457b738...HEAD` (branch point off `staging`), 41 files, no untracked files.
Step 0.5 (browser verification) skipped — driving the Playwright browser needs an explicit ask; the
12 manual checks in `context/foundation/manual-checks.md` § EX-951 stay with a human.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only), then
`/simplify` and `primitive-reuse-scan` serially.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/editor/dialogs/new-item/new-item-dialog.tsx:81` · an anchor praca deleted in another tab returned NOT_FOUND on every retry and left the dialog stuck — the dialog now reseeds the grid (`onStaleTree`) and closes
      test: TDD · dom — `new-item-dialog.test.tsx` NOT_FOUND specs went red, then green
- [x] 🟡 WARNING · dropped · code-review · `src/components/kosztorys/editor/dialogs/new-item/new-item-form.tsx:75` · the collision check reads the client's katalog snapshot, so an entry added elsewhere since load is missed — the server still refuses a `new` write with the Polish `DUPLICATE_ERROR` and the form stays open; a rare race among ~5 users
      test: no automated test — the refusal path is already covered by `kosztorys-add-item.test.ts`
- [x] 🟡 WARNING · dropped · code-review · `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts:58` · two concurrent „new" writes of the same opis + j.m. make the second hit the UNIQUE index (23505) instead of the Polish sentence — the transaction rolls back and a generic error shows; needs two owners typing the same praca in the same second
      test: no automated test — not worth a concurrency harness for this blast radius
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/kosztorys.ts:491` · the gate target is built from the raw input before zod validation (= impl-review F2) — `investmentAction` resolves a bad id to NOT_FOUND; nothing is written before validation
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/kosztorys.ts:547` · `workCatalogue` is revalidated even when the katalog was not written — a cheap tag; the in-code comment records why (the collection hook is silenced in the transaction)
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/create-item.ts:12` · the end-of-sekcja slot is an unlocked MAX+1 — pre-existing, shared with every other item append, and not introduced by this slice
      test: no automated test — pre-existing
- [x] fixed · code-review · `src/lib/actions/kosztorys.ts:461` · `AddItemInputT` was hand-written next to its schema — now `z.infer<typeof addItemSchema>`
- [x] dropped · code-review · `src/stores/form-stores.ts` · `useNewItemFormStore` takes a store slot although the form never persists a draft — `useManagedForm` requires a store; a no-op slot is cheaper than making the argument optional
- [x] dropped · code-review · `src/lib/kosztorys/create-item.ts:8` · `NewRowT` is now only used locally — cosmetic
- [x] dropped · code-review · `src/lib/kosztorys/row-ops.ts` · `rowFromItem` near-duplicates the tree mapper — the shapes differ in what they default; not worth the churn
- [x] dismissed · code-review · `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts:35` · `duplicateRefusal` looks redundant next to `resolveCatalogueWrite` — the save-to-catalogue path calls it separately
- [x] fixed · impl-review · `src/components/kosztorys/editor/actions/new-item-host.tsx:11` · the host's shape drifted from the plan (F1) — aligned with the `CataloguePickerHost` pattern
- [x] dismissed · impl-review · `src/components/ui/alert-dialog.tsx:34` · `onOverlayClick` was added to a shared primitive (F3) — an optional prop, needed so an overlay click on the three-way confirm means „Wróć"
- [x] dismissed · impl-review · prettier drift in untouched files (F4) — not this slice's diff
- [x] fixed · impl-review · `src/lib/actions/kosztorys.ts:463` · the empty opis / j.m. refusal was an English string (F5) — now `EMPTY_ITEM_TEXT_ERROR` in Polish
- [x] fixed · feature-first-structure · `src/components/kosztorys/editor/dialogs/catalogue/catalogue-overwrite-prices.tsx` · a component file also exported the text helpers — `categoriesDiffer` / `overwriteSentence` / `NO_CATEGORY` moved to `lib/kosztorys/work-catalogue/catalogue-overwrite-text.ts`
- [x] dismissed · feature-first-structure · `src/components/kosztorys/editor/dialogs/new-item/catalogue-collision-confirm.tsx:18` · a sideways import from `dialogs/catalogue/` — both are kosztorys editor dialogs; `PriceList` has two consumers under one parent
- [x] fixed · feature-first-structure · `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts:101` · `rateColumns` lived in the component file — moved next to the schema as a private helper of `catalogueFigures`
- [x] dismissed · feature-first-structure · `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts` · no dedicated spec — covered end-to-end by `kosztorys-add-item.test.ts` and `work-catalogue.test.ts` against the DB
- [x] fixed · module-cohesion-audit · `src/lib/kosztorys/item-from-fields.ts` · `ceilingWarnings` / the item builder lived in the action file — moved to `lib/kosztorys/`
- [x] dismissed · module-cohesion-audit · `src/components/kosztorys/editor/dialogs/new-item/new-item-form.tsx` · the collision state beside the form — it belongs to this one submit flow
- [x] dismissed · module-cohesion-audit · `src/lib/actions/kosztorys.ts` · duplication between add-item and the other item actions — the shared pieces are already helpers
- [x] skipped · module-cohesion-audit · `src/lib/actions/kosztorys.ts` · file size — a split of the whole action file is its own refactor, not this slice
- [x] fixed · module-cohesion-audit · `src/components/forms/work-catalogue-item/rate-fields.tsx` · `RateField` extracted from the katalog form so „Nowa praca" reuses it
- [x] fixed · module-cohesion-audit · `src/components/kosztorys/editor/dialogs/new-item/new-item-form-schema.ts` · the schema was forked — now extends `workCatalogueItemBaseSchema`
- [x] fixed · module-cohesion-audit · `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts:110` · the form→figures mapping was written in two forms — `catalogueFigures`
- [x] skipped · module-cohesion-audit · `src/components/kosztorys/editor/use-kosztorys-editor.ts:833` · `placeNewItem` could become a leaf hook — the stage-ops-style split of this hook is EX-521's ongoing work, not this slice's
- [x] fixed · comment-noise-audit · diff-wide · restating / vanished-state comments deleted or trimmed (`e2e/kosztorys-structure.spec.ts`, `kosztorys-add-item.test.ts`, `types.ts`, `use-managed-form.ts`, `new-item-input.ts`, `catalogue-overwrite-prices.tsx`)
- [x] dismissed · comment-noise-audit · `src/lib/actions/kosztorys.ts:486`, `write-catalogue-entry.ts:52`, `use-kosztorys-editor.ts:821` · flagged, kept — each carries a why the code cannot say
- [x] dismissed · tailwind-v4-audit · `src/components/kosztorys/editor/dialogs/new-item/` · inline-style finding — none left in the diff after the combobox class moved
- [x] dropped · structure-scatter-audit · diff-wide · naming nits only; no new file landed in a competing home
- [x] fixed · simplify · `src/lib/actions/kosztorys.ts:491` · `addItemAction` looked the investment up again — uses `investmentAction`'s ctx `investmentId`
- [x] fixed · simplify · `src/lib/kosztorys/constants.ts:38` · `DEFAULT_UNIT` dead after the blank row went — deleted
- [x] fixed · simplify · `src/lib/kosztorys/row-ops.ts:69` · „Splice a blank row" comment stale — fixed
- [x] fixed · simplify · `src/lib/kosztorys/item-from-fields.ts:21` · katalog→item mapping written twice — `itemFromFields` takes katalog columns; `catalogueEntryAsItem` deleted, `placeCatalogueItems` and `worker-report` call it
- [x] fixed · simplify · `src/lib/actions/kosztorys.ts:505` · guards checked in two places — flattened into one pass before the transaction
- [x] fixed · simplify · `src/components/kosztorys/editor/dialogs/new-item/new-item-form.tsx:71` · `beforeSubmit` and `toData` both re-derived the katalog decision — `beforeSubmit` decides, `toData` sends `catalogueWrite.current`
- [x] fixed · simplify · `src/lib/kosztorys/subcontractor-price-guard.ts:175` · the negative-price sentence toasted twice when both płaszczyzny were below zero — per-praca Set moved into `ceilingWarnings`, so `placeCatalogueItems` benefits too
- [x] fixed · simplify · `src/components/forms/work-catalogue-item/creatable-combobox-field.tsx` · the creatable Combobox field was copied four times across two forms — `CreatableComboboxField`
- [x] fixed · simplify · `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts:137` · empty katalog form values duplicated in `add-catalogue-item-dialog.tsx` and `newItemDefaults` — `EMPTY_CATALOGUE_ITEM_VALUES`
- [x] skipped · simplify · `src/components/kosztorys/editor/dialogs/new-item/new-item-dialog.tsx:54` · placement held in both the dialog (`landing`) and the host — moving the chaining into the host pushes its spec from a DOM test into an editor-context harness
- [x] skipped · simplify · `src/components/forms/hooks/use-managed-form.ts:51` · an async `toData` could replace `beforeSubmit` + ref — `toData` would leave `settleAction`'s catch for ~20 forms; a review-worthy refactor
- [x] skipped · simplify · `src/components/ui/form-dialog.tsx:16` · a controlled `FormDialog` would absorb `NewItemDialog`'s hand-claimed keep-open slot — shared-infra change across every form dialog
- [x] skipped · simplify · `src/components/kosztorys/editor/dialogs/new-item/new-item-form.tsx:124` · offer only the top-N units of the kosztorys — behaviour change, the owner's call
- [x] dismissed · simplify · `src/components/kosztorys/editor/use-kosztorys-editor.ts:272` · ref vs context for the host — the openers are built inside `use-kosztorys-editor`, and context churn is the EX-496 regression
- [x] dismissed · simplify · `src/lib/kosztorys/work-catalogue/item-to-catalogue.ts:38` · reuse `asPricing` — its source is item-shaped, not katalog-shaped
- [x] dropped · simplify · `src/lib/actions/worker-report.ts` · `extraAsItem` literal — the parameters are the code
- [x] dropped · simplify · `src/components/forms/work-catalogue-item/` · merge `RatePlaneValuesT` / `RateFieldNameT` — minor
- [x] dropped · simplify · `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts:17` · a `CATALOGUE_WRITE_MODES` const — minor
- [x] dropped · simplify · `catalogue-collision-confirm.tsx:53` / `save-item-to-catalogue-dialog.tsx:90` · the two-PriceList comparison block — a shared form needs five props (optional existing, two titles, the toggle) for ~15 lines
- [x] dropped · simplify · `src/lib/actions/work-catalogue.ts:56` · an `excludeId` on `resolveCatalogueWrite` for the update action's holder check — folds two lines into one parameter
- [x] fixed · reuse-scan · `src/lib/kosztorys/unit-options.ts` · `unitOptions` lived under `worker-report/` but „Nowa praca" is its second consumer — moved to `lib/kosztorys/`
- [x] dismissed · reuse-scan · `src/components/forms/work-catalogue-item/creatable-combobox-field.tsx` · vs `FormCombobox` (`form-combobox.tsx:14`) — that one is a pick-only `SearchSelect`; this field must accept a new value
- [x] dismissed · reuse-scan · `src/components/kosztorys/editor/dialogs/new-item/catalogue-collision-confirm.tsx` · vs `ConfirmDialog` (`confirm-dialog.tsx:30`) — three outcomes by owner ruling, `ConfirmDialog` has two
- [x] dismissed · reuse-scan · `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts:21` · `catalogueRow` vs `toCatalogueCandidate` (`item-to-catalogue.ts:38`) — different sources (form data vs a kosztorys item)
- [x] dropped · reuse-scan · `src/lib/actions/kosztorys.ts:476` · `resolveInsertSlot` + `shiftDisplayOrderFrom` pair, also at `:386` — a combined helper saves one line per site
- [x] dropped · reuse-scan · `src/components/kosztorys/editor/actions/new-item-host.tsx:44` · the `row.unit ? [row.unit] : []` filter repeats `unitOptions`' own `filter(Boolean)` — cosmetic

## Simplify pass

Ran /simplify — 9 applied, 0 proposed, 11 not applied (4 skipped, 2 dismissed, 5 dropped); each folded into ## Findings (tagged `simplify`). No separate report file — the gate ledger is the report.

## Tests & suite

- typecheck — clean apart from pre-existing errors not in this diff (`subcontractor-due-by-plane.test.ts` TS2739, importMap TS2307 ×3)
- eslint on touched files — clean
- touched unit/DOM specs (`forms`, `editor/dialogs`, `editor/hooks`, `components/dialogs`, `subcontractor-price-guard`, `display-order`, `kosztorys-calc`) — 348 passed, 16 skipped
- DB action specs vs 5435 (`kosztorys-add-item`, `work-catalogue`, `work-catalogue-save`, `catalogue-to-kosztorys`, `kosztorys-create-order`, `kosztorys-lock`, `kosztorys-renumber-kosztorys-order`, `accept-worker-report`, `worker-report`) — 88 passed
- E2E — `e2e/kosztorys-structure.spec.ts` authored, **not run** (an E2E run needs an explicit ask)
- full suite (`pnpm test` / `test:integration` / `build`) — **not run**, not requested; the pre-push hook runs the unit + integration legs
