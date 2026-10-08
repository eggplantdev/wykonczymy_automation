# Szablon as a list of katalog prac entries — Implementation Plan (EX-1017)

## Overview

A szablon stops holding its own copy of each praca. Each szablon row remembers its katalog prac entry
and shows that entry's opis, j.m., Cena j.m., both stawki (with mode) and tłumaczenia, read live. A
content edit in the szablon writes the katalog. Every kosztorys pozycja also remembers its katalog
entry (by number, not by text), so „Aktualizuj pozycję w katalogu prac", the comparison, „Komentarz do
pracy" and the usage counter survive a katalog rename. Kosztorysy stay independent copies (pkt 6).

## Current State Analysis

See `research.md` — the codebase baseline. In short:

- No pozycja knows its katalog entry; 11 call sites match by `catalogueKey(opis, j.m.)` against the
  UNIQUE `work_catalogue_items.match_key`.
- A szablon is an investment with status `szablon` and an ordinary tree; every apply path reads it
  through `serializeKosztorysAsPreset` → `buildKosztorysTree` → `selectKosztorysTreeData`.
- Szablon cell edits go through `updateItemFieldAction` behind `investmentAction`, whose gate already
  resolves `isTemplate` (`src/lib/actions/investment-action.ts:89`).
- Katalog writers expire only `workCatalogue`; none knows about szablony. Delete is a hard delete with
  no usage check (`src/lib/actions/work-catalogue.ts:135`).
- Prod 2026-10-08: one live szablon („Kosztorys 2026 kolory", 302 prace, all identical to the katalog
  in every field incl. rate mode); „Kosztorys 2026" is in the kosz since 07:18 UTC. Szablon column
  „Komentarz" (`note`) is empty in all 302 rows.

## Desired End State

- `kosztorys_items.catalogue_item_id` exists, is carried by every copy path and set by every insert
  path that knows the entry; existing rows are linked by an idempotent script.
- `/szablony/[id]` shows linked rows with katalog values; editing opis / j.m. / Cena j.m. / stawki /
  tłumaczenia there writes the katalog entry; a rename colliding with another entry is refused.
- An unlinked szablon row behaves exactly as today (own copy) — the transition is safe in any order.
- `/katalog-prac`: the edit form names the szablony a praca is in; delete warns with that list and
  removes the praca from every szablon (live and trashed).
- Kosztorys: „Aktualizuj pozycję w katalogu prac" resolves by the remembered entry; a changed opis
  offers „Zapisz jako nową pracę" (and relinks the pozycja); the dialog names the szablony it changes.
  „Zapisz jako nowy szablon / Nadpisz" keeps only linked prace and reports the skipped count.
- Comparison, „Komentarz do pracy", „już w kosztorysie" and the usage counter resolve id-first, key
  as fallback for unlinked rows.
- The szablon no longer shows or carries „Komentarz" (`note`).

### Key Discoveries:

- `selectKosztorysTreeData` items subselect `src/lib/db/kosztorys-tree.ts:68-79`; its drift spec
  (`src/__tests__/lib/db/kosztorys-tree-sql-drift.test.ts`) parses the subselect with `[^()]*?`, so
  the select list must stay paren-free (aliases fine, `coalesce(...)` / `CASE` not).
- `ref` is the precedent for a raw, unmodelled `kosztorys_items` column
  (`src/lib/kosztorys/insert-rows.ts:21-43,131`, `push: false` in `payload.config.ts`).
- Live-id filter precedent: `liveWorkerIds` (`src/lib/kosztorys/insert-kosztorys-tree.ts:29-50`).
- Rate mapping pozycja → katalog: `impliedCatalogueRate`
  (`src/lib/kosztorys/work-catalogue/catalogue-rate.ts:94`); katalog → pozycja is its inverse
  (`rate` → override value, `coeff` → override coeff, both null = auto).
- `catalogueSaveState` (`src/lib/queries/work-catalogue.ts:31-42`) is where both save dialogs resolve
  the target entry today — by key.
- `applyCatalogueWrite` (`write-catalogue-entry.ts:63-102`) returns `void`; it must return the id.

## What We're NOT Doing

- No katalog history / undo beyond the editor's „Cofnij" (owner 2026-10-08: a wrong price is fixed by
  hand). A szablon snapshot restores list + order only; it never writes the katalog.
