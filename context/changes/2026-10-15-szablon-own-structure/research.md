---
date: 2026-10-15T16:44:57+02:00
researcher: Claude
git_commit: f8bc0a26d
branch: staging
repository: wykonczymy
topic: 'Szablon as its own data structure (separate tables) vs fallback B (blanked copy columns in kosztorys_items)'
tags: [research, kosztorys, szablon, work-catalogue, snapshots, schema]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude
---

# Research: szablon as its own data structure vs fallback B

**Date**: 2026-10-15T16:44:57+02:00
**Git Commit**: f8bc0a26d (staging)

## Research Question

Today a szablon is an `investments` row with status `szablon` (EX-893). Its pozycje live in
`kosztorys_items`, and since EX-1017 they are meant to be only "katalog entry + sekcja + kolejność",
but every row still carries a dead copy of opis / j.m. / cena / stawki / mnożniki / tłumaczenia.
Should we go straight to the proper model — dedicated szablon tables with no room for a copy — with
no intermediate step? Compare with fallback B: keep the rows in `kosztorys_items` and blank the copy.

## Summary

- **Separate tables: L overall.** About 25 paths change, ~10 of them M/L. The schema and data
  migration are cheap (S). The cost sits in the shared machinery the szablon editor reuses today:
  the tree read, every insert path, snapshots/restore, the `investmentAction` gate keyed on
  `kosztorys_items` ids, display-order helpers, localStorage keys, and the REST collection the AI
  scripts read. About 20 actions need twins or a branch; 38 editor files import actions directly.
- **B: S–M overall.** About 12 paths change, nearly all S. Blank the copy at one choke point
  (`insertItems`) when the host is a szablon and the row is live-linked; fix the raw readers. Its
  weakness is that nothing in the database enforces it: szablon and kosztorys rows share a table, and
  a CHECK cannot read the host's status.
- **Two live bugs exist under both models and are independent of the choice** (see "Live hazards").
  They should be fixed first either way.
- **EX-893's lesson does not argue against separate tables.** The pre-EX-893 bugs came from the
  pointer / shared-workshop design (a workshop id that changed meaning over time), not from having a
  separate structure. The older jsonb structure had its own costs (a mirror, lag, schema-version
  brittleness), but a relational `template_items` table with a real FK to the katalog is none of those.
