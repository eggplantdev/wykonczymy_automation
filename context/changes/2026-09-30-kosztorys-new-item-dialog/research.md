---
date: 2026-09-30T17:35:01+0200
researcher: ex-Plant (Claude)
git_commit: e457b738
branch: staging
repository: wykonczymy
topic: "Replace the blank „Nowa praca” row with a form dialog that can also write the katalog prac"
tags: [research, codebase, kosztorys-editor, work-catalogue, forms, server-actions]
status: complete
last_updated: 2026-09-30
last_updated_by: ex-Plant (Claude)
---

# Research: Replace the blank „Nowa praca” row with a form dialog

**Date**: 2026-09-30T17:35:01+0200
**Researcher**: ex-Plant (Claude)
**Git Commit**: e457b738
**Branch**: staging
**Repository**: wykonczymy

## Research Question

What must change so that every way of adding a praca in the kosztorys editor opens a form dialog instead of creating a blank row? The entry points are „Wstaw powyżej/poniżej”, „Dodaj pracę” on the sekcja band and in the sekcja menu, and toolbar „Dodaj → Praca”. The dialog takes opis, j.m., Cena j.m. and the stawka źródła. It places the praca at the chosen spot and can also write the katalog prac in the same transaction. Owner decisions are in `change.md`.

## Summary

- **Client.** No call site needs to change. All five entry points go through two callbacks: `handleAddItem(sectionId)` and `handleInsertItem(anchorRow, dir)`, in `use-kosztorys-editor.ts:838-877`. Re-pointing those two to "open the dialog with a placement" leaves every menu, cell and column-opts wiring as it is.
  - The dialog must be hosted once at editor level, because menus unmount on close.
  - `CataloguePickerHost` (`editor/actions/catalogue-picker-host.tsx`) is the exact pattern to mirror.
- **Server.** Nothing today creates a praca *with fields*: `createBlankItem` hardcodes defaults. The building blocks for a new action already exist:
  - `insertItems` takes a full `KosztorysItemT`.
  - `catalogueEntryAsItem` maps rate columns to override columns.
  - `placeCatalogueItems` computes ceiling warnings.
  - `resolveInsertSlot` + `shiftDisplayOrderFrom` give the insert-at slot.
  - The katalog write can join the same `withPayloadTransaction` through `req`.
  - Both sides are gated to the same roles (ADMIN/OWNER/MANAGER), so no permission split appears.
- **Form.** Reuse the katalog form's pieces, not the whole form.
  - `WorkCatalogueItemForm` is used by three dialogs and binds a katalog-only store and values type.
  - The plan should extract `RateField`, `rateColumns` and the schema's rate-plane refinement into a shared module, then compose a new form from them.
  - The EX-947 „extra work" dialog named in EX-951 is **not** a reuse base: it is plain `useState` rows with no price or stawki. The file `extra-work-dialog.tsx` does not exist.
- **Collision confirm.** The owner's rule is "declining still saves the praca". It does not fit either confirm the codebase has:
  - `confirmBeforeSubmit` in `use-managed-form` aborts the submit on "no".
  - `ConfirmDialog` treats Escape and overlay-click as cancel.
  - The flow therefore needs three outcomes: overwrite / kosztorys only / back to the form.

## Detailed Findings

### 1. Entry points → two handlers

