---
date: 2026-09-29T08:16:12+0200
researcher: Claude (Opus 5.5)
git_commit: 51cb5253
branch: staging
repository: wykonczymy
topic: 'A kosztorys v2 section can exist with zero items'
tags: [research, codebase, kosztorys, editor, sections, section-band-rows, delete-policy]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude (Opus 5.5)
---

# Research: a kosztorys v2 section can exist with zero items

**Date**: 2026-09-29T08:16:12+0200
**Git Commit**: 51cb5253 · **Branch**: staging · **Repository**: wykonczymy

## Research Question

Today every kosztorys v2 section always has at least one item (pozycja). We want a section to be
able to exist with zero items. What enforces the invariant, what breaks when it goes, and where is
the work?

## Summary

**The invariant lives in the client, not the data.** The DB, the tree loader, snapshots, templates
and sheet import all carry sections independently of items — an empty section already reaches the
editor as `items: []`. The editor throws it away on its first line: `treeToRows` flattens **items
only** (`src/lib/kosztorys/v2-rows.ts:30-47`), and from then on the section list, its order, and
every section's name/colour are re-derived from item rows (`sectionRepresentatives`,
`sectionSubtotalsForView`, `groupBySection`, `computeMoveEdges`, …).

Three things enforce "≥1 item":

1. **Creation** — `createSectionWithFirstItem` (`src/lib/kosztorys/create-section.ts:8-39`), used by
   `addSectionAction` / `insertSectionAction` (`src/lib/actions/kosztorys.ts:300-392`), always
   mints a blank first item, because "a 0-item section renders as 0 rows, so it would land invisible".
2. **Deletion** — `handleRemoveItem` → `isLastItemInSection` → `handleRemoveSection`
   (`use-kosztorys-editor.ts:820-825`, `src/lib/kosztorys/delete-policy.ts:3-13`). Client-only; the
   server `removeItemAction` never touches the section.
3. **Visibility** — the section list is derived from item rows, so an itemless section cannot render.

**It was never an owner ruling.** It started as a rendering workaround (`6b44f8fd`, 2026-07-08),
was kept as "deliberate drift, better than plan" by a review gate (`f8ebc07`), and hardened by
EX-578 as a guard against the EX-463 wedged cold start. The owner's 2026-08-31 ruling (EX-751
cancelled) removed the **kosztorys-level** "≥1 pozycja" floor; it said nothing about sections.

**The main work is one new piece of editor state:** a `sections: {id, name, color, displayOrder}[]`
seeded from `tree.sections`, becoming the source of section order and metadata for every consumer
that today reads `rows` / `subtotals`. Everything else is small by comparison.

## Detailed Findings

### 1. Data & server plane — already fine

- Schema: `kosztorys-items.section_id NOT NULL REFERENCES kosztorys_sections ON DELETE CASCADE`
  (`src/migrations/20260708_2_add_kosztorys_sections_items.ts:27`). No constraint, trigger or hook
  requires a section to have items (`src/collections/kosztorys-sections.ts:29-37`).
- Read: `src/lib/db/kosztorys-tree.ts:58-64` selects sections on their own; `src/lib/queries/kosztorys.ts:63-65`
  attaches `items: itemsBySection.get(s.id) ?? []`. `KosztorysEditorDataT.tree.sections`
  (`src/lib/kosztorys/types.ts:124`) is the only section list shipped to the page — there is no
  separate one for colours/side panel.
- Adding the **first** item to an empty section needs no new server code: `addItemAction(sectionId)`
  (`actions/kosztorys.ts:426-449`) uses `sectionOwnerAndNextItemOrder` (`create-item.ts:22-30`,
  `LEFT JOIN … COALESCE(MAX+1, 0)`). `insertCatalogueItemsAction` / `appendCatalogueItems`
  (`work-catalogue/catalogue-to-kosztorys.ts:61-86`) use the same helper. Only `insertItemAction`
  (`:452-491`) needs an anchor item.
- `removeSectionAction` (`:332-347`), `updateSectionFieldAction` (`:116-129`),
  `swapSectionOrderAction` (`:396-424`) are section-only and work for an empty section.
  `renumberKosztorysOrderAction` (`:546-597`) touches items only.
- No server SQL groups by section; `selectKosztorysClientTotals` (`db/kosztorys-client-totals.ts:40-70`)
  sums per investment, so an empty section contributes 0 everywhere.

### 2. Paths that can ALREADY create an empty (invisible) section

- **Sheet import**: `parse-labor-tab.ts:146-157` creates a section for every header row;
  `build-import-plan.ts:190-194` keeps every parsed section even with no items under it.