- No change to kosztorys independence: no katalog write ever flows into a kosztorys.
- No FK constraint (soft reference — see Implementation Approach).
- No id on the sheet-import row identity beyond a key lookup for new rows; the importer's „id, else
  text" rule stays.
- Tłumaczenia for worker reports keep reading the pozycja's own copy (`change.md` pkt 7 is corrected,
  not implemented).
- No live refresh of an open szablon editor after a `/katalog-prac` edit — a reload shows it.
- „Kosztorys 2026" (in the kosz) is linked by the script like any szablon, nothing more.

## Implementation Approach

**Read-through, not copy.** Szablon rows keep their content columns (so an unlinked row and every raw
reader still work), but for a linked row of a szablon the tree read takes the katalog's values. One
source of truth: a `/katalog-prac` edit appears in every szablon with no fan-out, and nothing can
drift. Kosztorysy are never overlaid — they read their own columns.

**Soft reference.** `catalogue_item_id integer NULL` + index, no FK. Katalog ids are `serial` and never
reused, so a dead id simply resolves to nothing. This answers the 2026-09-17 / 2026-10-01 rejections:
no 23503 on restoring a snapshot that names a deleted entry, no `ON DELETE SET NULL` writing into
closed investments. Copy paths still drop dead ids (live filter) so a resurrected row isn't falsely
linked.

**Link script, not migration data.** `match_key` folding lives in TS, so linking is a re-runnable
script (dry-run / `--apply`), like `sync-template-translations.ts`. Kosztorysy link on key alone (the
id says *which praca*, not *which price*). Szablon rows link only when identical to the entry in every
katalog field — a difference is reported and resolved (szablon wins, per 2026-10-08) before re-running.

## Critical Implementation Details

