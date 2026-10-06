---
date: 2026-10-06T09:27:41+0200
researcher: Claude
git_commit: 19411c01a1e098966c4e469b44b76401bfa3c6e3
branch: staging
repository: wykonczymy
topic: 'kosztorys-ai-knowledge-loop — katalog notes, AI przedmiar review columns, Oferta / Przegląd AI views'
tags:
  [
    research,
    codebase,
    kosztorys,
    work-catalogue,
    column-selection,
    row-conditions,
    client-view,
    tree-writers,
  ]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude
---

# Research: kosztorys-ai-knowledge-loop

**Date**: 2026-10-06T09:27:41+0200
**Researcher**: Claude
**Git Commit**: 19411c01a1e098966c4e469b44b76401bfa3c6e3
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Before planning, check what the design agreed in `change.md` has to pass through: (1) a note on each katalog entry, (2) AI przedmiar + Powód zmiany on kosztorys items, (3) the „Oferta" / „Przegląd AI" column views and the „tylko zmienione" / „bez powodu" row filters. Find every place the new data could be silently dropped or leaked, and the least-new-mechanics home for each part.

## Summary

The design fits existing machinery. Each part needs one or more decisions the change does not record yet:

1. **Katalog note.** The whole katalog already reaches the editor client-side, for kosztorys and szablon alike. Lookup by `matchKey` is a cheap `Map`. Two risks:
   - **Silent wipe.** Overwrite paths build the row from a type derived via `Omit<WorkCatalogueItemT, …>`. Adding the field naïvely makes TypeScript force `notes: null` into every „Zapisz do katalogu (nadpisz)".
   - **Name collision.** On items, `note` already means Komentarz.
2. **AI przedmiar + Powód zmiany.**
   - `changeReason` rides the existing per-field patch path. Undo, save lanes and diff then work with no extra code.
   - `aiPlannedQty` must stay **out** of the grid patch schema so people cannot write it. Someone still has to write it, so the change needs a write: the cheapest is a one-shot „zamroź szkic AI" action (`ai_planned_qty = planned_qty` for the whole investment).
   - 10 writers would silently drop a new item column. Two drift specs catch half of them.
   - The szablon serializer must **strip** both fields.
   - No investor or worker surface leaks: every one of them selects columns by allowlist.
3. **Views and filters.**
   - Writing a view through `setAllColumns` is rejected: it is a dense, global write that breaks the "store the deviation" lesson.
   - A view is a transient **closed column list**, the same mechanism as podgląd, worker and warsztat.
   - No single function answers "what does the investor see now". The logic is split over three call sites (editor preview, column selection, PDF print) and needs one extracted function.
   - The owner's editor does not load the client view settings today.
   - The row filters fit as two `ROW_CONDITIONS` diagnostics. These bring counts, exclusive pick, latch, chip and `revealsColumns` for free. They need a `hasAiDraft` gate, or "added" matches every row of an ordinary kosztorys.

**Corrections to `change.md`:**