- **„Dodaj sekcję z szablonu"**: `listPresetSections` (`db/presets.ts:152-167`) LEFT-JOINs counts
  and lists a 0-item section as „0 poz." (`add-sections-from-preset-dialog.tsx:219`);
  `appendPresetSections` (`append-preset-sections.ts:46-73`) inserts it.
- **Snapshot restore**: `insert-kosztorys-tree.ts:63-70` inserts every stored section.
- **Seed script**: `src/scripts/seed-kosztorys.ts:89-102`.
- `row-ops.ts:80-93` already acknowledges it: a catalogue target name that matches a section with
  no rows triggers a `'reseed'` (full tree reload).

Local DB (prod copy): 356 sections, 9176 items, **0 empty sections** — flipping visibility on will
not suddenly surface a pile of orphans.

### 3. Editor client — where the work is

Section-derived-from-rows consumers (all must move to the new `sections` state):

| Derived value                                                                                                  | Source                | Consumers                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sectionRows = sectionRepresentatives(rows)` (`use-kosztorys-editor.ts:634`, `section-band-rows.ts:18`)        | first row per section | band order + header/footer name & colour (`kosztorys-editor-body.tsx:289-294`)                                                                                                                                                                                                                                                                                                                                                              |
| `subtotals = sectionSubtotalsForView(…)` (`use-kosztorys-editor.ts:588`, `settlement-aggregates.ts:100-126`)   | rows                  | „Dodaj → Praca" submenu and its fallback to `handleAddSection` when empty (`kosztorys-add-menu.tsx:50-69`); „Sekcje" collapse menu (`toolbar/menus/kosztorys-sections-menu.tsx:26-41`); catalogue picker `sections` / combobox / `resolveSectionTarget` (`catalogue-picker-host.tsx:40`, `work-catalogue/section-target.ts:16,34`); header figures (`kosztorys-editor-body.tsx:215-222`); empty-grid hint (`kosztorys-editor-body.tsx:525`) |
| `sectionColumnTotals` via `groupBySection(rows)` (`use-kosztorys-editor.ts:660-669`)                           | rows                  | footer figures                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `computeMoveEdges(rows)` (`move-edges.ts:16`)                                                                  | rows                  | ▲/▼ enablement in the section menu                                                                                                                                                                                                                                                                                                                                                                                                          |
| `neighborSectionId`, `swapSectionBlock`, `applyInsertSectionRow`, `applyKosztorysOrder` (`row-ops.ts:162-224`) | rows                  | section move, insert above/below, „Zapisz kolejność"                                                                                                                                                                                                                                                                                                                                                                                        |
| `sortRowsWithinSections` (`row-view.ts:72`)                                                                    | rows                  | section-scoped sort (fine — no rows to sort)                                                                                                                                                                                                                                                                                                                                                                                                |
| `sectionIdsWhereAllMatch` (`row-conditions/queries.ts:183`)                                                    | rows                  | fold toggles — an itemless section never qualifies, which is correct                                                                                                                                                                                                                                                                                                                                                                        |

**Section metadata is denormalized onto every item row** (`sectionName`, `sectionColor`,
`v2-rows.ts:38-39`). Consequences for an itemless section:

- Rename / colour silently no-op: `handleSetSectionField` reads `before` from a row and returns when
  there is none (`use-kosztorys-editor.ts:1070-1071`).
- `handleAddItem` samples a row for name/colour and falls back to `DEFAULT_SECTION_NAME` / `null`
  (`:788-794`).

Keep the denormalized copies on rows (search `row-view.ts:14`, footer label, name cell), but make
`sections` the write target and patch rows alongside. **Do not** put a fake section row into `rows` —
`rows` feeds the diff, totals and `prevById`; a fake item leaks into all of them.

**Bands** — `buildSectionBandRows` skips a section with no rows in view
(`section-band-rows.ts:52-54`). It cannot tell "filter emptied it" from "empty on purpose" by
looking at `viewRows`; it needs an explicit `narrowed` flag (search non-empty or any condition
engaged). Header cell already tolerates a missing figure („(0 poz.)", `section-header-cell.tsx:79`),
footer renders blank (`section-footer-cell.tsx:46`). Whole-kosztorys sort disables bands
(`section-band-rows.ts:47`) — an itemless section is invisible there, same as every band.

**Adding the first pozycja** — every entry point today needs an anchor row or a listed section.
`kosztorys-section-actions-menu.tsx:108` already has „Dodaj pracę z katalogu do sekcji…"; a plain
„Dodaj pracę" next to it calling `handleAddItem(sectionId)` is the natural entry. Optional: a
placeholder row / button under the header. A placeholder row needs a new synthetic id range
(`synthetic-rows.ts`) plus branches in `row-height.ts:22`, the clip-cue check
(`kosztorys-editor-body.tsx:348-353`), `SyntheticAwareCell` (`kosztorys-synthetic-rows.tsx:76-98`)
and `dropHeight`.

**Deleting** — remove the `isLastItemInSection` cascade (`use-kosztorys-editor.ts:822-825`) and
`delete-policy.ts` with it. The item confirm text is already just „Usunąć pozycję?"
(`kosztorys-row-actions-menu.tsx:90`). `handleRemoveSection` computes removals from `rows`
(`:1009-1012`) and rolls back by re-appending (`:1031`) — it must also remove/restore the `sections`
entry at its index.

**Undo gap** — `pruneByIds` prunes by item id only (`use-undo-redo.ts:88-99`). Rename/colour
commands carry no `touchedIds` (`:359-361`); section reorder uses the section's item ids (`:922`),
which is `[]` for an empty section. After a section delete, undoing an earlier section command
replays a write against a dead section id. Fix: tag section commands with `sectionHeaderRowId(sectionId)`
(negative id namespace) and prune it in `handleRemoveSection`.

**Remount token** — `kosztorys-editor-v2.tsx:30` keys freshness on `revision` + item count. Adding
or removing an empty section in another tab changes neither. Add the section count to `treeToken`.

Numbering (`baseOrdinals`, items only), `rowKey` (`String(id)`), and `onChange` dropping `id < 0`
rows are unaffected.

### 4. Downstream consumers outside the grid

All row-derived, so an itemless section simply drops out — no crash, no division by zero
(`settlement-aggregates.ts:128,131` guard both ratios).

- **Client-facing** — share link `/k/[token]`, „Podgląd dla inwestora" (both render the editor in
  preview mode), „Wydruk oferty" (`print/build-html.ts:77-86`, `offer-print-action.tsx:44-49`),
  worker print (`print/worker.ts:52-55`), worker summary (`queries/worker-kosztorys.ts:99`). Hiding
  an itemless section in these is the right default — the same stance as `client-empty` /
  `hideEmptyRows` (`row-conditions/registry.ts:355`, `client-view/settings.ts:14,37`).
- **Totals / pie / summary panel** (`column-totals.ts:38`, `chart-slices.ts:34,56-67`,
  `investment-summary-panel.tsx:58`) — no change; empty contributes 0.
- **Katalog prac target mismatch (exists today)** — the client option list comes from item-based
  subtotals (`section-target.ts:14-21`), so an empty „Łazienka" is offered as _new_, while the server's
  `sectionIdByName` (`create-section-with-catalogue-items.ts:16-45`, `lower(btrim(name))`) finds the
  existing one and appends (`createdSection: false`). Harmless outcome, wrong label; fixed for free
  once the list reads `sections`.
- **Versions diff** (`history/diff-versions.ts:38-45,93-106`, `history/change-rows.ts:59-100`) compares
  items only — adding/removing an empty section shows no diff row. Acceptable; out of scope unless
  the owner asks.
- **Google Sheets** — no kosztorys sync/export exists (`kosztorys-editor-domain-notes.md:275`); import
  and sheet comparison (`build-sheet-comparison.ts:183-192`) match items only.

### 5. Naming collision

„Pusta sekcja" already means something in this code: a section whose items carry no values on both
axes (`isEmptyOnBothAxes`, `registry.ts:20-22`; history of „Zwiń puste sekcje" at `registry.ts:174,357,376`;
`kosztorys-empty-sections.test.ts`). The new concept needs a distinct name — „sekcja bez pozycji" /
`itemlessSection` — so neither the UI nor the code confuses the two.

## Code References

- `src/lib/kosztorys/v2-rows.ts:30-47` — `treeToRows`, the point where itemless sections are lost
- `src/lib/kosztorys/section-band-rows.ts:18-22,44-62` — `sectionRepresentatives`, `buildSectionBandRows`
- `src/lib/kosztorys/create-section.ts:8-39` — `createSectionWithFirstItem`
- `src/lib/kosztorys/delete-policy.ts:1-13` — `isLastItemInSection` + its rationale comment
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:588,634,660-669,788-794,820-825,1006-1031,1064-1071`
- `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:30` — `treeToken`
- `src/lib/kosztorys/row-ops.ts:70,80-93,162-224` — append position, `'reseed'`, section order ops
- `src/lib/kosztorys/move-edges.ts:16` — ▲/▼ edges from rows
- `src/lib/kosztorys/settlement-aggregates.ts:82-134` — `sectionSubtotalsForView`
- `src/components/kosztorys/editor/toolbar/kosztorys-add-menu.tsx:50-69` — „Dodaj → Praca/Sekcja"
- `src/lib/kosztorys/work-catalogue/section-target.ts:14-34` — catalogue target list
- `src/lib/actions/kosztorys.ts:300-392,426-449,494-509` — add/insert section, add item, remove item
- `src/components/kosztorys/editor/hooks/use-undo-redo.ts:88-99` — `pruneByIds`

