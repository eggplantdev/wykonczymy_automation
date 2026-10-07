# kosztorys-ai-knowledge-loop Implementation Plan

## Overview

Give the people who review an AI-drafted kosztorys a place to write down house knowledge and the
reasons for their corrections, so the agent can learn from them:

- **Komentarz do pracy** — one comment per katalog prac entry, shown in every kosztorys and szablon
  with that praca, never shown to the client.
- **Correction loop on the AI draft** — AI przedmiar (read-only), Status (manager's select, mostly
  set automatically), Powód zmiany, plus two row filters.
- **Two column toggles in the editor** — „Oferta" (a fixed offer column set) and „Przegląd AI"
  (shows / hides the AI columns on top of whatever is visible).

The spike on `spike/kosztorys-ai-knowledge-loop` (commits `ff635227..c57e9a21`) is the validated
reference for UX. It is **not** merged: this plan re-implements it on `staging` with every writer,
gate and test the spike skipped.

## Current State Analysis

Per `research.md` (still accurate for staging; the spike changed no staging code):

- The katalog (`work_catalogue_items`) has no comment field. The whole katalog already reaches the
  kosztorys and szablon editors client-side, so a `rowId → entry` lookup is a cheap `Map`
  (`build-catalogue-comparison.ts:158-182` pattern).
- Katalog writes rebuild full rows from `Omit<WorkCatalogueItemT, …>`-derived types
  (`work-catalogue/types.ts:30-33`, `write-catalogue-entry.ts:23-33`) — a new field naïvely added
  there wipes the comment on every „Zapisz do katalogu / nadpisz".
- Kosztorys items have no AI columns. About 10 writers would silently drop a new item column
  (tree SELECT, bulk INSERT, snapshot tolerant read, szablon serializer, sheet import, code-built
  items).
- Every investor / worker surface selects columns by allowlist, so new internal columns cannot leak
  unless someone edits an allowlist.
- Named column views already exist as **closed lists** (`closedColumnList`,
  `grid/column-selection.ts:72-79`) — preview, worker, workshop.

## Desired End State

- `/katalog-prac`: „Dodaj pracę" and „Edytuj pracę" have a „Komentarz do pracy" field; the table
  shows the comment (read-only). Saving the form keeps / updates the comment; no other katalog
  write ever clears it.
- Kosztorys and szablon editors: a „Komentarz do pracy" column (picker-hidden by default on a
  kosztorys, always present in the szablon workbench); clicking the cell opens the dialog that saves
  to the katalog entry. A row with no katalog match shows nothing and is not clickable.
- „Nowa praca" dialog: „Dodaj pracę do katalogu prac" ticked by default; the comment field sits
  under „Opis pracy" while it is ticked; a blank comment never erases an existing one.