- Komentarz is not purely per client. `serialize-preset.ts:6-9` keeps it in szablony („cena zawiera transport" travels). The dialog contrast must be "katalog note = every kosztorys with this praca; Komentarz = this kosztorys (and its szablon)".
- „Oferta" = 5 columns holds only once `offer-hides-remaining` lands.

## Detailed Findings

### 1. Katalog note (Notatka do pracy)

**Schema and readers**

- Collection: `src/collections/work-catalogue-items.ts:27-94`. There is no note field today; `matchKey` is unique (:85-94).
- Template migration: `20261001_0_description_translations.ts:15`. The new step is additive: `ALTER TABLE "work_catalogue_items" ADD COLUMN IF NOT EXISTS "work_note" varchar;`, migrating prod before the push.
- `CATALOGUE_COLUMNS` (`src/lib/db/work-catalogue.ts:17`) is shared by all four SELECTs (:49, :63, :80, :187). Add the column once there, plus `toCatalogueItem` (:21-37) and `WorkCatalogueItemT` (`src/lib/kosztorys/work-catalogue/types.ts:13-25`).
- No raw-SQL writer rebuilds a katalog row:
  - the only INSERT is `ON CONFLICT DO NOTHING` (:136-141);
  - the translation fillers and `fix-kosztorys-descriptions.ts:110` name their own SET columns.
- Cache key `['work-catalogue-v2']` (`src/lib/queries/work-catalogue.ts:20-27`): bump it to `v3` so old cached entries without the field don't survive.

**Wipe hazards. All of these must be covered, or a later save erases the note:**

1. `CatalogueSeedItemT` / `CatalogueCandidateT` derive by `Omit` (`types.ts:30-33`).
   - Add the note to the `Omit`, the same way `descriptionTranslations` is excluded (reason at `types.ts:27-29`).
   - Otherwise `toCatalogueCandidate` (`item-to-catalogue.ts:43-66`) and `catalogueRow` (`write-catalogue-entry.ts:23-33`) must emit `null`, which wipes the note on:
     - overwrite (`work-catalogue.ts:162`);
     - „Nowa praca" + katalog overwrite (`src/lib/actions/kosztorys.ts:546-563`);
     - create.
2. `updateCatalogueItemAction` spreads `...row` (`work-catalogue.ts:88`). If the note is in the /katalog-prac form, the edit dialog must seed it (`edit-catalogue-item-dialog.tsx:33-49`).
3. `CatalogueItemFromKosztorysDialog.defaultsFrom` (`catalogue-item-from-kosztorys-dialog.tsx:25-37`) seeds from the candidate. It must take the note from `existing`.
4. Payload `update` leaves a key absent from `data` untouched; `null`/`''` clears it. A key present but `undefined` was not verified, so keep the key off the object.
   - Simplest safe shape: the note is written by its **own action** (`updateCatalogueNoteAction(catalogueItemId, text)`), never part of the full-row form or the candidate. Hazards 1–3 then disappear by construction.

**The editor already has the katalog**

- Page loads: `kosztorys_v2/page.tsx:65,116` and `szablony/[id]/page.tsx:24-27,35`.
- Hook and context: live prop in `use-kosztorys-editor.ts:190`, exposed on the context at :1410.
- Matching: `buildCatalogueComparison` builds `Map(matchKey → entry)` and probes with `catalogueKey(description, unit)` (`build-catalogue-comparison.ts:158-182`). It does not export the per-row entry. A „Notatka do pracy" column needs a `rowId → note` map built the same way, passed through `columnData`/opts and not context: the EX-496 churn rule.
- Freshness: a note save revalidates `workCatalogue` via `updateTag` (`src/lib/cache/revalidate.ts:15-35`), so the editor gets the new prop.

**Row action**

- „Zapisz do katalogu" lives at `grid/menus/kosztorys-row-actions-menu.tsx:75-80`, gated by `canSaveItemToCatalogue` (`kosztorys-v2-column-opts.ts:86-89`, set `editorOnly(true)` at `use-kosztorys-editor.ts:606`).
- New action pattern: a flag on `item`, a `DropdownMenuItem`, and a `useState` open flag; the dialog is mounted only while open.
- The szablon editor gets it too: no lock (`szablony/[id]/page.tsx:30-45`).
- With no katalog match, the dialog offers the existing save flow first.

**/katalog-prac**

- Table columns: `src/components/tables/work-catalogue.tsx:269-304`. Default visibility: `WORK_CATALOGUE_DEFAULT_VISIBILITY` (:157-159).
- Search: `description` + `category` only (`work-catalogue-data-table.tsx:53`).
- Option: a „bez notatki"/„z notatką" condition in `catalogue-conditions.ts:41-108`.
- Shared-schema trap: `newItemFormSchema` extends the katalog base schema (`new-item/new-item-form-schema.ts:11-13`), so a form field leaks into „Nowa praca" unless `.omit`-ted. Another reason for a dedicated note action and dialog.

**Translations and access**

- Translation is hard-wired to `description` (`src/lib/ai/translate-new-row.ts:13-44`, `fill-description-translations.ts`), so a note is never auto-translated.
- Access is MANAGEMENT only: the collection (`work-catalogue-items.ts:20-25`), actions via `protectedAction`, and the page via `ADMIN_OR_OWNER_MANAGER_ROLES`. EMPLOYEE never reaches it.

### 2. AI przedmiar + Powód zmiany on kosztorys items

**Template:** `ref` (commit 434a1e76, migration `20261005_5_add_kosztorys_item_ref.ts`) walked the full path most recently. Copy its diff.

**Schema**

- Migration: `ai_planned_qty numeric NULL`, `change_reason varchar NULL` (as `note`, `20260708_2_…:42`). Register it in `src/migrations/index.ts`.
- `changeReason`: Payload `text` field. `updateItemFieldAction` writes through `payload.update` (`src/lib/actions/kosztorys.ts:137`).
- `aiPlannedQty`: write protection.
  - `admin.readOnly` (the `sheetMeasuredQty` precedent, `kosztorys-items.ts:47`) does not block REST writes.
  - Options: raw-SQL only, like `ref`; or field-level `access.update`.

**Read and write path. `[DROP]` = silently loses the column if not updated:**

- `[DROP]` Tree SELECT: `src/lib/db/kosztorys-tree.ts:70-75`.
  - `mapItem` (:151-175) uses `numOrNull` for `aiPlannedQty`: NULL = no AI draft, 0 = AI removed it.
  - The drift spec `kosztorys-tree-sql-drift.test.ts` catches mapper-without-SELECT only.
- `KosztorysItemT` (`src/lib/kosztorys/types.ts:35-66`): make both fields **required** (`T | null`) so tsc lists every item builder.
- `[DROP]` Bulk INSERT: `ITEM_INSERT_COLUMNS` (`insert-rows.ts:21-39`) **and** the VALUES tuple (:127) with `?? null`. The `sql` tag emits nothing for `undefined`, which shifts placeholders.
  - `insert-schema-drift.test.ts:42-63` (DB-backed, `test:integration`) goes red on a migration without a list update.
  - Tuple alignment is guarded only by `serialize-restore-roundtrip.test.ts`. Extend it.
- `[DROP]` Snapshot tolerant read: add both fields to the TolerantT list (`snapshot-format.ts:110-130`) and to `itemWithColumnDefaults` (:160-179) with `?? null`.
  - No `SNAPSHOT_SCHEMA_VERSION` bump: an additive nullable column, per the rules at :14-38.
  - `serializeTree` spreads the item, so capture is automatic.
- Restore / clear-and-replace: `restore-kosztorys.ts:35-38`, `replace-tree-with-snapshot.ts:74-86`. These **keep** both fields once the above lands.
- **Szablon: STRIP both** in `serialize-preset.ts:15-40`, beside the zeroed `plannedQty` / `sheetMeasuredQty` / `ref`.
  - It is the single funnel for seed, reload, append and save-as-szablon (`seed-from-preset.ts:35`, `reload-from-preset.ts:27`, `actions/kosztorys-presets.ts:85,107,202`, `append-preset-sections.ts:35-74`).
  - Extend `serialize-apply-preset.test.ts`. Test-plan risk #13.
- `[DROP]` Sheet import: `sheet-import/build-import-plan.ts:218-245` carries `note`/`ref` for matched rows (:234).
  - Carry both new fields too. The import goes through `replaceTreeWithSnapshot` (`actions/kosztorys-import.ts:319`), so anything not carried is wiped.
  - New rows in `parse-labor-tab.ts:180-195`: set `null`.
- `[DROP]` Code-built items set `null`:
  - `item-from-fields.ts:22-43` (`addItemAction`, katalog);
  - `accept-worker-report.ts:383-404`. A worker extra is "added": AI null.
  - `item-to-catalogue.ts:22,30`.
- History diff (`history/diff-versions.ts:27-33,138-142`) diffs only Przedmiar, price, etapy and add/remove. Nothing to change.

**Grid save path**

- `changeReason`: add it to `item-patch-schema.ts:12-34`, `ITEM_FIELDS` (`v2-rows.ts:6-19`) and `ItemPatchT`. Then `diffRow`, `grid-change-plan.ts`, save lanes (`save-lanes.ts:17`) and undo/redo (`undo-coalesce.ts:12`, `undo-reversal.ts:49`) work unchanged.
- `aiPlannedQty`: keep it **out** of all three. zod drops unknown keys, so the grid cannot write it.

**Grid columns** (`src/lib/kosztorys/columns/column-config.ts`)

- `COLUMN_LABELS` :18-49.
- `[DROP from view]` `LAYER_NEUTRAL_COLUMNS` :173-186 (`note` at :185). Without it, both columns vanish in the „Postęp" layer (`kosztorys-layer.test.ts:79`).
- `DEFAULT_HIDDEN_COLUMNS` :230-236, so they only appear in „Przegląd AI" or when ticked.
- No `COLUMN_MONEY_AXIS` entry: not money. Check `PRZEDMIAR_ANCHORED_COLUMNS` :123 for `aiPlannedQty`.

**Column definitions** (`kosztorys-v2-columns.tsx`)

- Powód zmiany: copy the Komentarz column (:320-329: `keyCol` + `longTextColumn` + `wrapColumnClass`). Add it to `WRAPPING_COLUMN_IDS` (`row-content-lines.ts:12-24`, which has a literal-union cast at :24).
- AI przedmiar: read-only `computedColumn` like :252-265. If it goes through `computedColumnValues`, add it to `byField` (`column-values.ts:66-79`); that function throws on an unknown id.
- Insert both into the `dataColumns` order (:357-375).

**Disclosure: no leak**

- Every investor and worker surface selects by allowlist:
  - podgląd and share link: `column-selection.ts:73,84` with `client-view/columns.ts:16-60`, plus the sanitizer (`settings.ts:55-79`);
  - PDF offer: `print/offer-columns.ts:5-7,109`;
  - worker: `worker-view/columns.ts:17-45`, `print/worker-columns.ts:18`;
  - the acceptance protocol reads no free-text item field.
- The share and worker payloads ship the full tree. This is accepted by the owner and is how `note` already behaves.
- The comment at `client-view/columns.ts:27-28` claiming the DTO drops `note` is stale.

**Delete vs Przedmiar 0**

- `removeItemAction` (`actions/kosztorys.ts:582-596`) deletes the row and cascades `stage_progress`, so the trace is lost. Removal must stay Przedmiar 0.
- A Przedmiar-0 row with no etapy is already hidden from the investor (`hideEmptyRows`, `client-view/settings.ts:40`, via the `client-empty` condition).
- It matches `no-planned-qty` / `empty-both-axes` (`row-conditions/registry.ts:112-125,156`), but not `work-without-planned-qty` (:470-477).

**Out of the blast radius**

- Owner's sheet: item columns are never written; `APP_MANAGED_TABS` = only the three transfer/expense tabs (`src/lib/google/app-managed-tabs.ts:23`).
- Golden master: hashes an explicit `ROW(...)` (`financial-golden-master-db.test.ts:171-221`).
- Render parity: hashes no item columns.

**Fixture churn:** about 23 specs build `KosztorysItemT`. Update the shared builders first:

- `src/__tests__/helpers/kosztorys-tree.ts`
- `row-conditions/fixtures.ts`
- `fixtures/subcontractor-pricing-row.ts`

### 3. „Oferta" / „Przegląd AI" column views

**Today**

- The hidden map is **global**, not per investment (`use-hidden-columns.ts:16`) and sparse (:28-30).
- `setAllColumns` writes an explicit boolean for every id (:43-45). Applying a view through it overwrites the user's ticks in every kosztorys and cannot express data-dependent gating. Rejected per `context/foundation/lessons.md:1303`.
- `closedColumnList` (`grid/column-selection.ts:72-79`) is the existing named-view mechanism, used for `previewVisible`, `workerSurface` and `workshopVisible` (`workshop-columns.ts:32-41`).
  - Under a closed list, `keep` = `closed.has(key) && !documentHidden…` and skips all preference gates (:124).
  - The picker is `[]` (:158); stored order is skipped (:199).

**No single "investor sees" function.** The logic is split three ways:

- A. `use-kosztorys-editor.ts:557-566`, preview only: `clientView.hiddenColumns ∪ emptySettlementColumnIds(rows, stages, filledStageIds)`.
- B. `column-selection.ts:72-89,108-124`: ceiling `PREVIEW_VISIBLE_COLUMNS`, minus A, `bypassedByGlobalDiscount`, `clientDocumentColumns(ranks)` order.
- C. `print/offer.ts:46-51` with `print/offer-columns.ts:87-110`: the same steps again; it doesn't pass `filledStageIds`.
- Extract one pure function in `src/lib/kosztorys/client-view/` (ceiling, stored hidden, settlement-empty, discount bypass, order).
  - It must answer per **full id**: settlement gating drops single etapy.
  - A, B and C all switch to it, which also removes the existing duplication.

**Settings are not in the owner's editor**

- `ArgsT.clientView` is "only consumed under preview" (`use-kosztorys-editor.ts:141-142`). The owner page doesn't fetch it (`kosztorys_v2/page.tsx:69-120`).
- The only owner-side copy is a lazy read inside `KosztorysActionsProvider` (`actions/investor-actions.tsx:54-66`), below the hook.
- Fix: add `getClientViewSettings(investmentId)` (`src/lib/queries/kosztorys-client-view.ts:58-76`) to the page's `Promise.all`. Keep it in editor-level state; the settings dialog's `onSaved` (`kosztorys-client-view-dialog.tsx:43`) updates it.
- Passing it outside preview is inert today: every reader is gated on `preview`. Re-check those readers anyway.

**Price plane**

- Settlement columns (`net`, `remaining`, `stageValueNet_*`) compute at the active price view (`column-selection.ts:42-53`).
- „Oferta" and „Przegląd AI" pin the plane to `client` as a derived overlay, like `problemPlane` (`use-kosztorys-view-state.ts:59-60,71-73`). They never write `kosztorys-view:<id>` and hide the price toggle while active.
- **Not** `preview`/`previewVisible`: those are audience flags (`lessons.md:470-483`). Owner-only chrome stays visible: the actions column, alarms, reconciliation.

**Placement**

- A Moje / Oferta / Przegląd AI section at the top of `KosztorysViewMenu`'s `sections` slot (`toolbar/kosztorys-view-menu.tsx:116-150`), with a `usePersistedEnum` defaulting to Moje.
- `actions` goes into both closed lists, as warsztat does (`workshop-columns.ts:29-31`).
- The hidden-count badge reads `columnToggleItems` (`kosztorys-view-menu.tsx:90-92`), which is `[]` under a closed list. Adjust it.
- Do not carry `hideEmptyRows` into these views. A removed position (Przedmiar 0, no etapy) would vanish from „Przegląd AI".

### 4. Row filters „tylko zmienione" / „bez powodu"

- Pipeline: `buildViewRows` (`src/lib/kosztorys/row-view.ts:88-130`), search → `applyRowConditions` → sort.
- Registry shape: `row-conditions/types.ts:37-101`. `kind: 'filter'` (pairs, AND, needs `filterGroup`) vs `'diagnostic'` (engaged = keep only matches, union, counted in „Problemy").
- Recommended: two **diagnostics** under a new `PROBLEM_GROUPS` entry „Przegląd AI" (`src/lib/kosztorys/problem-groups.ts:13-28`).
  - Precedent for "work to look through, not a defect": `divergent-client-price` and the katalog entries (`registry.ts:412-455`).
  - Pattern: `work-without-planned-qty` (:470-477) with `revealsColumns`.
  - Diagnostics latch (`use-condition-row-latch.ts:27-42`): typing the first letter of Powód zmiany does not make the row jump out of „bez powodu". „Odśwież — ukryj poprawione" clears the latch.
  - Diagnostics don't need EX-665's complementary pairs. That rule binds `kind: 'filter'` (`kosztorys-editor-domain-notes.md:1380-1400`).
- **Required gate:** "added" = AI null + Przedmiar > 0, which matches every row of a kosztorys the agent never drafted.
  - Add `hasAiDraft` to `RowConditionCtxT` (`types.ts:5-35`), built beside `conditionCtx` (`use-kosztorys-editor.ts:486-495`); absent = no counter (precedent `catalogueRowIds`, `types.ts:27-34`).
  - `hasAiDraft` = any item in the investment has `aiPlannedQty !== null`.
- The row status (unchanged / changed / added / removed) as a pure function in `src/lib/kosztorys/`. Both diagnostics and any status cell read it.

## Code References

- `src/lib/db/work-catalogue.ts:17,21-37` — `CATALOGUE_COLUMNS` + `toCatalogueItem`
- `src/lib/kosztorys/work-catalogue/types.ts:13-33` — `WorkCatalogueItemT` and the `Omit`-derived seed/candidate types (wipe trap)
- `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts:23-33,77-90` — `catalogueRow`, overwrite
- `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx:75-80` — row-action pattern
- `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:158-182` — matchKey lookup to reuse
- `src/lib/db/kosztorys-tree.ts:70-75,151-175` — tree SELECT + `mapItem`
- `src/lib/kosztorys/insert-rows.ts:21-39,127` — the one item INSERT
- `src/lib/kosztorys/snapshot-format.ts:110-130,160-179` — tolerant read + defaults
- `src/lib/kosztorys/serialize-preset.ts:6-40` — szablon strip (and Komentarz travels)
- `src/lib/kosztorys/sheet-import/build-import-plan.ts:218-245` — import carry-over
- `src/lib/kosztorys/item-patch-schema.ts:12-34`, `src/lib/kosztorys/v2-rows.ts:6-19` — grid-writable fields
- `src/lib/kosztorys/columns/column-config.ts:18-49,173-186,230-236` — labels, layer-neutral, default hidden
- `src/components/kosztorys/editor/grid/column-selection.ts:72-145` — closed lists, `keep`
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:141-142,557-566` — clientView preview-only, document-hidden set
- `src/lib/kosztorys/print/offer.ts:46-51` — third copy of the investor-column rule
- `src/lib/queries/kosztorys-client-view.ts:58-76` — settings resolver
- `src/lib/kosztorys/settlement-columns.ts:4-8,27-44` — settlement gating
- `src/lib/kosztorys/row-conditions/registry.ts:470-477`, `types.ts:5-101` — diagnostic shape
- `src/lib/actions/kosztorys.ts:127-143,582-596` — `updateItemFieldAction`, `removeItemAction`

## Architecture Insights

- **Allowlist disclosure carries the safety.** Every investor and worker surface is a closed list. A new internal column is safe by default, and the only way to leak it is to edit an allowlist.
- **`insertItems` is the single item funnel; `serialize-preset` is the single szablon funnel.** A new item column is one decision at each funnel (carry vs strip), plus the tolerant snapshot read and the import plan.
- **A view is a closed list, not a stored preference.** `closedColumnList` already carries "exactly these columns, ignore picks" three times; a fourth instance is no new mechanism.
- **"Derived, not stored" is the house style.** Row status, like the history diff (EX-881) and settlement gating, is computed on read.
- **Note on its own write lane.** A dedicated note action avoids every full-row overwrite hazard in the katalog. This is the same reason `descriptionTranslations` is excluded from candidates.

## Historical Context (from prior changes)

- `context/archive/2026-08-31-legacy-sheet-work-import/change.md:30-32,58-60`, `context/foundation/lessons.md:1638-1643` — text appended to `description` is welded into `catalogueKey` (EX-753). Notes need their own column, never the opis.
- `context/archive/2026-10-01-kosztorys-item-catalogue-link/change.md:22-27` — an FK from position to katalog entry was rejected twice; identity stays opis + j.m. until EX-780. The note's opis-rewrite limit is accepted by that decision.
- `context/reference/kosztorys-editor-domain-notes.md:915-964` — versions and diff (EX-881) match rows by id, then sekcja + opis + j.m.
- `context/reference/kosztorys-editor-domain-notes.md:966-971` — clearing a numeric cell writes 0, consistent with "removal = Przedmiar 0".
- `context/reference/kosztorys-editor-domain-notes.md:306-372`, `src/lib/kosztorys/client-view/columns.ts:14-60` — client allowlist rulings (2026-09-28): no brutto, owner-set order.
- `context/changes/2026-10-06-offer-hides-remaining/change.md` — „Pozostało" settlement-gated; prerequisite for „Oferta" = 5 columns.
- `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md:160-166` — the warning about the prod `addItemAction` signature is **stale**.
  - `origin/main` now has `addItemAction({placement, data, catalogue, translate?})` (`src/lib/actions/kosztorys.ts:464-476`, commit fbd8624c), so `fill-case-prod.ts:88` would fail.
  - Read the signatures from `origin/main` before the next prod fill.
- `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md:225-237` — nullable `client_price` (owner: a missing price must be unmistakable) is a separate open item, not in this change.
- Related Linear ids:
  - EX-892 — in-app agent, parked
  - EX-992 — AI translations
  - EX-949 — kartka → AI
  - EX-548 — glossary; add the new terms there
  - EX-665 — filter pairs
  - EX-780 — FK link prerequisite

  No Linear id exists yet for this change.

## Related Research

- `context/changes/2026-10-01-ai-kosztorys-generation-tests/` — the experiment this change serves (case 1, owner comparison).

## Design drift after this research (2026-10-06)

`change.md` moved on after this document was written: the row status is now the manager's **stored
select** (Zaakceptowana / Odrzucona / Edytowana / Dodana, empty = „do sprawdzenia"), not a derived
value, and the filters are „do sprawdzenia" / „bez powodu". Consequences for the findings above:

- The status is a third new item column (an enum, nullable). It follows the same path as
  `changeReason` (§2): patch schema + `ITEM_FIELDS`, tree SELECT/mapper, `insertItems`, snapshot
  tolerant read, sheet-import carry-over, szablon **strip**.
- „Zaakceptuj" writes Przedmiar and the status together — one concept in two columns. Check the
  per-field save lanes and undo (`lessons.md` "one concept in two columns") so one undo restores both.
- §4 still holds: two `ROW_CONDITIONS` diagnostics with the latch; the `hasAiDraft` gate is now
  implicit in „AI przedmiar > 0".

## Open Questions

1. ~~**Who writes AI przedmiar, and how?**~~ Resolved 2026-10-06: the agent writes only AI przedmiar,
   the manager types every Przedmiar; no freeze action (see `change.md`). Original question kept below. `change.md` lists "an agent write path" as out of scope, yet the column must be written once and must not be grid-writable.
   - Recommendation: a one-shot ADMIN/OWNER action „Zamroź szkic AI" (`UPDATE kosztorys_items SET ai_planned_qty = planned_qty WHERE investment_id = $1`, plus auto-snapshot and revalidation).
   - The agent calls it after filling, and it needs no agent-side change.
   - Should it refuse a second run (`ai_planned_qty` already set)?
2. **Identifier names.** Suggestions to add to the glossary (EX-548):
   - `aiPlannedQty` / `ai_planned_qty`;
   - `changeReason` / `change_reason`;
   - `workNote` / `work_note` on `work_catalogue_items`. Not `note`/`notes`: `note` is Komentarz on items. "One concept, one name" applies in reverse: two concepts must not share one.
3. **Komentarz vs note in the dialog copy.** Komentarz travels into szablony (`serialize-preset.ts:6-9`), so "per client" is inaccurate. Fix the wording in `change.md` and the dialog.
4. ~~**„Przegląd AI" status column.**~~ Resolved 2026-10-06: a visible read-only Status column plus the two filters (see `change.md`).
5. **Settings freshness for „Oferta".** The view reads per-investment client settings loaded with the page. Is an update via the settings dialog's `onSaved` enough, or should a save from the share-link side also refresh it? Probably moot: one owner edits both.
6. **Prod-fill script drift.** `fill-case-prod.ts` must be updated to the current `addItemAction` shape before the next case. That belongs to the experiment change, not this one.