## Architecture Insights

- **Derived-state-from-the-wrong-entity.** The editor's canonical state is a flat list of _items_;
  sections are a projection of it (a "group-by view"). That works exactly as long as every group
  is non-empty — the invariant exists to keep the projection lossless. Allowing empty groups means
  promoting sections to first-class state (two normalized collections, `sections` + `rows`, joined
  by `sectionId`) — the same shape the server already has in `tree.sections[].items`.
- Server is already normalized; the change is making the client match it, not a data migration.
- Keep the fix out of `KosztorysEditorProvider` (EX-496 perf regression); per AGENTS.md, a new
  cluster (section state + order ops) is a leaf hook under `editor/hooks/`, and pure order logic
  belongs in `src/lib/kosztorys/`.

## Historical Context (from prior changes)

- `6b44f8fd` (2026-07-08) — first editor UI: new section always gets a blank item, "empty = 0 rows = invisible".
- `f8ebc07` + `context/archive/2026-07-11-kosztorys-editor-ux/review-gate-staging-merge.md:33` — last-item delete cascades to the section; "deliberate drift… Keep". Engineering call.
- `context/archive/2026-07-17-kosztorys-delete-confirm/` (EX-477) — populated deletes allowed behind confirm + snapshot; per-section cascade kept.
- EX-578 (`40ffc71b`, 2026-07-28) — section + first item in one transaction; guards the EX-463 wedged cold start (a 0-item section hid the seeding dialog). Technical, not business.
- `context/archive/2026-07-28-drop-empty-kosztorys-scaffold/review-gate.md:20` (EX-615) — empty-grid hint keyed on items; a 0-item section was ruled unreachable.
- EX-665 (`dda94153`, 2026-08-14) — bands from the full section list, not the filtered view — but that list is still item-derived.
- EX-751 cancelled (`7f6c86b4`, 2026-08-31) — owner: a kosztorys may be emptied to zero. Kosztorys floor only; says nothing about sections.
- `context/archive/2026-09-01-katalog-praca-picker/review-gate.md:27` — "empty section not a picker target" dropped as pre-existing.
- `context/archive/2026-09-22-catalogue-picker-new-section/change.md` — owner: section name is identity; no orphan section on Cancel; new section without a blank first row.