- A kosztorys with any AI przedmiar (an „AI kosztorys"):
  - AI przedmiar, Status, Powód zmiany columns in the picker (hidden by default);
  - the Status follows the rules in Phase 2 when Przedmiar is typed, and picking Zaakceptowana /
    Odrzucona writes Przedmiar;
  - „do sprawdzenia" and „zmienione bez powodu" diagnostics in „Problemy" → „Przegląd AI";
  - the „Przegląd AI" toggle in the toolbar.
- A kosztorys without AI przedmiar looks exactly as today, plus the Komentarz do pracy column.
- „Oferta" toggle on every kosztorys (not the szablon): Opis, Przedmiar, j.m., Cena j.m.,
  Wartość netto przedmiar, at the client price plane.
- AI przedmiar / Status / Powód zmiany survive versions, restore and sheet re-import, and never
  travel into a szablon.
- None of the new columns reach podgląd, share link, PDF offer, worker link or worker PDF.

### Key Discoveries:

- `serialize-preset.ts:15-40` is the single funnel for every szablon write (seed, reload, append,
  save-as) — the one place to strip the per-job AI fields.
- `insert-rows.ts:21-39,127` is the single bulk item INSERT; the VALUES tuple needs `?? null` per
  column (the `sql` tag emits nothing for `undefined` and shifts placeholders).
  `insert-schema-drift.test.ts` (DB, `test:integration`) goes red on a migration without a list
  update.
- `snapshot-format.ts:110-130,160-179` — tolerant read; additive nullable columns need no
  `SNAPSHOT_SCHEMA_VERSION` bump (lessons: „Don't bump `SNAPSHOT_SCHEMA_VERSION`…").
- `sheet-import/build-import-plan.ts:218-245` carries `note` / `ref` for matched rows through
  `replaceTreeWithSnapshot`; anything not carried is wiped by a re-import.
- `workshop-columns.ts` — `WORKSHOP_VISIBLE_COLUMNS` is the szablon's closed list; a column is absent
  there until written in.
- `client-view/columns.ts`, `print/offer-columns.ts`, `worker-view/columns.ts`,
  `print/worker-columns.ts` — the allowlists; they must not change.
- `newItemFormSchema` extends the katalog form schema (`new-item-form-schema.ts:11-13`), so adding the
  field to the katalog schema once gives both forms the field.
- Payload Local API overrides access by default, so field-level `access.create/update: () => false`
  closes REST/admin writes of AI przedmiar while scripts still write it.

## What We're NOT Doing

- No agent pipeline and no app action that writes AI przedmiar — scripts only (owner, 2026-10-07).
  The prod fill (`fill-case-prod.ts`) belongs to the experiment change.
- No crew visibility of Komentarz do pracy — open question **EX-1011**.
- No reading of client view settings for „Oferta"; it is a fixed list (owner, 2026-10-07). No
  dependency on `offer-hides-remaining`.
- No extraction of a single "what the investor sees" function (research §3) — not needed by a fixed
  list.
- No comment history / authorship, no rules that belong to no single praca, no stored katalog origin
  on a position (opis-rewrite limit accepted, EX-780).
- No translation of the comment.
- E2E is not authored here — one scenario goes to the `e2e-backlog` (review gate).

## Implementation Approach

Three phases, one migration, one PR. Phase 1 (Komentarz do pracy) is useful without AI and lands
first. Phase 2 adds the AI item columns end to end — schema already in place from the migration —
through every tree writer. Phase 3 adds the two toolbar toggles on top of the column-selection
machinery. The spike's files are copied where they were right and corrected where the plan says so;
the spike-only migration and seed script are replaced.

## Critical Implementation Details

**Deploy order.** The migration is additive (new nullable columns + one enum type) → migrate prod
**before** the push (`pnpm db:migrate:prod`, human). Locally the spike migration
`20261006_0_add_ai_review_columns` is already applied to the 5433 DB with `review_status varchar`;
roll it back (`DROP COLUMN`s, delete its `payload_migrations` row) before applying the real one, or
the real migration's `IF NOT EXISTS` skips the enum column.

**Status and Przedmiar are one concept in two columns** (lessons: „Jedno pojęcie w dwóch kolumnach…").
They persist as two per-field patches. Every intermediate state is still a legal row (a status that
disagrees with Przedmiar is visible and fixable), so no atomic write is added; both patches come from
one `onChange` batch so one undo restores both.

**Cache key.** `WorkCatalogueItemT` widens → bump `['work-catalogue-v2']` → `v3`
(`src/lib/queries/work-catalogue.ts`), and every consumer reads `workNote ?? null`.

---

## Phase 1: Komentarz do pracy

### Overview

The katalog column, the migration for the whole change, the form field in all three forms, the
kosztorys / szablon column with the cell-click dialog, and the guarantee that no katalog write
clears a comment.

### Changes Required:

#### 1. Migration (whole change)

**File**: `src/migrations/<YYYYMMDD>_0_add_ai_review_columns.ts` (date of implementation; check
filename order against other sessions' uncommitted migrations), `src/migrations/index.ts`

**Intent**: One hand-written additive migration for both tables, so prod migrates once.

**Contract**:
- `work_catalogue_items.work_note varchar NULL`
- `kosztorys_items.ai_planned_qty numeric NULL`, `change_reason varchar NULL`,
  `review_status "enum_kosztorys_items_review_status" NULL` with
  `CREATE TYPE … AS ENUM('accepted','rejected','edited','added')` (Payload `select` → enum; copy the
  `CREATE TYPE` pattern from `20260903_0_add_equipment.ts`).
- `down` drops the columns and the type.

#### 2. Katalog data path

**Files**: `src/collections/work-catalogue-items.ts`, `src/lib/db/work-catalogue.ts`,
`src/lib/kosztorys/work-catalogue/types.ts`, `src/lib/queries/work-catalogue.ts`

**Intent**: Read and type the comment; keep it out of candidate/seed types so the „Zapisz do
katalogu" paths cannot write it.

**Contract**: collection field `workNote` (textarea, label „Komentarz do pracy"); `CATALOGUE_COLUMNS`
+ `toCatalogueItem` map `work_note`; `WorkCatalogueItemT.workNote: string | null`;
`CatalogueSeedItemT` / `CatalogueCandidateT` add `workNote` to their `Omit` (same reason as
`descriptionTranslations`, `types.ts:27-29`); cache key → `work-catalogue-v3`.

#### 3. Katalog writes

**Files**: `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts`,
`src/lib/actions/work-catalogue.ts`, `src/lib/actions/kosztorys.ts`

**Intent**: Three writers may set the comment; none may clear it by accident.

**Contract**:
- `applyCatalogueWrite(…, { …, workNote?: string })` — a non-blank value is written (trimmed); blank
  or absent leaves the stored comment untouched (spike behaviour, `c57e9a21`).
- `createCatalogueItemAction` / `updateCatalogueItemAction` take `workNote` from the form schema.
  Update writes it as given (blank → `null`): the edit form is seeded with the stored value, so a
  blank there is a deliberate clear.
- `updateCatalogueNoteAction(catalogueItemId, text)` — the cell dialog's own lane (spike, unchanged).
- `addItemAction` passes `catalogue.workNote` through (spike, unchanged).
- `saveItemToCatalogueAction` never sends a comment.

#### 4. Forms

**Files**: `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts`,
`work-catalogue-item-form.tsx`, `src/components/dialogs/edit-catalogue-item-dialog.tsx`,
`src/components/kosztorys/editor/dialogs/catalogue/catalogue-item-from-kosztorys-dialog.tsx`,
`src/components/kosztorys/editor/dialogs/new-item/new-item-form-schema.ts`, `new-item-form.tsx`

**Intent**: The comment is a field of the katalog form, so „Dodaj pracę", „Edytuj pracę" and „Nowa
praca" get it from one schema. Each form is seeded from the stored entry, never from a candidate.

**Contract**:
- `workCatalogueItemSchema` gains `workNote: string` (default `''`); the field renders right under
  „Opis pracy", label „Komentarz do pracy (wiedza firmowa — niewidoczna dla klienta)", 3 rows.
- Edit dialog seeds `workNote` from the item; `CatalogueItemFromKosztorysDialog.defaultsFrom` seeds it
  from `existing` (research hazard 3), empty for a new entry.
- `newItemFormSchema` drops the spike's `.extend({ workNote })`; keeps `addToCatalogue` default
  `true`; the field shows only while „Dodaj pracę do katalogu prac" is ticked; „Tylko do kosztorysu"
  drops it.

#### 5. Editor column + dialog

**Files**: `src/lib/kosztorys/work-catalogue/catalogue-entry-by-row.ts` (new, spike),
`src/components/kosztorys/editor/dialogs/catalogue/work-note-dialog.tsx` (new, spike),
`src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx` (new, spike — `workNoteColumn`
only in this phase), `kosztorys-v2-columns.tsx`, `kosztorys-v2-column-opts.ts`,
`use-kosztorys-editor.ts`, `src/lib/kosztorys/columns/column-config.ts`,
`src/lib/kosztorys/workshop-columns.ts`, `src/styles/globals.css`,
`src/components/tables/work-catalogue.tsx`

**Intent**: A `workNote` column reading the katalog live by opis + j.m.; clicking an editable cell
opens the dialog. Passed through column opts, never context (EX-496).

**Contract**:
- `catalogueEntryByRowId(rows, catalogue)` → `Map<rowId, { id, note }>`, built in the hook when the
  katalog is present and not in preview.
- Column `workNote`: `COLUMN_LABELS` (label above), `LAYER_NEUTRAL_COLUMNS`, `DEFAULT_HIDDEN_COLUMNS`;
  `WORKSHOP_VISIBLE_COLUMNS` gains `workNote` (comment explains: knowledge is curated in szablony).
- Editable when the editor is editable and the row has a match; the cell is not greyed when editable.
- Placed with the AI columns at the end of `dataColumns` (spike order); cyan AI styling
  (`kosztorys-ai-column`, spike `globals.css`).
- `/katalog-prac` table: „Komentarz do pracy" column, read-only, hidden by default
  (`WORK_CATALOGUE_DEFAULT_VISIBILITY`).

#### 6. Glossary

**File**: `context/domain/02-glossary.md`

**Intent**: Record the new names (EX-548): `workNote` = Komentarz do pracy (katalog), distinct from
`note` = Komentarz (pozycja); `aiPlannedQty` = AI przedmiar; `reviewStatus` = Status;
`changeReason` = Powód zmiany.

### Success Criteria:

#### Automated Verification:

- Migration applies on the local DB after the spike migration is rolled back: `pnpm payload migrate`
- Katalog write spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/write-catalogue-entry.test.ts` — blank / absent comment leaves the stored one; non-blank writes; candidate overwrite never touches it
- Katalog form DOM spec passes: `pnpm exec vitest run src/__tests__/components/forms/work-catalogue-item/work-catalogue-item-form.test.tsx` — field renders; edit seeds the stored comment
- „Nowa praca" DOM spec passes with the ticked default: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/new-item/new-item-dialog.test.tsx`
- Row lookup spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/catalogue-entry-by-row.test.ts` — match by opis + j.m., no match → absent, blank opis → absent
- Workshop columns spec passes with `workNote`: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/workshop-columns.test.ts`

#### Manual Verification:

- /katalog-prac → „Edytuj pracę" on a praca with a comment: the field shows it; change the price only and save — the comment is still there.
- /katalog-prac → „Dodaj pracę" with a comment: the new row shows it in the „Komentarz do pracy" column.
- Kosztorys → pick „Komentarz do pracy" in the column picker → click a cell of a katalog praca → write a comment → save: the same praca in another kosztorys and in a szablon shows it.
- A row whose opis is not in the katalog: the cell is empty and clicking does nothing.
- Row menu „Zapisz do katalogu" → „Nadpisz" on a praca with a comment: the comment survives.
- „Nowa praca": the katalog checkbox starts ticked, the comment field sits under „Opis pracy"; „Nadpisz w katalogu" with a blank field keeps the existing comment; „Tylko do kosztorysu" leaves the katalog untouched.
- Podgląd, share link, „Generuj ofertę" PDF and the worker link show no comment column.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do
**not** pause for per-phase manual confirmation.

---

## Phase 2: AI draft review

### Overview

AI przedmiar, Status and Powód zmiany on items, end to end: schema, every tree writer, grid columns,
status rules, the „AI kosztorys" gate, two diagnostics, and a local script to load a draft.

### Changes Required:

#### 1. Item schema + types

**Files**: `src/collections/kosztorys-items.ts`, `src/lib/kosztorys/types.ts`

**Intent**: Declare the three fields; make them required in the type so `tsc` lists every item
builder.

**Contract**:
- `aiPlannedQty` number, field `access: { create: () => false, update: () => false }` (only Local API
  scripts write it); `changeReason` text; `reviewStatus` select
  `accepted | rejected | edited | added`.
- `KosztorysItemT`: `aiPlannedQty: number | null` (NULL = agent never saw the row, 0 = agent left it
  out), `changeReason: string | null`, `reviewStatus: ReviewStatusT | null` — **required**, not
  optional (the spike's `?` hid the builders).
- `ItemPatchT` + `item-patch-schema.ts` + `ITEM_FIELDS` (`v2-rows.ts`) gain `changeReason` and
  `reviewStatus` only. `aiPlannedQty` stays out of all three — zod strips it, the grid cannot write it.

#### 2. Tree writers (`[DROP]` list from research §2)

**Files**: `src/lib/db/kosztorys-tree.ts`, `src/lib/kosztorys/insert-rows.ts`,
`src/lib/kosztorys/snapshot-format.ts`, `src/lib/kosztorys/serialize-preset.ts`,
`src/lib/kosztorys/sheet-import/build-import-plan.ts`,
`src/lib/kosztorys/sheet-import/parse-labor-tab.ts`, `src/lib/kosztorys/item-from-fields.ts`,
`src/lib/actions/accept-worker-report.ts`, `src/lib/kosztorys/work-catalogue/item-to-catalogue.ts`

**Intent**: Every path that reads or rebuilds an item carries or deliberately drops the three fields.

**Contract**:
- Tree SELECT + `mapItem` (`numOrNull` for AI przedmiar).
- `ITEM_INSERT_COLUMNS` + VALUES tuple with `?? null`.
- Snapshot tolerant read + `itemWithColumnDefaults` `?? null`; no schema-version bump.
- `serialize-preset.ts`: **strip** all three to `null` beside the zeroed `plannedQty`.
- Sheet import: matched rows carry all three; new rows `null`.
- Code-built items (`item-from-fields`, accepted worker extras, katalog candidate): `null`.

#### 3. Status rules + AI gate (pure)

**Files**: `src/lib/kosztorys/review-status.ts` (new), `src/lib/kosztorys/row-conditions/types.ts`,
`row-conditions/registry.ts`, `src/lib/kosztorys/problem-groups.ts`

**Intent**: React-free rules, testable in node.

**Contract**:
- `hasAiDraft(rows)` = any row with `aiPlannedQty !== null`.
- `effectiveReviewStatus(row, hasAiDraft)` = stored status, else `'added'` when `hasAiDraft`,
  `aiPlannedQty === null` and `plannedQty > 0`, else `null`.
- `applyReviewRules(next, prevById, hasAiDraft)` — no-op when `!hasAiDraft`. Status changed by the
  user (Przedmiar unchanged): Zaakceptowana → Przedmiar = AI przedmiar; Odrzucona → Przedmiar = 0
  (rows with an AI value only). Przedmiar typed (status unchanged):

  | AI przedmiar | typed Przedmiar | Status        |
  | ------------ | --------------- | ------------- |
  | > 0          | = AI            | Zaakceptowana |
  | > 0          | 0               | Odrzucona     |
  | > 0          | other           | Edytowana     |
  | 0 / empty    | > 0             | Dodana        |
  | 0 / empty    | 0               | (cleared)     |

- `RowConditionCtxT.hasAiDraft` (absent = no counter, `catalogueRowIds` precedent).
- Diagnostics in a new `ai-review` problem group „Przegląd AI": `ai-to-review` „do sprawdzenia"
  (AI > 0, no stored status), `ai-without-reason` „zmienione bez powodu" (effective status in
  Odrzucona / Edytowana / Dodana and blank reason). Both reveal the AI columns; both match nothing
  without `hasAiDraft`.

#### 4. Grid

**Files**: `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx`,
`kosztorys-v2-columns.tsx`, `kosztorys-v2-column-opts.ts`, `column-selection.ts`,
`use-kosztorys-editor.ts`, `src/lib/kosztorys/columns/column-config.ts`,
`src/lib/kosztorys/row-content-lines.ts`

**Intent**: The three columns, gated on `hasAiDraft`; the rules wired into `onChange`.

**Contract**:
- `aiPlannedQty`: read-only computed column. `reviewStatus`: `CellSelectMenu` (spike), shows the
  effective status; empty label „Do sprawdzenia" only when AI > 0. `changeReason`: long-text column
  copied from Komentarz, added to `WRAPPING_COLUMN_IDS`.
- Labels (spike): „AI przedmiar (na ile AI wyceniło pracę)", „Status", „Powód zmiany (co AI zrobiło
  źle)". All in `LAYER_NEUTRAL_COLUMNS` and `DEFAULT_HIDDEN_COLUMNS`.
- `BuildV2ColumnsOptsT.hasAiDraft`; without it the three ids are dropped from the grid and the picker.
- `onChange` runs `applyReviewRules` before diff/undo, so the derived Przedmiar / Status change is part
  of the same batch.

#### 5. Draft loader script

**File**: `src/scripts/load-ai-draft.ts` (replaces the spike's `spike-ai-draft.ts`)

**Intent**: Load an agent draft into a local kosztorys for review and testing.

**Contract**: `INV=<id> DRAFT=<path.json>` — JSON `[{ section, description, qty }]`; every item of the
investment gets `aiPlannedQty` (matched qty, else 0) through the Local API; status and reason reset.
Refuses a Neon URL (local only).

### Success Criteria:

#### Automated Verification:

- Status rules spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/review-status.test.ts` — the table above, select → Przedmiar, no-op without AI draft, effective „Dodana"
- AI diagnostics spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/ai-review-conditions.test.ts` — both match nothing without `hasAiDraft`
- Szablon strip spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts`
- Snapshot round-trip spec carries the three fields: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`
- Sheet import plan carries the fields for matched rows: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts`
- Patch schema strips AI przedmiar: `pnpm exec vitest run src/__tests__/lib/kosztorys/item-patch-schema.test.ts`
- Tree SQL drift spec passes: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-tree-sql-drift.test.ts`
- Insert schema drift (DB) passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/insert-schema-drift.test.ts`

#### Manual Verification:

- An AI kosztorys (draft loaded with the script): pick AI przedmiar, Status, Powód zmiany in the column picker; „Problemy" shows „Przegląd AI" with „do sprawdzenia" counting rows with AI przedmiar and no status.
- Type a Przedmiar equal to AI przedmiar → Zaakceptowana; type 0 → Odrzucona; another number → Edytowana; a number on a row with AI 0 → Dodana. Ctrl+Z restores Przedmiar and Status together.
- Status → Zaakceptowana copies AI przedmiar into Przedmiar; Odrzucona sets it to 0.
- „zmienione bez powodu": a row typing its first letter of Powód zmiany stays in the list until „Odśwież — ukryj poprawione".
- Add a praca with „Nowa praca" and a Przedmiar: it shows „Dodana" and appears in „zmienione bez powodu".
- Save a version, change things, restore: AI przedmiar, Status, Powód zmiany come back.
- Save the kosztorys as a szablon, seed a new kosztorys from it: no AI przedmiar / Status / Powód zmiany.
- An ordinary kosztorys (no draft): no AI columns in the picker, no „Przegląd AI" group, typing Przedmiar sets no status.
- Podgląd, share link, PDF offer, worker link: no AI columns.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do
**not** pause for per-phase manual confirmation.

---

## Phase 3: „Oferta" and „Przegląd AI" toggles

### Overview

Two transient toolbar toggles. „Oferta" swaps the grid to a fixed offer column set; „Przegląd AI"
adds or removes the AI columns on top of whatever is visible. They compose.

### Changes Required:

#### 1. Column sets

**File**: `src/lib/kosztorys/ai-review-columns.ts` (new)

**Intent**: Name both sets once.

**Contract**: `AI_REVIEW_COLUMN_IDS = ['aiPlannedQty', 'reviewStatus', 'changeReason', 'workNote']`;
`OFFER_VISIBLE_COLUMNS = { actions, description, plannedQty, unit, price, plannedNet }`.

#### 2. Selection

**Files**: `src/components/kosztorys/editor/grid/column-selection.ts`,
`kosztorys-v2-column-opts.ts`

**Intent**: „Oferta" is a fourth closed list; „Przegląd AI" is a forced-visible set that bypasses the
stored hidden map and the default-hidden set for the AI ids — never a write to either (lessons: „A
stored preference records the DEVIATION").

**Contract**: opts `offerVisible?: boolean`, `aiColumnsShown?: boolean`. Closed list under „Oferta" =
`OFFER_VISIBLE_COLUMNS ∪ (aiColumnsShown ? AI ids : ∅)`. Without „Oferta", `aiColumnsShown` forces the
AI ids visible. `hasAiDraft === false` still drops the three AI item columns (Komentarz do pracy stays).
Preview / worker / workshop closed lists win over both toggles.

#### 3. Editor state + toolbar

**Files**: `use-kosztorys-editor.ts`, `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`,
`toolbar/kosztorys-view-menu.tsx`

**Intent**: Two `useState` toggles, inactive in preview and szablon. „Oferta" pins the price plane to
`client` as a derived overlay (spike pattern, never written to the stored view) and hides the price
toggle while on.

**Contract**: „Oferta" button on every kosztorys; „Przegląd AI" `variant="ai"` button only when
`hasAiDraft` (spike styling); the view menu's hidden-count badge stays correct under a closed list.

### Success Criteria:

#### Automated Verification:

- Selection spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/ai-review-toggles.test.ts` — „Oferta" alone = 6 ids; „Oferta" + „Przegląd AI" = 6 + AI ids; „Przegląd AI" alone shows AI ids despite a stored hide; no AI item ids without `hasAiDraft`; preview ignores both

#### Manual Verification:

- „Oferta" on any kosztorys: only Opis, Przedmiar, j.m., Cena j.m., Wartość netto przedmiar (+ Akcje), prices at the client plane, the price toggle gone; off restores the previous columns and plane.
- „Przegląd AI" on an AI kosztorys adds the four AI columns to the current set; off removes them; the column picker ticks are unchanged afterwards.
- Both on: offer columns + AI columns.
- Ordinary kosztorys: no „Przegląd AI" button; szablon: neither button.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- Status rules table, select-writes-Przedmiar, no-op without AI draft, effective „Dodana".
- Diagnostics gated on `hasAiDraft`.
- Writers: szablon strip, snapshot round-trip, import carry-over, patch schema strip, katalog writes
  never clearing the comment.
- Column selection for both toggles.

### Integration Tests:

- `insert-schema-drift.test.ts` and `kosztorys-tree-sql-drift.test.ts` (DB) catch a missed column.
- E2E (filed to `e2e-backlog` at the review gate): load a draft → accept / edit rows → reload →
  statuses and Przedmiar persisted.

### Manual Testing Steps:

Per phase above. Setup: local 5433 DB, `INV=<id> DRAFT=<json> node --env-file=.env --conditions=react-server --import tsx src/scripts/load-ai-draft.ts`.

## Migration Notes

Additive: migrate prod before the push (human, `pnpm db:migrate:prod`). Locally roll back the spike
migration first (see Critical Implementation Details). Golden master and render parity hash no item
column touched here.

## Whole-tree Gate

- Type checking passes: `pnpm exec tsc --noEmit -p .`
- Linting passes: `pnpm lint`
- Unit + DOM suite passes: `pnpm test`
- DB integration suite passes: `pnpm test:integration`

## References

- Research: `context/changes/2026-10-06-kosztorys-ai-knowledge-loop/research.md`
- Spike: branch `spike/kosztorys-ai-knowledge-loop`, commits `ff635227..c57e9a21`
- Template for a new item column end to end: commit `434a1e76` (`ref`)
- Open question: EX-1011 (crew visibility of Komentarz do pracy)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Komentarz do pracy

#### Automated

- [x] 1.1 Migration applies on the local DB after the spike migration is rolled back
- [x] 1.2 Katalog write spec passes
- [x] 1.3 Katalog form DOM spec passes
- [x] 1.4 „Nowa praca" DOM spec passes with the ticked default
- [x] 1.5 Row lookup spec passes
- [x] 1.6 Workshop columns spec passes with workNote

### Phase 2: AI draft review

#### Automated

- [ ] 2.1 Status rules spec passes
- [ ] 2.2 AI diagnostics spec passes
- [ ] 2.3 Szablon strip spec passes
- [ ] 2.4 Snapshot round-trip spec carries the three fields
- [ ] 2.5 Sheet import plan carries the fields for matched rows
- [ ] 2.6 Patch schema strips AI przedmiar
- [ ] 2.7 Tree SQL drift spec passes
- [ ] 2.8 Insert schema drift (DB) passes

### Phase 3: „Oferta" and „Przegląd AI" toggles

#### Automated

- [ ] 3.1 Selection spec passes
