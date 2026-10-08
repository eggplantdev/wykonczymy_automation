---
date: 2026-10-08T10:50:00+02:00
researcher: Claude (Opus 5.5)
git_commit: 78752fbbd
branch: staging
repository: wykonczymy
topic: 'EX-1017 — szablon as a list of katalog prac entries; content and prices only in the katalog'
tags: [research, kosztorys, szablon, presets, work-catalogue, snapshots]
status: complete
last_updated: 2026-10-08
last_updated_by: Claude (Opus 5.5)
---

# Research: szablon as a list of katalog prac entries (EX-1017)

**Date**: 2026-10-08T10:50:00+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 78752fbbd
**Branch**: staging
**Repository**: wykonczymy

## Research Question

`change.md` → „Ustalony model": a szablon becomes a list of katalog entries in sekcje and order; opis,
j.m., Cena j.m., stawki and tłumaczenia live only in the katalog; an edit in the szablon reaches the
katalog (and every szablon with that praca) at once; changing/deleting a katalog entry used in a
szablon warns; a kosztorys founded from a szablon stays an independent copy that remembers its katalog
entry; „Zapisz pozycję do katalogu prac" becomes „Aktualizuj pozycję w katalogu prac" keyed by that
remembered entry. What does the codebase have to change, and what is still undecided?

## Summary

- **No pozycja knows its katalog entry today.** `kosztorys_items` has no katalog column (no migration,
  no collection field, no `lib/db` query). Every pozycja ↔ katalog link is the folded text key
  `catalogueKey(opis, j.m.)` against the UNIQUE `work_catalogue_items.match_key` — 11 call sites
  (list under „Key-based matching"). The only real FK into the katalog is
  `worker_report_lines.catalogue_item_id` (audit of a manager's swap, unindexed).
- **`change.md` pkt 7 is wrong on one claim.** „Unikalne id już identyfikuje tłumaczenia przy
  zgłaszaniu pracy" — refuted. A worker report addresses a pozycja by `kosztorys_items.id` (or `ref`
  on paper) and reads tłumaczenia from the pozycja's own copy
  (`src/lib/db/worker-reports.ts:345-351`); `worker_report_lines.catalogue_item_id` is read only by the
  review dialog draft (`src/lib/kosztorys/worker-report/line-draft.ts:149`).
- **A szablon is a plain investment tree.** Status `szablon`, its own `kosztorys_sections` /
  `kosztorys_items`, edited through exactly the same server actions as any kosztorys; the only
  server-side szablon branch is `investmentAction`'s tail (`markPresetEdited` + expire `presets`,
  `src/lib/actions/investment-action.ts:89-92`).
- **Every apply path reads the szablon through one function**, `serializeKosztorysAsPreset`
  (`src/lib/kosztorys/serialize-preset.ts:15-45`) → `getKosztorysTree` → `selectKosztorysTreeData`
  (`src/lib/db/kosztorys-tree.ts:55-141`). A katalog read-through for szablony therefore has one
  natural seam: the items subselect of the tree read.