| Entry point | File | Callback | Gate |
|---|---|---|---|
| Row menu „Wstaw powyżej/poniżej" | `grid/menus/kosztorys-row-actions-menu.tsx:59-66` → `grid/row-actions-column.tsx:16-35` | `opts.onInsertItem(row, dir)` via `columnData.opts` (stable component identity, EX-422) | `disabled={sortActive}` |
| Band „+ Dodaj pracę" (itemless sekcja only) | `grid/cells/section-header-cell.tsx:171-181` | `actions.onAddItem(sectionId)` | shown when `!foldable && actions` |
| Sekcja menu „Dodaj pracę" | `grid/menus/kosztorys-section-actions-menu.tsx:110-113` | `actions.onAddItem(sectionId)` | not sort-gated on purpose (comment :108-109; appends at the end) |
| Toolbar „Dodaj → Praca → [sekcja]" | `toolbar/menus/kosztorys-add-menu.tsx:67-82` | `handleAddItem(section.sectionId)` from context | toolbar hides the menu under `readOnly` (`kosztorys-editor-toolbar.tsx:79`) |
| Toolbar „Dodaj → Praca" with 0 sekcje | `kosztorys-add-menu.tsx:56-65` | `handleAddSection()` then `handleAddItem(id)` | — |

- `onAddItem` is `editorOnly(handleAddItem)` at `use-kosztorys-editor.ts:553`. `onInsertItem` is `editorOnly(handleInsertItem)` at `:578`.
- The band `actions` bundle is all-or-nothing (`kosztorys-editor-body.tsx:247-290`).
- Read-only mode (`preview || locked`, `:190`) drops all of these callbacks through `editorOnly`. The dialog inherits that gate for free.
- **szablon (`isTemplate`)** has every add entry point; only „Etap" is hidden (`kosztorys-add-menu.tsx:93`).
  - Its grid runs `lockRows`, so the menus are its only add route.
  - `canSaveItemToCatalogue` is not gated on `isTemplate` (`:585`), so writing the katalog from a szablon is already allowed.
- **Worker view (`isBare`)** is always preview, so it needs no extra gate.

### 2. Optimistic row plumbing

- **Today's flow:**
  1. The action returns `{id, displayOrder}`.
  2. `makeBlankRow` (`use-kosztorys-editor.ts:812-825`) calls `buildBlankRow` (`lib/kosztorys/row-ops.ts:36-65`, which hardcodes `DEFAULT_ITEM_DESCRIPTION` / `DEFAULT_UNIT` / 0 / null overrides).
  3. `prevById.set` (the autosave diffs against it).
  4. `applyAddItem` (`row-ops.ts:71-77`, with `orderRowsBySections` for a first pozycja), or `applyInsertItem` (`row-ops.ts:116-126`, a no-op if the anchor vanished).
  5. Add calls `unfoldSection`; insert does not.
- **Better path for a pre-filled row:** have the server return a full `KosztorysItemT` and feed it through `rowsFromSections` (`use-kosztorys-editor.ts:1025-1042`). That runs `treeToRows` with the current stages and globals and seeds `prevById`.
  - This is how the katalog picker (`handleAppendedCatalogueItems` `:1054-1075`) and the worker-report accept (`appendAcceptedItems` `:1078-1087`) already bring rows in.
  - The insert position still needs `applyInsertItem`-style splicing, because those two paths only append.
- **Undo:** add and insert never call `pushCommand` today (`:379`), so a dialog-created row needs no undo handling to match current behaviour.

### 3. Host pattern for the dialog

`CataloguePickerHost` (`editor/actions/catalogue-picker-host.tsx`, mounted around the body at `kosztorys-editor-body.tsx:467-741`):
- It exposes a stable `open(sectionId?)` through context.
- It renders `{children}` followed by `{target && <Dialog … />}`.
  - `children` is passed as a prop, so opening the dialog does not re-render the grid (the EX-496 perf regression).
  - The dialog mounts only while open, so its state resets on each open.
- `kosztorys-section-actions-menu.tsx:66` already calls `useCataloguePicker()` from inside a grid cell.

A sibling `NewItemDialogHost` would hold a placement target: `{sectionId}`, `{anchorItemId, dir}`, or "no sekcja yet". Tests that render the toolbar already wrap it in `CataloguePickerHost` (`kosztorys-editor-toolbar.test.tsx:86`) and will need the new host too.

### 4. Server: creating a praca with fields