## Related Research

- `context/changes/2026-09-23-kosztorys-bulk-actions/research.md:41-43,210-216` (EX-857, status
  `preparing`) — **direct conflict**: plans bulk delete to _generalize_ `isLastItemInSection`
  ("sections whose items are all selected get deleted too"). If this change lands first, bulk
  delete must drop that cascade; the two plans must agree.

## Open Questions (for /10x-plan)

1. **„Dodaj → Sekcja"** — create a bare section (no blank first row), or keep the first item? Bare is
   the point of the change and mirrors the 2026-09-22 catalogue ruling. EX-463 guard: verify the
   seeding dialog / empty-grid hint (`kosztorys-editor-body.tsx:525`) keys on _sections_, not items,
   once sections can be itemless.
2. **Deleting the last item** — leave the section in place (drop the cascade), or ask?
   Recommendation: leave it; deleting a section is its own explicit action.
3. **Visibility under a filter/search** — hide an itemless section while narrowed (like a
   filter-emptied one), show it otherwise? Under whole-kosztorys sort it is invisible with every other band.
4. **What sits under the header** — header band only, with „Dodaj pracę" in the section menu; or a
   placeholder row with a call-to-action? Placeholder costs a new synthetic row type.
5. **Client outputs** (share link, podgląd, wydruk oferty, worker print) — hide itemless sections
   (recommended), matching `hideEmptyRows`.
6. **Collapse chevron** on an itemless section — hide or no-op.
7. **Owner-facing name** — „sekcja bez pozycji" (not „pusta sekcja", which already means "no values").
8. **Bulk-actions (EX-857) sequencing** — which lands first, and who owns removing the cascade.
9. Versions diff showing section-level adds/removes — out of scope unless asked.

## Decisions (user, 2026-09-29)

- Q1: „Dodaj → Sekcja" creates a bare section — no blank first item.
- Q2: deleting the last item leaves the section in place; the cascade goes.
- Q3: an itemless section is hidden while a filter/search narrows the grid, shown otherwise.
- Q5: client outputs (share link, podgląd, wydruk oferty, worker print) hide itemless sections.
- Q4: variant C — header band only (no footer, no placeholder row); an itemless section's header
  shows an inline „+ Dodaj pracę" button (conditional, only while the section has no items). „Dodaj
  pracę" is also added to the section ⋯ menu for every section.