- **Deploy order.** Additive migration → prod migrate (human) → push → link script on prod. Code is
  safe before linking (unlinked = today's behaviour). The kierownik's szablon edits between the last
  comparison and the link run are caught by the script's identity check, never silently overwritten.
- **Override pair on write-through.** A szablon stawka edit arrives as one field (`wToolsOverrideValue`
  or `…Coeff`); `normalizeOverridePatch` makes the pair whole first, then map it to the katalog pair
  via `impliedCatalogueRate` semantics. Writing value and coeff as two katalog updates would race.
- **Rename refusal before the write.** A szablon opis / j.m. edit re-keys the entry; check the key
  holder first and refuse (lessons.md:2445-2449) with the same Polish sentence `/katalog-prac` uses.

## Phase 1: The remembered katalog entry

### Overview

Add the column and carry it through every path. No visible change.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/2026100X_N_add_kosztorys_item_catalogue_id.ts` (+ `index.ts`)

**Intent**: Add the soft reference. Hand-written, `IF NOT EXISTS`, symmetric `down`. Check
`git status src/migrations` for another session's file before naming and before migrating.

**Contract**: `kosztorys_items.catalogue_item_id integer NULL`, index on it. No FK.

#### 2. Type, insert, read

**Files**: `src/lib/kosztorys/types.ts`, `src/lib/kosztorys/insert-rows.ts`,
`src/lib/db/kosztorys-tree.ts`

**Intent**: `KosztorysItemT.catalogueItemId: number | null`; added to `ITEM_INSERT_COLUMNS` and the
VALUES tuple (`?? null`); selected and mapped. Not in `itemPatchSchema` — never autosaved.

**Contract**: tsc forces every literal builder (`itemFromFields`, `extraAsItem`,
`itemWithColumnDefaults`, preset/import builders) to state the field.

#### 3. Snapshots and copy paths

**Files**: `src/lib/kosztorys/snapshot-format.ts`, `restore-kosztorys.ts`,
`replace-tree-with-snapshot.ts`, `insert-kosztorys-tree.ts`, `serialize-preset.ts`,
`seed-from-preset.ts`, `reload-from-preset.ts`, `append-preset-sections.ts`

**Intent**: Additive snapshot field (Tolerant list, `?? null` default, no version bump). Every path
that inserts a serialized tree keeps the id, filtered to live katalog ids (mirror `liveWorkerIds`).
`serializeKosztorysAsPreset` keeps it (and now drops `note` — owner 2026-10-08).

**Contract**: one `liveCatalogueIds(db, ids)` helper beside `liveWorkerIds`, applied in
`insertKosztorysTree` and `appendPresetSections`.

#### 4. Insert paths that know the entry

**Files**: `src/lib/kosztorys/place-catalogue-items.ts` / `item-from-fields.ts`,
`src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts`, `src/lib/actions/kosztorys.ts`
(`addItemAction`), `src/lib/actions/accept-worker-report.ts` (`extraAsItem`),
`src/lib/kosztorys/sheet-import/build-import-plan.ts`

**Intent**: Insert from katalog sets the entry id; „Nowa praca" written to the katalog sets the
created/overwritten id (`applyCatalogueWrite` returns it); an accepted worker extra from the katalog
sets it; the sheet import keeps the matched row's id and resolves a new row by key.

**Contract**: `applyCatalogueWrite(...) → Promise<number | null>` (null = not written to katalog).

### Success Criteria:

#### Automated Verification:

- Migration applies locally: `pnpm payload migrate` (after `git status src/migrations`)
- `pnpm exec vitest run src/__tests__/lib/kosztorys/insert-schema-drift.test.ts`
- `pnpm exec vitest run src/__tests__/lib/db/kosztorys-tree-sql-drift.test.ts`
- New/extended snapshot-format spec: payload without the field parses to `null`; with it round-trips
- New spec: restore / seed drops a dead katalog id, keeps a live one

#### Manual Verification:

- Kosztorys editor: open, edit, „Wczytaj szablon…", restore a snapshot — everything works as before

---

## Phase 2: Link script

### Overview

Link existing rows on prod, idempotently, reporting what it won't link.

### Changes Required:

#### 1. Script

**File**: `src/scripts/link-kosztorys-items-to-catalogue.ts`

**Intent**: Dry-run by default, `--apply` writes. Kosztorys rows (non-szablon, incl. kosz) with
`catalogue_item_id IS NULL` link to the entry whose `match_key` equals the row's `catalogueKey`.
Szablon rows (live and trashed) link only if the row equals the entry in every katalog field
(cena, both stawki with mode, tłumaczenia — reuse the `toCatalogueCandidate` reading the sync tooling
used); otherwise reported with the differing fields. Rows equal to no entry stay unlinked and are
listed. Header comment carries the prod invocation, like `sync-template-translations.ts`.

**Contract**: re-run writes 0. Raw SQL — the header says which cache to flush.

### Success Criteria:

#### Automated Verification:

- Spec on the pure planning function: identical szablon row → link; one differing stawka mode →
  reported, not linked; kosztorys row with a different cena → linked; no key match → unlinked
- Dry-run against local DB prints counts and writes nothing

#### Manual Verification:

- Local `--apply` then a second dry-run reports 0 to link

---

## Phase 3: Szablon reads and writes the katalog

### Overview

The visible switch for szablony.

### Changes Required:

#### 1. Read-through

**Files**: `src/lib/db/kosztorys-tree.ts`, a pure overlay helper in `src/lib/kosztorys/`

**Intent**: In the items subselect, LEFT JOIN the katalog only for a szablon's rows (join through the
investment's status) and select its columns under aliases; the overlay helper replaces description,
unit, translations, clientPrice and the four overrides when the joined entry is present.

**Contract**: select list stays paren-free (drift spec); overlay is a pure function with its own spec.

#### 2. Write-through

**Files**: `src/lib/actions/investment-action.ts`, `src/lib/actions/kosztorys.ts`
(`updateItemFieldAction`), `src/lib/db/work-catalogue.ts`

**Intent**: Expose `isTemplate` to the handler. For a linked szablon row, a patch touching katalog
fields updates the katalog entry instead of the row (rename → re-key with holder check and refusal);
expire `workCatalogue`. Unlinked rows and non-content fields keep today's path. Undo/redo and
„accept katalog name" inherit it.

**Contract**: `updateItemFieldAction` result unchanged; a refusal returns the `/katalog-prac` duplicate
sentence.

#### 3. Szablon editor surface

**Files**: `src/lib/kosztorys/workshop-columns.ts`, editor toolbar/menu components,
`src/lib/actions/kosztorys.ts` (`addItemAction`), `src/lib/actions/kosztorys-translations.ts`

**Intent**: Drop `note` from `WORKSHOP_VISIBLE_COLUMNS`. In a szablon hide „Porównaj z katalogiem",
„Zastosuj katalog" and „Wyczyść teksty" (the server actions refuse on a szablon too). „Nowa praca" in a
szablon always writes the katalog and links the row. „Uzupełnij tłumaczenia" on a szablon fills the
katalog entries of its linked rows.

**Contract**: every szablon-reachable content writer either writes the katalog or refuses.

### Success Criteria:

#### Automated Verification:

- Overlay spec: szablon row with entry takes katalog values incl. auto vs kwota vs mnożnik; kosztorys
  row with an id is untouched; unlinked szablon row keeps its own
- DB spec (5435): cena edit on a linked szablon row changes the katalog entry, not the row; a rename
  onto another entry's opis is refused and writes nothing
- DOM/unit spec: szablon column set no longer contains `note`

#### Manual Verification:

- „Kosztorys 2026 kolory": change a Cena j.m. → `/katalog-prac` shows it; change it back
- Change a stawka from auto to kwota and back → katalog shows the same mode
- Rename a praca to the opis of another katalog entry → refused with a message
- „Komentarz" column is gone from the szablon; „Komentarz do pracy" stays
- Found a new investment from the szablon → its kosztorys has the katalog's values

---

## Phase 4: Katalog prac — warnings and delete

### Changes Required:

#### 1. Usage-in-szablony read

**Files**: `src/lib/db/work-catalogue.ts` (or `presets.ts`), `src/lib/queries/` (`'use server'` read)

**Intent**: Szablon names (live) per katalog entry, read on demand by the dialogs.

#### 2. Edit and delete

**Files**: katalog edit/delete dialogs under `src/components/`, `src/lib/actions/work-catalogue.ts`

**Intent**: Edit form shows „Ta praca jest w szablonach: …" (warning, not a block). Delete confirm
names the szablony and says the praca leaves them; `deleteCatalogueItemAction` deletes the szablon
rows (live and trashed szablony) linked to the entry in the same transaction, marks those szablony
edited and expires `presets`. Kosztorysy keep their copy and their (now dead) id.

### Success Criteria:

#### Automated Verification:

- DB spec: delete removes the entry and its szablon rows; a kosztorys row with that id survives

#### Manual Verification:

- `/katalog-prac` → edit a praca from the szablon: the form names „Kosztorys 2026 kolory"
- Delete a praca that is in the szablon: confirm lists it; after delete it is gone from the szablon,
  an existing kosztorys still has it

---

## Phase 5: Kosztorys side — Aktualizuj, Zapisz jako szablon, id-first matching

### Changes Required:

#### 1. „Aktualizuj pozycję w katalogu prac"

**Files**: `src/lib/queries/work-catalogue.ts` (`catalogueSaveState`),
`src/lib/actions/work-catalogue.ts` (`saveItemToCatalogueAction`), `save-item-to-catalogue-dialog.tsx`

**Intent**: Resolve by `catalogueItemId`, key fallback when unlinked. Same opis + j.m. → „Aktualizuj"
(cena, stawki, tłumaczenia); different → „Zapisz jako nową pracę" (new entry, pozycja relinked; never
a katalog rename from a kosztorys). The dialog names the szablony the update changes. No kosztorys
changes.

#### 2. „Zapisz jako nowy szablon… / Nadpisz istniejący"

**Files**: `src/lib/actions/kosztorys-presets.ts`, the save-preset dialog

**Intent**: Only linked prace are kept; the result reports „N prac nie jest w katalogu — najpierw zapisz
je do katalogu". New dialog description from `change.md`.

#### 3. Id-first matching

**Files**: `build-catalogue-comparison.ts`, `already-in-kosztorys.ts`, `catalogue-usage.ts` +
`src/lib/db/catalogue-usage.ts`, `line-draft.ts`

**Intent**: One shared resolver (id, else key) so comparison, „Komentarz do pracy", „już w
kosztorysie", the worker-report swap and the usage counter agree. Usage SQL also returns the id.
Bump the `unstable_cache` key of any cached reader whose meaning changes (lessons.md:1114-1128).

### Success Criteria:

#### Automated Verification:

- Resolver spec: id wins over a different key match; dead id falls back to key; no id → key
- Spec on `catalogueSaveState` / save action: renamed pozycja → „new" mode and relink; same opis →
  update by id even after a katalog rename
- Spec: save-as-szablon skips unlinked rows and counts them

#### Manual Verification:

- Kosztorys founded from the szablon: change Cena j.m. → „Aktualizuj pozycję w katalogu prac" shows
  „Zmieni cenę w szablonach: Kosztorys 2026 kolory"; other kosztorysy unchanged
- Rename the pozycja's opis → dialog offers „Zapisz jako nową pracę"
- Rename a praca in the szablon → an older kosztorys still shows its „Komentarz do pracy"
- „Zapisz jako nowy szablon…" from a kosztorys with a praca typed by hand → message names the count

---

## Phase 6: Prod transition and docs

### Changes Required:

#### 1. Runbook in `change.md`

**Intent**: The exact sequence — re-run the szablon/katalog comparison on a fresh dump; prod migrate
(human, `pnpm db:migrate:prod`); push; link script dry-run → resolve reported szablon rows (szablon
wins) → `--apply`; second dry-run 0; flush katalog cache via any katalog edit.

#### 2. Living docs

**Files**: `context/reference/kosztorys-editor-domain-notes.md` (§ katalog link — reversal and why the
soft reference answers the old reasons), `context/foundation/roadmap.md` / `prd.md` S-09 note
(szablon prices are now katalog-live; kosztorys immunity unchanged), `context/foundation/test-plan.md`
risks #12–#14, `change.md` pkt 7 correction.

### Success Criteria:

#### Automated Verification:

- None — prose and an operator runbook.

#### Manual Verification:

- After the prod link: the szablon editor shows identical numbers to before the switch (spot-check 5
  prace incl. a kontener with auto stawka and big bag 450)

---

## Testing Strategy

Anchored on test-plan risks #12 (copy paths mint/lose identity), #13 (szablon leaks job data or loses
identity), #14 (katalog lies about itself). Pure logic (overlay, resolver, link planning) gets node
specs; the two write behaviours that cross action → DB (write-through, delete removing szablon rows)
get DB specs on 5435. No E2E: the risk is in SQL and actions, covered below the browser.

## Performance Considerations

The overlay adds one LEFT JOIN on an indexed PK to a ~300-row szablon read; kosztorys reads are
unaffected (join condition excludes them). The link script batches its UPDATEs (4000+ rows).

## Migration Notes

Additive column → migrate prod **before** push. Rollback: the column is ignored by old code; drop it
with the `down`.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (on request)
- `pnpm test:integration` (on request)

## References

- Research: `context/changes/2026-10-07-template-from-catalogue/research.md`
- Owner model and decisions: `context/changes/2026-10-07-template-from-catalogue/change.md`
- Prior rejection: `context/archive/2026-10-01-kosztorys-item-catalogue-link/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The remembered katalog entry

#### Automated

- [x] 1.1 Migration applies locally — 5481bdb84
- [ ] 1.2 insert-schema-drift spec passes
- [ ] 1.3 kosztorys-tree-sql-drift spec passes
- [ ] 1.4 Snapshot-format spec: missing field → null, present round-trips
- [ ] 1.5 Restore / seed drops dead katalog id, keeps live

### Phase 2: Link script

#### Automated

- [ ] 2.1 Link-planning spec (identical / differing mode / kosztorys cena / no match)
- [x] 2.2 Local dry-run prints counts, writes nothing

### Phase 3: Szablon reads and writes the katalog

#### Automated

- [ ] 3.1 Overlay spec
- [ ] 3.2 DB spec: write-through and rename refusal
- [ ] 3.3 Szablon column set without `note`

### Phase 4: Katalog prac — warnings and delete

#### Automated

- [ ] 4.1 DB spec: delete removes szablon rows, kosztorys row survives

### Phase 5: Kosztorys side — Aktualizuj, Zapisz jako szablon, id-first matching

#### Automated

- [ ] 5.1 Resolver spec
- [ ] 5.2 Save-state / save-action spec (rename → new + relink; update by id after katalog rename)
- [ ] 5.3 Save-as-szablon skips unlinked rows

### Phase 6: Prod transition and docs

#### Automated

- [ ] 6.1 No automated check — prose and runbook