- **`addItemAction`** (`lib/actions/kosztorys.ts:426-445`):
  - Gated by `investmentAction` on the sekcja.
  - No transaction: `sectionOwnerAndNextItemOrder` then `createBlankItem` without `req`.
- **`insertItemAction`** (`:452-492`), inside `withPayloadTransaction({skipRevalidation: true})`:
  1. `resolveInsertSlot`, which locks the section's rows (`display-order.ts:152-164`).
  2. `investmentGateForRow`.
  3. `shiftDisplayOrderFrom` (+1 to the tail).
  4. `createBlankItem({req})`.
- **`createBlankItem`** (`lib/kosztorys/create-item.ts:48-72`) accepts no fields.
- **`insertItems`** (`lib/kosztorys/insert-rows.ts:117-138`) is a raw SQL multi-row INSERT of full `KosztorysItemT`s, covering all four override columns. The caller owns the transaction.
  - It bypasses Payload field rules (such as `min: 0` on coeffs), so **the action's Zod schema is the only backstop**.
  - `insert-schema-drift.test.ts` already guards its column list.
- **`catalogueEntryAsItem`** (`lib/kosztorys/work-catalogue/place-catalogue-items.ts:26-46`) builds a `KosztorysItemT` from a katalog entry: rate → `…OverrideValue`, coeff → `…OverrideCoeff`, `plannedQty: 0`.
  - `extraAsItem` (`lib/actions/worker-report.ts:490-517`, in-flux in the tree) hand-writes the same literal.
  - A shared "item from fields" builder would serve all three callers.
- **`placeCatalogueItems`** (`:59-93`) runs `checkSubcontractorPrice(asViewPricing(item), plane)` per plane to produce warnings (warn, never block), then `insertItems`. Its "consecutive slots" constraint (`:51-54`) is irrelevant for a single row.
- **Validation the new path must own:**
  - description and unit required;
  - `clientPrice ≥ 0` (note `itemPatchSchema` has no floor on `clientPrice`);
  - rate/coeff `≥ 0`;
  - at most one column set per plane. Deriving both columns from a `source` enum makes two set columns unrepresentable, the way `rateColumns` does.
  - `checkSubcontractorPrice`: refuse `severity: 'refuse'` (negative) and return ceiling warnings. On cell edits this guard runs **client-only** (`cell-edit.ts:68,124`).
- **Item-side „auto"** is both override columns null for that plane, the same encoding the katalog uses. The form's `rateColumns` mapping (`work-catalogue-item-form.tsx:158-164`) applies to the item unchanged.

### 5. Server: writing the katalog in the same transaction

- **`createCatalogueItemAction`** (`lib/actions/work-catalogue.ts:29-55`):
  1. `workCatalogueItemSchema`.
  2. `toRow` (`:17-27`): trims, `category.trim() || null`, `matchKey: catalogueKey(description, unit)`.
  3. Pre-check with `payload.find` on `matchKey`, returning `DUPLICATE_ERROR`.
  4. `payload.create` without `req`.
- **Overwrite** exists only in `saveItemToCatalogueAction(itemId, 'new'|'overwrite', keepCategory)` (`:124-171`), which reads the candidate **from a persisted item id**.
  - The update is in place, keeping id and `created_at`.
  - `keepCategory` defaults to keeping the katalog's kategoria (commit `7b0f5442`).
- **`match_key`:**
  - Computed in code only: `catalogueKey` (`lib/kosztorys/work-catalogue/catalogue-key.ts:15-17`) = `foldDescription|foldUnit`.
  - Pure (no `server-only`), and already used client-side (`worker-reports/line-draft.ts:44`).
  - Backed by UNIQUE (`collections/work-catalogue-items.ts:83-89`).
  - Payload create has no `ON CONFLICT`, so a race becomes a 23505 that rolls back the whole transaction, item included. That failure is acceptable because it is atomic.