- **The link was rejected twice before** (`katalog-prac-identity` 2026-09-17, `kosztorys-item-
catalogue-link` 2026-10-01). EX-1017 reverses that by owner decision 2026-10-07. The reasons given
  then are concrete engineering risks the plan must answer, not just history (see „Prior rulings").
- **No katalog write path warns about szablony**, and the only usage count
  (`src/lib/db/catalogue-usage.ts:11-20`) excludes them on purpose.
- **Data is ready.** Prod after the 2026-10-08 cleanup: all 302 prace of „Kosztorys 2026 kolory"
  have a katalog entry and agree with it on every field (cena, both stawki incl. mode, tłumaczenia).

## Detailed Findings

### 1. Szablon — create, apply, edit, list

**Create**

- Empty: `create-empty-preset-dialog.tsx:25` → `createEmptyPresetAction`
  (`src/lib/actions/kosztorys-presets.ts:119-140`) → `createTemplate`
  (`src/lib/kosztorys/create-template.ts:14-31`).
- „Zapisz jako nowy szablon…" / „Nadpisz istniejący": `savePresetAction` (`kosztorys-presets.ts:68-115`).
  `new` → `createTemplate(tree: serializeKosztorysAsPreset(src))`; `overwrite` →
  `replaceTreeWithSnapshot('Przed nadpisaniem: …')`.
- `serializeKosztorysAsPreset` keeps opis, tłumaczenia, j.m., clientPrice, the four overrides,
  `note`, order; drops `ref`, globalDiscount; zeroes przedmiar / rabat / review fields; drops etapy.

**Apply (szablon → kosztorys)** — all three copy the kept fields verbatim:

- Founding an investment: `createInvestment` (`src/lib/investments/create-investment.ts:17-53`) →
  `seedInvestmentFromPreset` (`src/lib/kosztorys/seed-from-preset.ts:19-44`) → `applyPreset`
  (`apply-preset.ts:14-26`) → `insertKosztorysTree`.
- „Wczytaj szablon…": `reloadFromPresetAction` (`kosztorys-presets.ts:228-249`) →
  `reloadInvestmentFromPreset` (`reload-from-preset.ts:19-37`) → `replaceTreeWithSnapshot`.
- „Sekcja z szablonu…": `appendPresetSectionsAction` (`kosztorys-presets.ts:182-219`) →
  `appendPresetSections` (`append-preset-sections.ts:35-74`) → `insertItems`.

**Edit** — `/szablony/[id]` (`src/app/(frontend)/szablony/[id]/page.tsx:13-47`) renders
`KosztorysEditorV2 isTemplate`. Cell edits: grid `onChange` (`use-kosztorys-editor.ts:1216-1260`),
undo/redo (`:787-817`), „accept katalog name" (`:1163-1174`) → all `updateItemFieldAction`
(`src/lib/actions/kosztorys.ts:124-140`) → `payload.update('kosztorys-items')`. Other actions reachable
from a szablon: `addItemAction` (`:480-550`), `removeItemAction`, section CRUD, renumber, layout,
`cleanItemTextsAction` (`:281`), `clearKosztorysAction` (`:306`), `insertCatalogueItemsAction` /
`createSectionWithCatalogueItemsAction` (`catalogue-to-kosztorys.ts:63-129`),
`applyCatalogueToKosztorysAction` (`:173-258`), `fillKosztorysTranslationsAction`
(`kosztorys-translations.ts:15`), snapshot actions. None branches on szablon.

Client-only `isTemplate` branches: `use-kosztorys-editor.ts:155,188,251,631` (`workshopVisible` →
`WORKSHOP_VISIBLE_COLUMNS`, `src/lib/kosztorys/workshop-columns.ts:36-46`: actions, sekcja, opis,
tłumaczenia, j.m., cena, both stawki, `note`, `workNote`), toolbar/menus/dialog copy.

**List / cache / trash / snapshots** — `/szablony` → `getPresetRows` (`src/lib/queries/presets.ts:49-68`;
`unstable_cache` keys `['presets']` / `['preset-sections']`, tag `CACHE_TAGS.presets`). Trash via
`investment-trash.ts`; a szablon snapshot stores full item content (`snapshot-format.ts:66-76`); the
daily cron skips szablony (`src/lib/db/snapshots.ts:79-87`).

### 2. Katalog prac

**Schema** — `src/collections/work-catalogue-items.ts`: description, descriptionTranslations,
workNote, category, unit, clientPrice, `wToolsRate`/`ownToolsRate` + `*RateCoeff` (NULL/NULL = auto),
`matchKey` UNIQUE hidden. Migrations: `20260901_0` (table, UNIQUE `match_key`), `20260901_1` (nullable
rates), `20260923_0` (coeffs), `20261001_0` (translations), `20261007_0` (`work_note`).

**Identity** — `catalogueKey = foldDescription(d) | foldUnit(u) || '~'`
(`src/lib/kosztorys/work-catalogue/catalogue-key.ts:15-17`); written by `catalogueRow`
(`write-catalogue-entry.ts:23-33`) on every action write. Renaming opis/j.m. in
`updateCatalogueItemAction` re-keys the entry — every pozycja still spelled the old way silently loses
its workNote, its comparison and its usage count.

**Writers** (`src/lib/actions/work-catalogue.ts` unless noted), all expire `workCatalogue`:
`createCatalogueItemAction` :29, `updateCatalogueItemAction(id)` :68 (key-collision check :80),
`updateCatalogueNoteAction(id)` :116, `deleteCatalogueItemAction(id)` :135 (no usage check; confirm
copy says copies stay unchanged), `saveItemToCatalogueAction` :169 (by the pozycja's key, via
`catalogueSaveState`, `src/lib/queries/work-catalogue.ts:31-42`), `fillCatalogueTranslationsAction`
:206, `addItemAction`'s `applyCatalogueWrite` (`write-catalogue-entry.ts:63-102`, returns `void`).

**Readers** — `getWorkCatalogue` (`src/lib/queries/work-catalogue.ts:20-27`, key `work-catalogue-v3`);
insert from katalog → `itemFromFields` (`src/lib/kosztorys/item-from-fields.ts:24-49`, copies opis,
tłumaczenia, j.m., cena, rate pair; no workNote, no id); comparison `build-catalogue-comparison.ts`
(`byKey` :159, `entryByItemId` :198 → `catalogueEntryByRowId`, `use-kosztorys-editor.ts:632`, feeding
WorkNoteCell, row conditions, compare dialog, accept-name).

**Rates** — `src/lib/kosztorys/work-catalogue/catalogue-rate.ts`: `catalogueRateValue` :75
(coeff > kwota > auto), `impliedCatalogueRate` :94 (pozycja → katalog: own coeff → `{null, coeff}`,
kwota → `{amount, null}`, neither → `{null, null}`). Auto is never resolved on copy; it is priced at
read time with the target investment's coefficient.

### 3. Key-based matching (candidates to become id-based)

1. `catalogueSaveState` — `src/lib/queries/work-catalogue.ts:31-42` (save/overwrite dialogs).
2. `resolveCatalogueWrite` — `write-catalogue-entry.ts:44-49` (create, „Nowa praca").
3. `updateCatalogueItemAction` collision check — `work-catalogue.ts:80` (stays key-based: uniqueness).
4. „Nowa praca" client collision — `new-item-form.tsx:76-77`.
5. `build-catalogue-comparison.ts:159-185` → workNote, divergence/missing conditions, compare dialog.
6. `applyCatalogueToKosztorysAction` — `catalogue-to-kosztorys.ts:198-219`.
7. `already-in-kosztorys.ts:18-41`.
8. Usage — `catalogue-usage.ts:47,59-62` + `src/lib/db/catalogue-usage.ts`.
9. Worker report swap — `line-draft.ts:52`.
10. Tłumaczenia — `ai-translation-fill.ts:54`, `kosztorys-translations.ts:25`,
    `actions/kosztorys.ts:448`, `build-import-plan.ts:248` (sheet import: no id, stays key-based).
11. Scripts — `sync-template-translations.ts:101`, `fix-kosztorys-descriptions.ts:70`.

### 4. Carrying a katalog id on `kosztorys_items` — plumbing inventory

`ref` is the precedent: a raw SQL column absent from the collection, `insertItems` binds
`it.ref ?? DEFAULT`, safe because `push: false` (`payload.config.ts:69-74`).

| Path                                | file:line                                                                               | id semantics                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Column list / VALUES                | `src/lib/kosztorys/insert-rows.ts:21-43`, `:131`                                        | add; `insert-schema-drift.test.ts` guards the list, not the tuple                                                                                           |
| Tree read + mapper                  | `src/lib/db/kosztorys-tree.ts:68-79`, `:152-181`                                        | add (`kosztorys-tree-sql-drift.test.ts`)                                                                                                                    |
| Item type                           | `src/lib/kosztorys/types.ts:38-78`                                                      | `catalogueItemId: number \| null` — tsc then forces mapper, `itemFromFields`, `extraAsItem`, `itemWithColumnDefaults`, preset literal, sheet-import builder |
| Autosave patch                      | `item-patch-schema.ts:13`, `v2-rows.ts:6-22`                                            | not patchable                                                                                                                                               |
| Snapshot format                     | `snapshot-format.ts:39,110-128,164-189`                                                 | additive → no version bump; Tolerant list + `?? null`                                                                                                       |
| Restore / replace                   | `restore-kosztorys.ts:35-38`, `replace-tree-with-snapshot.ts:74`                        | **keep**, filtered to live katalog ids (precedent `liveWorkerIds`, `insert-kosztorys-tree.ts:29-50`) — else a deleted entry = FK 23503 kills the restore    |
| `serializeKosztorysAsPreset`        | `serialize-preset.ts:27`                                                                | **keep**                                                                                                                                                    |
| Seed / reload / append from szablon | `seed-from-preset.ts:35`, `reload-from-preset.ts:27`, `append-preset-sections.ts:54-58` | keep + live filter                                                                                                                                          |
| Save as szablon                     | `kosztorys-presets.ts:85,107`                                                           | keep (resolve unlinked rows — see open questions)                                                                                                           |
| Sheet import                        | `build-import-plan.ts:244`                                                              | keep `current?.catalogueItemId`; unmatched row: optionally by `matchKey`                                                                                    |
| Insert from katalog                 | `place-catalogue-items.ts:34-43`                                                        | **set** = entry id                                                                                                                                          |
| „Nowa praca"                        | `actions/kosztorys.ts:530-533`                                                          | set when written to katalog — `applyCatalogueWrite` must return the id                                                                                      |
| Accepted worker extra               | `accept-worker-report.ts:372-414`                                                       | set on the katalog branch (`:381-386`)                                                                                                                      |
| AI draft loader, seeds              | `scripts/load-ai-draft.ts`, `seed-*.ts`                                                 | NULL                                                                                                                                                        |

Migration convention: hand-written, `IF NOT EXISTS`, symmetric `down`, registered in
`migrations/index.ts`; FK-on-ALTER precedent `20261005_6_add_worker_report_scan.ts:10`. Index the FK.

### 5. Where the „szablon reads the katalog" seam sits

- **Read**: `selectKosztorysTreeData`'s items subselect (`kosztorys-tree.ts:68-79`) —
  `LEFT JOIN work_catalogue_items` on the new id, katalog columns winning for a szablon's rows.
  Consumers that inherit it: the szablon editor page, `serializeKosztorys` (→ every apply path and
  every szablon snapshot), preview/share, cron.
- **Write**: `updateItemFieldAction` behind `investmentAction`, which already resolves
  `gate.isTemplate` (`investment-action.ts:89`). One branch there covers grid, undo/redo and
  accept-name. Bulk writers that also reach a szablon: `cleanItemTextsAction` → `setItemTexts`
  (`src/lib/db/kosztorys-item-texts.ts:38`), `fillKosztorysTranslationsAction` → `setItemTranslations`
  (`:64`), `applyPercentDiscountToAllItemsAction` (rabat — irrelevant on a szablon),
  `applyCatalogueToKosztorysAction` (meaningless on a szablon once it reads the katalog).
- **Override → rate mapping** on write-through: a szablon cell's override pair maps to the katalog's
  rate pair exactly as `impliedCatalogueRate` does today („Zapisz do katalogu").
- **Cache**: a katalog write now changes every szablon using the entry — katalog writers must expire
  the tree tags + `presets`; szablon content writes must expire `workCatalogue`.

### 6. Warnings — katalog writes that change szablony

`updateCatalogueItemAction` (highest risk: opis/j.m. change re-keys), `deleteCatalogueItemAction`,
`updateCatalogueNoteAction`, `saveItemToCatalogueAction` overwrite, `addItemAction` overwrite,
`fillCatalogueTranslationsAction` (bulk), scripts (no UI). A szablon count needs a new query —
`db/catalogue-usage.ts` excludes szablony by design.

## Code References

- `src/lib/db/kosztorys-tree.ts:68-79` — items subselect; the read-through seam
- `src/lib/kosztorys/serialize-preset.ts:15-45` — single reader of szablon content for all apply paths
- `src/lib/actions/kosztorys.ts:124-140` — `updateItemFieldAction`, the write-through seam
- `src/lib/actions/investment-action.ts:89-92` — the only server szablon branch
- `src/lib/kosztorys/insert-rows.ts:21-43,131` — column list + VALUES tuple
- `src/lib/kosztorys/snapshot-format.ts:39,110-189` — snapshot version, tolerant parse, defaults
- `src/lib/kosztorys/insert-kosztorys-tree.ts:29-50` — `liveWorkerIds`, the live-id filter precedent
- `src/lib/actions/work-catalogue.ts:68-206` — katalog writers
- `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts:23-102` — key derivation, write resolution
- `src/lib/kosztorys/work-catalogue/catalogue-rate.ts:75,94` — rate valuation, pozycja → katalog rate
- `src/lib/db/catalogue-usage.ts:11-20` — usage count, szablony excluded
- `src/lib/kosztorys/workshop-columns.ts:36-46` — the szablon's closed column list

## Architecture Insights

- **Two shapes are possible; one removes the problem.** (a) _Read-through_: szablon rows hold the id
  plus their own sekcja/order/`note`; content columns are taken from the katalog on read; a szablon
  edit writes the katalog row. One source of truth — two szablony cannot drift, a katalog edit from
  `/katalog-prac` shows up in every szablon with no fan-out. (b) _Write-through copy_: szablon rows
  keep their columns and every edit writes both sides and fans out to other szablony. Every writer
  (including scripts and `/katalog-prac`) must then fan out, which is the drift EX-1017 exists to
  remove. (a) is the shape the model describes (pkt 2: „bez własnej treści i cen").
- **Under (a) the apply paths need almost nothing**: they already read the szablon through
  `serializeKosztorysAsPreset` → tree read, so a kosztorys founded from a szablon gets the katalog's
  values frozen at that moment, plus the id. Pkt 6 (kosztorys independent) holds by construction.
- **Rename is the sharp edge.** Under (a) a szablon opis edit is a katalog rename: it re-keys
  `match_key` (UNIQUE — collisions refused before the first write, lessons.md:2445-2449) and changes
  the praca in every szablon. The model says a rename from a _kosztorys_ must not rename the katalog
  (`change.md:59-61`) — but from a _szablon_ it is exactly what the cleanup did by hand on 2026-10-08.
- **`ref` is the template for the new column** — raw, unmodelled, kept by restore and preset paths,
  set by insert paths.

## Historical Context (from prior changes)

- `context/foundation/roadmap.md:428-432`, `prd.md:268-277` — S-09 (2026-07-09): preset prices are
  seed-defaults, „never a live source of truth"; a live price link „reintroduces the centralisation
  the owner explicitly rejected". **Superseded** by the owner's 1:1 decision 2026-10-07 for szablony;
  the kosztorys-side half (kosztorysy immune to katalog changes) still holds (pkt 6).
- `context/reference/kosztorys-editor-domain-notes.md:1084-1110`,
  `context/archive/2026-10-01-kosztorys-item-catalogue-link/change.md:20-28` — id link rejected twice.
  Reasons: sheet import rebuilds without ids (permanent „id, else text" rule); a stale link gives a
  confident comparison against the wrong praca; a snapshot holding a deleted id fails restore (23503);
  `ON DELETE SET NULL` writes into closed investments. Revisit was gated on EX-780 and closing the
  sheet-based investments.
- `context/archive/2026-09-21-catalogue-compare-bulk-update/change.md:40-58` — „auto" in the katalog is
  a decision; a different pricing mode is a divergence.
- `context/changes/2026-10-06-kosztorys-ai-knowledge-loop/change.md:22-35` — workNote: one per katalog
  entry, never copied, read live by key across kosztorysy and szablony.
- `context/changes/2026-10-06-catalogue-usage-counter/change.md:26-40` — usage excludes szablony;
  match rate 93% for app-made kosztorysy, 64% for sheet-imported ones.
- `context/foundation/lessons.md` — :260-266 (outside referrers of a tree: SET NULL or text copy),
  :269-273 (snapshot before a destructive replace), :539-551 (new tree field → raw insert column list),
  :788-835 (snapshot version / tolerant payload), :1114-1128 (bump `unstable_cache` key when a
  payload's _meaning_ changes — `['presets']` broke prod after EX-893), :1734-1739 (stable ids),
  :1804-1809 (fold/key changes owe a `match_key` backfill), :2264-2267 (szablon readers filter
  `trashed_at` by hand), :2445-2449 (refuse before the first write in a transaction).
- `context/foundation/test-plan.md` — risks #12 (restore/wczytaj mint new ids), #13 (szablon leaks job
  data or loses identity), #14 (katalog lies about itself; usage counts szablony), #15 (trashed szablon
  seeds or takes a write).

## Related Research

- `context/archive/2026-10-01-kosztorys-item-catalogue-link/` — the cancelled link change
- `context/changes/2026-10-07-template-from-catalogue/change.md` — model, owner rulings, 2026-10-08 sync

## Open Questions

1. **Read-through vs write-through copy** (Architecture Insights) — recommendation (a); confirm in plan.
2. **FK or soft reference on kosztorysy?** A hard FK with `ON DELETE SET NULL` writes NULL into closed
   investments and needs the live-id filter on every restore. A soft reference (no FK; katalog ids are
   `serial`, never reused, so a dead id resolves to nothing) avoids both. Szablon rows need the hard
   guarantee more than kosztorysy do.
3. **Owner decision 2** (`change.md:88-89`): backfill the id onto existing kosztorysy by key, or only
   kosztorysy founded from now?
4. **Owner decision 3** (`change.md:90-91`): katalog delete of an entry used in a szablon — warn or block?
5. **Szablon opis/j.m. edit** = katalog rename for every szablon — allowed directly (as on 2026-10-08),
   or routed through a confirm that names the affected szablony?
6. **`note` (Uwagi) on a szablon row** — stays per-szablon (it is in `WORKSHOP_VISIBLE_COLUMNS` and
   `serializeKosztorysAsPreset` keeps it), or moves to the katalog?
7. **„Kosztorys 2026" (the unused second szablon)** — 307/310 matched, not cleaned. Link what matches
   and leave the rest, or trash it before the switch?
8. **„Dodaj pracę" inside a szablon** — must a new praca go to the katalog first (the szablon cannot
   hold one without an entry), i.e. „Nowa praca" in a szablon always writes the katalog?