- `lessons.md:954` ("Implementation that drifted from a settled decision gets the schema cleaned, not
  the dead columns parked") supports removing the copy rather than living with it.

## Live hazards (fix regardless of model)

Status 2026-10-15: both handled. Hazard 1: the menu item is hidden in a szablon. Hazard 2: the 47
unlinked versions are deleted on prod. See `change.md`. Decision: separate tables; B is rejected.

1. **„Aktualizuj pozycję w katalogu prac" in a szablon pushes the stale copy over the katalog.**
   `getCatalogueSourceItem` (`src/lib/db/work-catalogue.ts:188-215`) reads `ki.description`,
   `ki.client_price`, the overrides etc. straight from `kosztorys_items`, with no katalog join.
   It feeds `catalogueSaveState` (`src/lib/queries/work-catalogue.ts:33`) and
   `saveItemToCatalogueAction` (`src/lib/actions/work-catalogue.ts:177`). The menu item is enabled in
   a szablon (`use-kosztorys-editor.ts:617`, `kosztorys-row-actions-menu.tsx:58-63`), and the
   „Zapisz jako szablon" dialog even points the user to it for changing prices
   (`save-preset-dialog.tsx:16`). Prod has 3 opis/j.m. drifts and 1 price drift on the live szablon,
   so the action would currently propose reverting those katalog edits.
2. **Restoring a pre-EX-1017 „Wersja" of a szablon makes the stale copy live again.** Szablon
   snapshot restore does not apply `keepCataloguedItems` (`kosztorys-snapshots.ts:92`). 47 of the 50
   snapshots of „Kosztorys 2026 kolory" predate EX-1017 and carry no `catalogueItemId`, so a restore
   inserts 302 unlinked rows whose copy then renders and counts. A dead katalog id is nulled on
   restore too (`insert-kosztorys-tree.ts:74-77`), with the same effect. Conversely, restoring a
   szablon version cannot bring back old prices: the overlay re-applies current katalog values.

## Detailed Findings

### How the copy is read and written today

- Read: `selectKosztorysTreeData` (`src/lib/db/kosztorys-tree.ts:89-92`) LEFT JOINs
  `work_catalogue_items ON w.id = ki.catalogue_item_id AND host.status = 'szablon'`;
  `withCatalogueFields` (`src/lib/kosztorys/item-from-fields.ts:37`) overlays katalog values and falls
  back to the copy for unlinked or dead-id rows.
- Write (cell edit): `updateItemFieldAction` (`src/lib/actions/kosztorys.ts:137`) →
  `updateLinkedTemplateRow` (:160-195) → `splitTemplatePatch`
  (`work-catalogue/template-catalogue-patch.ts:9-33`). Katalog fields go to the katalog; only the row
  patch reaches `kosztorys_items`, so the copy is not updated. Unlinked rows fall through to a plain
  `kosztorys-items` update, which does write the copy.
- No katalog writer touches szablon rows (`applyCatalogueWrite`, `updateCatalogueItemAction`,
  `fillCatalogueTranslations` + the EX-1065 cron, …). Only insert-time paths write a copy
  (`addItemAction`, `placeCatalogueItems`, `applyPreset`, `appendPresetSections`, restore), so the copy
  is frozen at row creation. `deleteCatalogueItemAction` deletes szablon rows via
  `deleteTemplateRowsOfCatalogueItem` (`src/lib/db/presets.ts:147`).

### Raw readers of the copy (bypass the join)

| #   | Path                                                                                                                                                                    | Today                                                                      | Under B                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| R1  | `getCatalogueSourceItem` → „Aktualizuj pozycję w katalogu prac"                                                                                                         | live bug (hazard 1)                                                        | pushes NULL/0 unless fixed to read the katalog |
| R2  | `getUnlinkedItemTexts` (`kosztorys-item-texts.ts:40-51`) via `fillKosztorysTranslationsAction`                                                                          | correct: unlinked rows only                                                | unchanged                                      |
| R3  | mapper fallback in `withCatalogueFields`                                                                                                                                | renders copy for unlinked/dead-id rows                                     | a blanked row whose entry dies renders empty   |
| R4  | AI scripts over REST `/api/kosztorys-items` (`prod-client.ts` `itemsOf` / `itemsOfTemplate`; `adopt-case-prod.ts:62`, `fill-case-prod.ts:72`, `new-case-prod.ts:68/99`) | stale; `itemsOfTemplate` overlays only description/unit, not `clientPrice` | prints 0/empty unless switched to the katalog  |
| R6  | one-offs `sync-template-translations.ts`, `link-kosztorys-items-to-catalogue.ts`                                                                                        | —                                                                          | purpose ends; delete                           |

Paths verified **not** to read the copy: duplicate checks (`findCatalogueItemByKey`, on the katalog),
usage counter (`catalogue-usage.ts:16-25` excludes szablony), catalogue comparison, sheet import
(hidden for szablony), worker reports (refused, `share-refusal.ts:7`), the AI case loader
(`create-case-local.ts:47`, uses the join).

### Option (a): separate tables

Sketch: `templates`, `template_sections`, `template_items(section_id, catalogue_item_id NOT NULL
REFERENCES work_catalogue_items ON DELETE CASCADE, display_order)` as raw tables (like snapshots).

Gains:

- The copy cannot exist: there is no column for it. The DB enforces "szablon = katalog refs".
- The real FK replaces `deleteTemplateRowsOfCatalogueItem` and makes dead ids impossible, which
  removes both restore hazards' root cause.
- The `status <> 'szablon'` exclusion filters can go: `guardTemplateStatus`, `reference-data.ts:85`,
  `worker-payout-pairs.ts:30`, `catalogue-usage.ts:21`, `snapshots.ts:84`,
  `PICKABLE_INVESTMENT_STATUSES`. Every future investment query stops needing to remember szablony.

Costs, by area:

- **Read side (M):** `selectKosztorysTreeData` gets a second query or branch; a ~40-line mapper from
  szablon rows to `KosztorysTreeT` keeps the editor's read path intact.
- **Write side (L) — the blocker.** Editor actions take bare `kosztorys_items` / `kosztorys_sections`
  ids, and the gate resolves the owner through `TABLE_BY_KIND` / `investmentGateForRow`
  (`src/lib/actions/investment-action.ts:66`). About 20 actions (add/insert/remove/rename/colour
  section, remove item, renumber, layout, percent discount, clear, cell edit) need twins or a branch.
  Suggested route: inject an actions object through context so the shared editor calls the right set.
  Two id spaces in one editor also need care (localStorage keys and snapshots are keyed by
  investmentId and would collide).
- **Snapshots (M):** own store or a new payload shape; the 56 existing szablon snapshots (one named)
  get converted or deleted.
- **Kosz (M):** `investment-trash.ts` KOSZTORYS_USED, purge cascade, restore all assume the investment
  row; a template needs its own trash entry, or keeps an investments row only as a trash/name holder.
- **Insert paths (M each):** `createTemplate` / `applyPreset`, overwrite via `replaceTreeWithSnapshot`,
  `appendPresetSections` (source read + target branch), `reloadInvestmentFromPreset`,
  `seedInvestmentFromPreset` (read side only, S), `placeCatalogueItems`, `addItemAction`.
- **REST (M):** the AI scripts need a new endpoint or read the katalog directly.
- **Tests:** ~18 storage-coupled specs, ~13 `isTemplate` UI specs, 3 E2E specs.
- **Leftovers:** the `szablon` enum value cannot be dropped from a Postgres enum cheaply; the unique
  name index `investments_szablon_name_idx` moves to `templates`.

### Option (b): blanked copy

- Blank at `insertItems` (`src/lib/db/insert-rows.ts:128`) when the host is a szablon **and** the row
  is live-linked. Unlinked rows (incl. ones whose entry died before a restore) must keep their copy.
- NOT NULL copy columns: only `client_price` (default 0) and `description_translations` (default
  `'{}'`). Either blank to 0 / `'{}'` with no DDL, or make `client_price` nullable (migration +
  collection change, S). `description` and `unit` are already nullable.
- Fix R1 (read the katalog for linked rows), switch R4 to the katalog, exclude szablony from the bulk
  scripts (`fix-kosztorys-descriptions.ts`, `fill-description-translations.ts`,
  `fill-translations-from-catalogue.ts`) or they refill the blanks.
- Apply `keepCataloguedItems` on szablon restore (hazard 2).
- The unlinked-row fall-through of `updateItemFieldAction` loses most of its purpose.
- Enforcement is by convention only. A trigger on `kosztorys_items` that checks the host status could
  enforce it in the DB; not evaluated.

### Data migration facts (prod, read-only, 2026-10-15)

- Live „Kosztorys 2026 kolory": 302 items, 11 sections, all linked, 301 distinct katalog entries,
  0 dead ids; 50 snapshots (2.0 MB, only 3 carry `catalogueItemId`).
- Trashed „Kosztorys 2026": 310 items, **all unlinked** — its whole content is the copy; 6 snapshots;
  auto-purges around 2026-11-07. Under (a) it cannot migrate to a NOT NULL FK: purge it, or link it
  first. Under (b) it keeps its copy.
- No FKs from other tables point at either szablon's rows.

## Code References

- `src/lib/db/kosztorys-tree.ts:56-95` — tree read, szablon-only katalog join at :89-92
- `src/lib/kosztorys/item-from-fields.ts:37` — `withCatalogueFields` overlay + copy fallback
- `src/lib/actions/kosztorys.ts:137-195` — cell edit, `updateLinkedTemplateRow`
- `src/lib/db/work-catalogue.ts:188-215` — `getCatalogueSourceItem` (hazard 1)
- `src/lib/actions/work-catalogue.ts:177` — `saveItemToCatalogueAction`
- `src/lib/actions/kosztorys-snapshots.ts:92` — szablon restore without `keepCataloguedItems`
- `src/lib/kosztorys/insert-kosztorys-tree.ts:58-77` — `withLiveCatalogueId` nulls dead ids
- `src/lib/actions/kosztorys-presets.ts:64-70` — `cataloguedPresetTree` (applied on save, not restore)
- `src/lib/db/insert-rows.ts:128` — `insertItems`, B's choke point
- `src/lib/actions/investment-action.ts:66` — `investmentGateForRow` / `TABLE_BY_KIND`, (a)'s blocker
- `src/lib/db/presets.ts:147` — `deleteTemplateRowsOfCatalogueItem` (an FK would replace it)

## Architecture Insights

- The szablon reuses the kosztorys editor wholesale by being an investment. That reuse is what makes
  (a) expensive: the identity "a szablon row is a kosztorys row" runs through ids, the gate and
  storage keys, not just through the schema.
- EX-1017 chose a read-through overlay ("nothing can drift") and kept the copy columns. Nobody wrote
  down that those columns became dead; the copy is the residue of that decision.
- (a) moves the invariant into the schema; (b) keeps it in application code at one choke point plus
  a list of raw readers that must remember it.

## Historical Context

- EX-893 (2026-09-29, migrations 20260929_1/\_2): szablon became an investment with status `szablon`.
  It replaced a pointer/shared-workshop design whose bugs came from the workshop id changing meaning
  over time. The earlier jsonb structure had a mirror, lag and schema-version brittleness.
- EX-1017 (2026-10-07/08, `context/archive/2026-10-07-template-from-catalogue/change.md`): szablon =
  "lista wpisów katalogu w sekcjach, w kolejności. Bez własnej treści i cen." A dedicated
  szablon-items table was never discussed.
- `context/foundation/lessons.md:954` — clean the schema rather than park dead columns.

## Open Questions

- Under (a): does the template keep an `investments` row (for the trash, the unique name, the
  editor's investmentId keys), or does it get its own trash entry? This decides most of the kosz and
  storage cost.
- The trashed „Kosztorys 2026": let it purge on ~2026-11-07 before migrating, or link it first?
- The 56 szablon snapshots under (a): convert to the new shape, or delete all but the named one?
- Under (b): is a DB trigger worth it to make the blank copy enforceable?