- **Shared transaction:** `withPayloadTransaction` builds a `req` with a `transactionID`.
  - `getDb(payload, req)` gives raw SQL the same session (`get-db.ts:12-19`).
  - `payload.create/update({collection: 'work-catalogue-items', req})` joins it.
  - Pass `skipRevalidation` and revalidate `['kosztorysItems', 'workCatalogue']` from the action (`updateTag`, per AGENTS.md).
- **Collision detection before submit:** `catalogueKey(opis, j.m.)` against `workCatalogue[].matchKey`, synchronously on the client. `workCatalogue` is already in editor context (`use-kosztorys-editor.ts:1418`), fetched by `getWorkCatalogue()` on the kosztorys and szablon pages. No preview fetch is needed.
  - The existing preview (`use-catalogue-save-preview` → `catalogueSavePreview(itemId)`) is keyed by item id, not by typed text, so it does not fit.
  - The server must re-check inside the transaction anyway, since the client list can be stale.
- **Roles:** `investmentAction` and the katalog actions both sit on `protectedAction` → `MANAGEMENT_ROLES`. The katalog collection access is `isAdminOrOwnerOrManager`, a decision from work-item-catalog (the owner rejected a narrower gate). The only extra gate on the kosztorys side is the investment lock (`investment-action.ts:79-81`).

### 6. Form and dialog

- **`WorkCatalogueItemForm`** (`components/forms/work-catalogue-item/work-catalogue-item-form.tsx`):
  - Fields: Textarea opis; Combobox kategoria (`categorySuggestions`); Combobox j.m. (`UNIT_SUGGESTIONS`); cena j.m.; two `RateField`s. Rate and coeff show conditionally on the source, and a source change calls `resetField` on both.
  - The store is hardcoded (`useWorkCatalogueItemFormStore`, `stores/form-stores.ts:45`).
  - `toData` (`:72-85`) builds the payload field by field, so a hidden rate is already stripped. That satisfies lessons.md "Hiding a form field in JSX does not clear it".
  - Consumers: `add-catalogue-item-dialog.tsx`, `edit-catalogue-item-dialog.tsx`, `catalogue-item-from-kosztorys-dialog.tsx`.
  - `RateField`, `rateColumns`, `baseSchema`, `moneyIssue`, `coeffIssue` and `RATE_PLANES` are private.
- **Keep-open mechanics:**
  - The footer's „Nie zamykaj po zapisaniu" shows only when the store's `showKeepOpen` is true (`form-footer.tsx:24-45`). `openDialog(formId, showKeepOpen)` sets it and resets `keepOpen` (`stores/optimistic-form-store.ts:48-49`).
  - A host-controlled dialog (not `FormDialog`) must call `openDialog(formId, true)` itself.
  - `closeDialog` never resets `showKeepOpen` (`:53-57`). This is a latent leak into raw-`Dialog` forms; see Open Questions.
- **Submit paths** (`forms/hooks/use-form-submit.ts:28-51`):
  - With `keepOpen`, or with `awaitBeforeClose` (= `!persistDraft`), the action is awaited, a toast shows, and then `onReset`.
  - Otherwise it is optimistic and closes before the result. Its reopen-on-failure only works for `FormDialog`.
  - The editor needs the created row, so the new form must take the awaited path (`persistDraft={false}`) and capture the result in its `action` closure. `submit` never returns data.
  - The same closure moves the anchor for keep-open chaining.
- **`confirmBeforeSubmit`** (`use-managed-form.ts:46,125-131`) returns `false` on "no" and aborts the submit. The owner's rule, "declining saves to the kosztorys only", needs a different mechanism.
  - `ConfirmDialog` (`ui/confirm-dialog.tsx:24-26,41`) maps Escape and overlay-click to `onCancel`. If cancel meant "kosztorys only", Escape would save.
- **Old-vs-new figures:** `PriceList` in `save-item-to-catalogue-dialog.tsx:26-54` is private. Its `PricesT = CatalogueRateColumnsT & {clientPrice}` matches `WorkCatalogueItemDataT`. The overwrite sentence (`:165`) is an inline template worded for the rozpiska ("zmień nazwę pracy w rozpisce"), so move both to a shared file under `dialogs/catalogue/`.
- **j.m. suggestions:**
  - The katalog form uses static `UNIT_SUGGESTIONS = ['m²','szt','mb','kpl','pkt']` (`lib/kosztorys/constants.ts:38`).
  - The worker report merges those with the kosztorys's own units (`lib/kosztorys/worker-report/unit-options.ts:6-7`).
- **Kategoria suggestions:** `catalogueCategorySuggestions(workCatalogue)` (`lib/kosztorys/work-catalogue/category-options.ts:13-17`).
- **Drafts:** one sessionStorage slot per form type. A draft is restored only when `storedFormId === formId` (`use-managed-form.ts:105`). A dialog bound to an entity needs an entity-keyed `formId` (lessons.md:1773). With `persistDraft={false}` the question disappears.
- **Placement:** the dialog goes in a new `editor/dialogs/new-item/` folder, and the host in `editor/actions/` next to `catalogue-picker-host.tsx`. The extracted rate-field pieces go in `components/forms/work-catalogue-item/`, next to their owner.

### 7. Dead code after the change

- `DEFAULT_ITEM_DESCRIPTION` is used only by `buildBlankRow` (`row-ops.ts:45`), `createBlankItem` (`create-item.ts:64`) and `e2e/kosztorys-structure.spec.ts`.
- `addItemAction` / `insertItemAction` / `createBlankItem` have no other production callers.
- `DEFAULT_UNIT` is used elsewhere; keep it.
- „Nowa praca" literals in `history/change-rows.ts:89`, `add-catalogue-item-dialog.tsx:34` and `extra-works-dialog-button.tsx:48` are unrelated.
- Gate deletion on typecheck, not grep (memory: deadcode-gate-on-typecheck).

## Code References

- `src/components/kosztorys/editor/use-kosztorys-editor.ts:553,578` — `onAddItem` / `onInsertItem` wiring through `editorOnly`
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:812-877` — `makeBlankRow`, `handleAddItem`, `handleInsertItem`
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:1025-1087` — `rowsFromSections`, `handleAppendedCatalogueItems`, `appendAcceptedItems`
- `src/components/kosztorys/editor/actions/catalogue-picker-host.tsx` — the host pattern to mirror
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx:52-82` — toolbar Praca submenu and the zero-sekcje branch
- `src/components/kosztorys/editor/grid/row-actions-column.tsx:16-35` — row-menu callbacks from `columnData.opts`
- `src/lib/kosztorys/row-ops.ts:23-126` — `BlankRowInputT`, `buildBlankRow`, `applyAddItem`, `applyInsertItem`
- `src/lib/actions/kosztorys.ts:426-492` — `addItemAction`, `insertItemAction`
- `src/lib/kosztorys/create-item.ts:16-72` — `sectionOwnerAndNextItemOrder`, `createBlankItem`
- `src/lib/kosztorys/insert-rows.ts:21-37,117-138` — `ITEM_INSERT_COLUMNS`, `insertItems`
- `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts:26-93` — `catalogueEntryAsItem`, `placeCatalogueItems` (ceiling warnings)
- `src/lib/kosztorys/subcontractor-price-guard.ts:151-167` — `checkSubcontractorPrice`
- `src/lib/actions/work-catalogue.ts:17-55,124-171` — `toRow`, `createCatalogueItemAction`, `saveItemToCatalogueAction`
- `src/lib/kosztorys/work-catalogue/catalogue-key.ts:15-17` — `catalogueKey`
- `src/lib/db/work-catalogue.ts:155-166` — `findCatalogueItemByKey`
- `src/lib/db/with-payload-transaction.ts:23-40`, `src/lib/db/get-db.ts:12-19` — the shared transaction
- `src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx:62-85,158-207` — form, `toData`, `rateColumns`, `RateField`
- `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts:10-140` — form and domain schemas
- `src/components/forms/hooks/use-managed-form.ts:46,93-140` — `confirmBeforeSubmit`, reset, submit
- `src/components/forms/hooks/use-form-submit.ts:28-51` — awaited vs optimistic paths
- `src/stores/optimistic-form-store.ts:48-57` — `openDialog` / `closeDialog`, `showKeepOpen`
- `src/components/kosztorys/editor/dialogs/catalogue/save-item-to-catalogue-dialog.tsx:26-54,165` — `PriceList`, overwrite sentence

## Tests affected / to mirror

- **DB action specs** (5435, discovered by `skipIf(!ENV_READY)`):
  - `kosztorys-create-order.test.ts`
  - `kosztorys-lock.test.ts:149-150` (lock matrix: add the new action)
  - `kosztorys-renumber-kosztorys-order.test.ts:96`
  - `lib/kosztorys/display-order.test.ts`

  All of these call add/insert and must be retargeted to the new action.
- **Closest templates:**
  - `catalogue-to-kosztorys.test.ts` (placement order, auto stays null, >65% warning, rollback through a `failNext` mock of the writer)
  - `work-catalogue.test.ts` (matchKey, duplicate refusal)
  - `work-catalogue-save.test.ts` (overwrite keeps id/`created_at`, `keepCatalogueCategory`)
- **DOM:**
  - `work-catalogue-item-form.test.tsx` is the form-spec template.
  - `add-items-from-catalogue-dialog.test.tsx` is the template for a dialog that imports an action.
  - These mock `handleAddItem` or the add/insert actions and must follow the change: `use-kosztorys-itemless-sections.test.tsx:12-23,150-180`, `kosztorys-editor-toolbar.test.tsx:59,86`, `kosztorys-add-menu.test.tsx:17,24`.
  - `section-header-cell.test.tsx:136-159` still passes if the `onAddItem(sectionId)` contract is kept.
- **E2E** `e2e/kosztorys-structure.spec.ts:138-196,277-304,307-345` expects a blank „Nowa praca" row and must fill the dialog instead.

## Architecture Insights

- The seam sits at the callbacks, not at the call sites. `onAddItem` / `onInsertItem` become "open the dialog with a placement", and the cell and menu layer stays untouched (and so does the EX-422 stable-identity plumbing).
- The placement types differ by sort gate:
  - "Next to an anchor" is sort-gated because array position stops mirroring `display_order` under a sort (`orderCommandsEnabled`).
  - "End of sekcja" is not sort-gated.
  - A keep-open chain that started at the end of a sekcja must stay an end-of-sekcja chain under a sort. Without a sort, "end of sekcja" and "under the previous one" are the same slot.
- **Katalog.** It stays advisory: a pozycja stores no katalog reference (commit `3baa7e09`). The katalog write here is a copy, and nothing links the praca to its entry afterwards.

## Historical Context (from prior changes)

- The blank row was a gap, not a decision. The work-item-catalog plan-brief says „Dodaj → Praca" creates an empty row because no single-praca source existed (`git show 44a5c2b5^:context/changes/2026-08-31-work-item-catalog/plan-brief.md`). Per-item autocomplete (FR-006) was cut on 2026-07-28 (`context/foundation/roadmap.md:684-714`).
- `context/foundation/lessons.md:310-315`: every insert affordance is ours end-to-end. dsg's inserted row has no server identity; an item must come back from a server action first.
- add-item-section-picker (commits `d33de2ed`, `831d5c3d`): no preselected sekcja in the toolbar, because a guessed default surprised users. With 0 sekcje, „Praca" creates one first.
- kosztorys-empty-section (commits `1edb9aa0`, `2cee8858`; `context/archive/2026-09-29-kosztorys-empty-section/review-gate.md:25`): a sekcja bez pozycji is legal. The band and the sekcja-menu „Dodaj pracę" are owner-chosen. Not sort-gating „Dodaj pracę" was reviewed and dismissed.
- work-item-catalog: identity is `matchKey = fold(opis)|fold(j.m.)` with UNIQUE, and ADMIN/OWNER/MANAGER may write (the owner rejected a narrower gate). Overwrite updates in place and shows old vs new; the katalog's kategoria is kept by default (commit `7b0f5442`).
- katalog-prac-auto-rates: „auto" is decided per plane, and the ceiling check is silent for „auto".
- Lessons to respect:
  - `lessons.md:1183`: a hidden field still ships. Kategoria must be stripped when the checkbox is off.
  - `lessons.md:1636` and `:1794`: anything feeding `catalogueKey` becomes identity. This change adds no new field to the key, so no backfill is owed.
  - `lessons.md:1709`: a menu gate must read the same predicate as the handler.
  - `lessons.md:1773`: an entity-bound dialog needs an entity-keyed `formId`.
- Test-plan risks touched:
  - #6 (kosztorys mutation gating, `context/foundation/test-plan.md:18`)
  - #17 (a saved write not visible without a reload, `:29`)
  - No risk row covers "add a praca" or the katalog collision directly. `/10x-test-plan` may extend it.
- Manual checks mentioning these entry points:
  - `context/foundation/manual-checks.md:2425-2427` (a „Nowa praca" row appears without F5)
  - `:1008` (the rate kind survives save-to-katalog and comes back through the picker)
  - `:2527-2528` (an optimistic-close bug in `catalogue-item-from-kosztorys-dialog`)

## Related Research

- `context/archive/2026-09-29-kosztorys-empty-section/`
- `context/archive/2026-09-14-kosztorys-section-menu-split/change.md`
- `context/changes/2026-09-30-worker-work-reports/` (EX-947, in flight; `extraAsItem`, extra-work rows)
- `context/reference/kosztorys-editor-domain-notes.md:927-952` (katalog picker matching), `:1738-1765` (sekcja bez pozycji)

## Open Questions

1. **Collision confirm, three outcomes.** Overwrite / kosztorys only / back to the form. Which gesture maps to "kosztorys only"? Escape must not save. This needs a three-button confirm or an explicit radio. Should the kategoria-keep toggle from `SaveItemToCatalogueDialog` appear here when the kategoria differs?
2. **Zero sekcje: create on open or on submit?** The design approved on 2026-09-30 creates the sekcja first, then opens the dialog; abandoning leaves a legal itemless sekcja. Creating on submit leaves nothing behind but needs a "new sekcja" placement in the action. Recommendation: keep the approved behaviour; it reuses `handleAddSection` unchanged.
3. **Keep-open chain under a sort.** A chain started from "end of sekcja" keeps appending at the end, which equals "under the previous one" when no sort is active. A chain started from „Wstaw…" cannot start under a sort, because the command is disabled.
4. **Unfold.** Insert does not unfold a collapsed sekcja today. With a dialog it should, or the saved praca is invisible.
5. **j.m. options.** Static `UNIT_SUGGESTIONS` (katalog form) or merged with the kosztorys's own units (worker report)?
6. **Ceiling warnings.** The server should refuse a negative stawka and return >65% warnings as a toast, the way the katalog picker does.
7. **`showKeepOpen` leak** (`optimistic-form-store.ts:53-57`). `closeDialog` never resets it, so raw-`Dialog` forms show a dead „Nie zamykaj" checkbox after any `FormDialog` was opened. This is adjacent to this change; the new host must call `openDialog(formId, true)`. Fix or file it separately.
8. **Spec retargeting.** One action with a placement union (`{sectionId} | {anchorItemId, dir}`) keeps the lock-matrix and display-order specs retargetable in one place, compared with two new actions.
