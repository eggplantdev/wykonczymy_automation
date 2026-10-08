# Wiedza firmowa — Implementation Plan

## Overview

A book of company rules („Wiedza firmowa”) that management opens in one click from anywhere. It is a
dialog with entries made of a topic and a text, kept in the order management drags them into, with
search and two other sorts on top. The design was settled on a click-through spike
(`src/components/company-knowledge/`, in-memory data). The AI draft agent reads every entry, plus the
katalog's „Komentarz do pracy” notes, before drafting a przedmiar. EX-1032.

## Current State Analysis

- Company knowledge exists in two places today:
  - **„Komentarz do pracy”** on a katalog entry (`work-catalogue-items.workNote`) holds knowledge
    about one praca.
  - **General rules** that belong to no single praca live only as prose in the AI-tests procedure
    (`context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md:256-289`). The app has
    nowhere to keep them; `kosztorys-ai-knowledge-loop` left this gap out of scope on purpose.
- The agent cannot read either source through a script:
  - Case scripts dump only the rozpiska (`scripts/new-case-prod.ts:93-106`).
  - The procedure says the agent „must read” the katalog notes (`change.md:253`) but gives no way to.
- The agent's case scripts reach production only through the app
  (`scripts/prod-client.ts`: the Payload REST API plus server actions, with a session token). The
  database is never touched, so the knowledge read path must be the REST API.

## Desired End State

- Management sees a „Wiedza firmowa” button in the top bar on desktop, and a matching entry in the
  mobile menu on a phone. It opens a dialog that lists every entry in its own order (the order
  management set by dragging). From there they can:
  - search the topics and texts, ignoring case and Polish letters;
  - sort by „Własna kolejność” (default), „Alfabetycznie” or „Ostatnio zmienione”;
  - drag an entry by its grip to a new place, in „Własna kolejność” with no search typed;
  - add, edit and delete entries.
- EMPLOYEE sees neither button, and the server refuses EMPLOYEE both read and write.
- The general rules from the AI-tests procedure are entries from day one, the wall-height rule among
  them.
- Before drafting, a case script writes `inputs/wiedza-firmowa.md`: every book entry plus every
  katalog note. The procedure tells the agent to read that file and to cite the entry by name in
  „Co / ile założono”.

### Key Discoveries:

- `src/collections/work-catalogue-items.ts:16-25` is the collection shape to copy: management access
  on all four operations, revalidation hooks keyed on a `CACHE_TAGS` name.
- `src/migrations/20260901_0_add_work_catalogue_items.ts` is the migration to copy. It includes the
  `payload_locked_documents_rels` column, without which Payload's lock check throws.
- The action and query patterns to copy:
  - `updateCatalogueNoteAction` (`src/lib/actions/work-catalogue.ts:118`) shows the action pattern.
    `protectedAction` already refuses roles outside management and expires the tag.
  - `getWorkCatalogue` (`src/lib/queries/work-catalogue.ts:22`) is a cached query with no arguments.
- `TrashButton` / `AdminButton` hide themselves with `useCurrentUser()` + `isManagementRole`
  (`src/components/nav/trash-button.tsx:18-21`). The mobile menu relies on the same self-hiding
  (`mobile-nav.tsx:140-141`).
- The mobile drawer sits at `z-10002` and the dialog at `z-10000` (`src/components/ui/dialog.tsx:36,62`).
  A dialog opened from the drawer would render under it unless the drawer closes first.
- `TopNav`'s right-hand group (`src/components/nav/top-nav.tsx:24`) is where the desktop trigger goes.
- The spike already uses the repo's primitives, and the real dialog keeps them:
  - `SearchFilterInput` (`src/components/filters/search-filter-input.tsx`);
  - `SimpleSelect` with `variant="toolbar"`;
  - `EditButton` / `DeleteButton` (`src/components/ui/row-actions/`) + `ConfirmDialog`;
  - `DialogActions` for the inline form's Anuluj / Zapisz, and `EmptyState`;
  - `foldText` (`src/lib/utils/fold-text.ts`) for the search.
- Drag reordering copies `src/components/ui/column-order-dialog.tsx`: framer-motion `Reorder.Group`
  inside a `motion.div layoutScroll`. Each row (`knowledge-entry-row.tsx`) uses `useDragControls`, so
  only the grip starts a drag and the text stays selectable.
- `applyLayout` (`src/lib/db/kosztorys-layout.ts:42`) is the bulk-order write to copy: one `UPDATE … FROM
(VALUES (id, ord), …)`. It also bumps `updated_at`, which this change must **not** copy (see
  Critical Implementation Details).

## What We're NOT Doing

- No `/kosz` entry. Deletion is permanent after a confirm, like the katalog prac and magazyny (owner,
  2026-10-08).
- No categories, author or history.
- No server-side search. The whole book is loaded when the dialog opens (tens of entries, not
  thousands), so search and sorting run on the client.
- Katalog notes are not moved into the book. Knowledge about one praca stays in „Komentarz do pracy”,
  and the book takes only rules that belong to no single praca. The seed therefore skips every rule
  the katalog already holds (#158, #169, #172, #178, #677, #689, #840, #890, #905, #930, #947).
- The agent never writes to the book.
- The AI cases already analysed are not re-run here. That follows once the book exists, as a separate
  step.

## Implementation Approach

Build it like the katalog prac: a Payload collection, cached reads, and writes through
`protectedAction`. The client fetches the entries when the dialog opens, through a `'use server'`
query in `src/lib/queries`, so pages don't load the book on every render. A single self-hiding
trigger component (`CompanyKnowledgeButton`) owns the dialog and is placed twice, in the top bar and
in the mobile menu. The agent's read path is a new script beside the existing case scripts that uses
the same REST session.

The spike's `company-knowledge-button.tsx` and `knowledge-entry-row.tsx` are the starting point for the
real dialog. Phase 3 rewires them from component state to the query and actions and deletes
`spike-entries.ts`.

## Critical Implementation Details

- **Mobile drawer stacking:** the drawer (`z-10002`) sits above the dialog (`z-10000`). The menu entry
  must close the drawer when it opens the dialog. Pass an `onOpen` callback from `MobileNav`
  (`setOpen(false)`), not a z-index bump. The dialog portals to `body`, so closing the drawer does not
  unmount it.
- **A reorder does not touch `updated_at`.** „Ostatnio zmienione” sorts on `updatedAt`. If a drag
  bumped it, as `applyLayout` does, one drag would make every entry look freshly edited. The reorder
  statement writes `display_order` only.
- **A new entry goes to the top** of its own order (`min(display_order) - 1`), matching the spike, so
  the entry just written is visible without scrolling.
- **Two managers at once:** the reorder writes the order of the ids it is sent and nothing else. An
  entry someone else added in the meantime keeps its own place, and an id deleted in the meantime
  matches no row. No permutation check is needed: the worst case is one entry sitting out of place
  until the next drag.
- **Deploy order:** the migration is additive (a new table plus seed rows), so prod is migrated
  **before** the push (AGENTS.md, Migrations). A human runs it.

## Phase 1: Collection, migration and seed

### Overview

Create the table, register the collection, and seed the general rules.

### Changes Required:

#### 1. Collection

**File**: `src/collections/company-knowledge.ts` (new), registered in `src/payload.config.ts`

**Intent**: the record type behind the book.

**Contract**:

- Slug `company-knowledge`.
- Labels pl „Wpis wiedzy firmowej” / „Wiedza firmowa”.
- `useAsTitle: 'topic'`.
- Fields:
  - `topic` (text, required, pl „Temat”);
  - `content` (textarea, required, pl „Treść”);
  - `displayOrder` (number, required, `defaultValue: 0`, like `kosztorys-sections.ts:32`).
- `defaultSort: 'displayOrder'`.
- Access: `isAdminOrOwnerOrManager` on read, create, update and delete.
- Hooks: `makeRevalidateAfterChange('companyKnowledge')` / `makeRevalidateAfterDelete`.

#### 2. Cache tag

**File**: `src/lib/cache/tags.ts`

**Intent**: give the book's cache entry and its writers a shared name.

**Contract**: `CACHE_TAGS.companyKnowledge = 'collection:company-knowledge'`.

#### 3. Migration with seed

**File**: `src/migrations/20261008_3_add_company_knowledge.ts` (new) plus its entry in
`src/migrations/index.ts`

**Intent**: create `company_knowledge` and insert the starting entries in one step, so production
gets a full book from `db:migrate:prod`.

**Contract**:

- Copy `20260901_0`: the table (`id`, `topic`, `content`, `display_order integer NOT NULL DEFAULT 0`,
  `updated_at`, `created_at`) plus the
  `payload_locked_documents_rels.company_knowledge_id` column and its index.
- The `INSERT` runs only while the table is empty (`WHERE NOT EXISTS`), so a re-run cannot duplicate
  rows.
- `down` drops the column, then the table.
- Seed entries (Polish, with these topics and contents). `display_order` follows the table order
  (0–8). The spike's other entries are not seeded: ids 6–19 are rules the katalog already holds, and
  ids 20–25 were made up to fill the list.

| Temat                                            | Treść                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wysokość pomieszczeń, gdy rysunek jej nie podaje | Stan deweloperski: 2,68 m w świetle. Rynek wtórny: 2,60 m. Wysokość wydrukowana na rysunku (Hpom) zawsze wygrywa. W „Co / ile założono” podaj, którą przyjęto.                                                                                                                                                                                                              |
| Otwory w glazurze — ile na przybór               | WC: 5 (przycisk + 2 śruby + kanalizacja + dopływ). Prysznic: 2–3 przy baterii podtynkowej (zależnie od modelu), 2 przy natynkowej. Umywalka z baterią podtynkową: 3 (2 + odpływ). Grzejnik: 2 (zasilanie + powrót). Puszka elektryczna: 1 na każdą — zwykle 2 przy lustrze (włącznik + gniazdko), plus 1 na pralkę, jeśli projekt ma ją w łazience. Kratka wentylacyjna: 1. |
| Glazura — co liczyć z metrażu płytek             | m² ścian = płytki ścienne, m² podłogi = płytki podłogowe. Fugowanie i folia w płynie = suma wszystkich płytek, zawsze. Taśma hydroizolacyjna: obwód podłogi + narożniki strefy mokrej, ok. 15 mb na łazienkę 4 m². Silikonowanie: ok. 20–30 mb na łazienkę.                                                                                                                 |
| Malowanie i gładź                                | W łazience maluje się tylko ściany bez płytek — sprawdź każdą ścianę osobno i licz malowanie z gładzią. Gładź pomija ściany za szafkami kuchennymi.                                                                                                                                                                                                                         |
| Szlifowanie płytek na 45°                        | Z projektu: każdy narożnik zewnętrzny (np. pion) to jego wysokość × 2, do tego zabudowy (skrzynka baterii podtynkowej, półka z LED). Przy wątpliwościach nie zawyżaj — oznacz do weryfikacji.                                                                                                                                                                               |
| Bruzdy wod-kan w łazience                        | Ok. 2 mb na jedną łazienkę.                                                                                                                                                                                                                                                                                                                                                 |
| Demontaże — kwota wg ilości pracy                | WC + prysznic + umywalka + drzwi: 700 zł.                                                                                                                                                                                                                                                                                                                                   |
| Malowana ściana nad starymi płytkami             | Przed nowymi płytkami trzeba ją zerwać — to osobna pozycja.                                                                                                                                                                                                                                                                                                                 |
| Przesunięcie otworu drzwiowego z nadprożem       | To droga praca — cena musi to odzwierciedlać.                                                                                                                                                                                                                                                                                                                               |

### Success Criteria:

#### Automated Verification:

- Migration applies locally: `pnpm exec payload migrate` (run `git status src/migrations` first, because the tree is shared)
- Types regenerate: `pnpm generate:types`
- 9 seed rows exist: `psql postgresql://postgres:postgres@localhost:5433/wykonczymy-db -c 'select count(*) from company_knowledge'`

#### Manual Verification:

- (covered by Phase 3's dialog checks)

---

## Phase 2: Reads and writes

### Overview

The cached read for the dialog and the three mutations.

### Changes Required:

#### 1. Query

**File**: `src/lib/queries/company-knowledge.ts` (new)

**Intent**: a client component calls it when the dialog opens. It is a `'use server'` read, so per
AGENTS.md it lives in `lib/queries`, not `lib/actions`.

**Contract**:

- `fetchCompanyKnowledge(): Promise<CompanyKnowledgeEntryT[]>`.
- It requires a management session and returns `[]` (or refuses) for any other role.
- The data comes from one argument-free `unstable_cache` entry tagged `CACHE_TAGS.companyKnowledge`,
  sorted by `display_order, id`.
- `CompanyKnowledgeEntryT = { id, topic, content, updatedAt }`, defined in
  `src/components/company-knowledge/types.ts`.

#### 2. Actions

**File**: `src/lib/actions/company-knowledge.ts` (new)

**Intent**: create, update and delete through `protectedAction`, which already refuses EMPLOYEE.

**Contract**:

- `createCompanyKnowledgeAction({ topic, content })` writes `displayOrder` as the current minimum − 1.
- `updateCompanyKnowledgeAction(id, { topic, content })`.
- `deleteCompanyKnowledgeAction(id)`.
- `reorderCompanyKnowledgeAction(ids: number[])` calls the statement below.
- Zod requires `topic` and `content` to be non-empty after trimming, and `ids` to be a non-empty
  array of distinct positive integers.
- All four revalidate `['companyKnowledge']`.

#### 3. Reorder statement

**File**: `src/lib/db/company-knowledge.ts` (new)

**Intent**: write a whole new order in one statement. It is a single `UPDATE`, so per AGENTS.md it
belongs in `lib/db`.

**Contract**:

- `applyCompanyKnowledgeOrder(db, ids)`:
  `UPDATE company_knowledge AS k SET display_order = v.ord FROM (VALUES (id, index), …) AS v(id, ord)
WHERE k.id = v.id`.
- It leaves `updated_at` alone.

### Success Criteria:

#### Automated Verification:

- Node spec `src/__tests__/lib/actions/company-knowledge.test.ts` passes: an empty topic or content after trimming is refused, an EMPLOYEE session is refused, and a duplicate or empty `ids` list is refused (`pnpm exec vitest run src/__tests__/lib/actions/company-knowledge.test.ts`)

#### Manual Verification:

- (covered by Phase 3)

---

## Phase 3: Dialog and triggers

### Overview

The dialog itself and its two entry points.

### Changes Required:

#### 1. Dialog

**Files**: `src/components/company-knowledge/company-knowledge-dialog.tsx` (new, cut out of the spike's
`company-knowledge-button.tsx`), `src/components/company-knowledge/knowledge-entry-row.tsx` (the
spike's row, kept); `spike-entries.ts` deleted.

**Intent**: the spike's dialog, unchanged to the eye, now backed by the server.

**Contract**:

- It loads through `fetchCompanyKnowledge` when it opens, and holds the list in local state.
- Toolbar:
  - `SearchFilterInput` filters on `foldText(topic + content)`.
  - `SimpleSelect variant="toolbar"` offers „Własna kolejność” (default), „Alfabetycznie” (topic,
    `localeCompare(…, 'pl')`) and „Ostatnio zmienione” (`updatedAt` descending).
  - „Dodaj wpis” (with a `Plus` icon) opens an empty form at the top.
- Rows:
  - Each row is a bordered card (`bg-card border-border`) showing the topic and the text.
  - `EditButton` turns a row into the inline form: a topic input and a textarea, with
    `DialogActions` „Anuluj” / „Zapisz”. „Zapisz” stays disabled until both fields have text.
  - `DeleteButton` opens `ConfirmDialog` („Usunąć wpis „<temat>”?”) before deleting.
  - Only one form is open at a time.
- Dragging:
  - The grip shows only in „Własna kolejność” with no search typed, and not while a form is open.
    Otherwise a one-line hint says where dragging works.
  - The order is held locally during the drag and sent to `reorderCompanyKnowledgeAction` on drop.
  - If the action fails, the previous order comes back and a toast says so.
- Every write updates the local list at once. Failures go through `settleAction` + `toastMessage`,
  as in `work-note-dialog.tsx`, and a failed write restores the previous list.
- Empty states use `EmptyState`: „Brak wpisów”, or „Nic nie pasuje do wyszukiwania” while a search
  is typed.
- It is full-screen on a phone (the existing `DialogContent` behaviour) and wide on desktop
  (`sm:max-w-2xl`).

#### 2. Trigger

**File**: `src/components/company-knowledge/company-knowledge-button.tsx` (new)

**Intent**: one self-hiding trigger placed in both spots.

**Contract**:

- `CompanyKnowledgeButton({ onOpen?, className? })` returns `null` unless
  `isManagementRole(useCurrentUser().role)`.
- It owns the dialog's `open` state and calls `onOpen` when it opens. The spike already has this
  shape; only the dialog body moves out.
- It uses a `BookOpen` icon with the label „Wiedza firmowa”.

#### 3. Placement

**Files**: `src/components/nav/top-nav.tsx`, `src/components/nav/mobile-nav.tsx`

**Intent**: one click from anywhere.

**Contract**:

- In the top bar it goes first in the right-hand group, desktop only (`max-sm:hidden`). Unlike the
  transfer dialogs, it does not depend on `referenceData`.
- In the mobile menu it goes beside `TrashButton` with `onOpen={() => setOpen(false)}`.

#### 4. Phone-scope exception

**File**: `AGENTS.md` (Stack Notes, phone scope)

**Intent**: record the third deliberate phone exception.

**Contract**: add „**And a third (EX-1032):** „Wiedza firmowa” in the mobile menu — management reads
the rules on site; the dialog is checked at 390px.” While editing that line, also correct the stale
„no `/admin` link in the mobile menu”, because `mobile-nav.tsx:140` renders `AdminButton`. Check git
for the intent before rewording it.

### Success Criteria:

#### Automated Verification:

- DOM spec `src/__tests__/components/company-knowledge/company-knowledge-button.test.tsx` passes: nothing renders for EMPLOYEE; for MANAGER the button opens the dialog with the entries in their own order, and shows „Brak wpisów” when there are none; „lazienka” finds an entry with „Łazienka” in its text; under „Alfabetycznie” no grip renders (`pnpm exec vitest run src/__tests__/components/company-knowledge/company-knowledge-button.test.tsx`)

#### Manual Verification:

- Desktop, as OWNER or MANAGER: „Wiedza firmowa” sits in the top bar on any page (transakcje, katalog prac, the kosztorys editor). Clicking it shows the starting entries, with „Wysokość pomieszczeń…” first.
- Drag an entry to another place by its grip. The new order holds after a reload, and „Ostatnio zmienione” does not move the dragged entries to the top.
- Type „lazienka” in the search box: only entries mentioning „łazienka” stay. While anything is typed, or under „Alfabetycznie”, no grip shows.
- Edit an entry, then pick „Ostatnio zmienione”: that entry comes first.
- Add an entry, edit its text, then delete it after the confirm. Each step shows at once and survives a page reload.
- Saving with an empty topic or text is refused with a message, and nothing is written.
- Phone at 390px: menu → „Wiedza firmowa” closes the menu and opens the dialog full-screen; the text is readable and the buttons reachable. The top bar shows no second button.
- As EMPLOYEE: no button in the top bar or in the mobile menu.

---

## Phase 4: The agent's read path

### Overview

The agent gets the book and the katalog notes in its case inputs.

### Changes Required:

#### 1. Dump script

**File**: `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/dump-knowledge-prod.ts` (new)

**Intent**: write everything the agent must know before drafting into one file per case.

**Contract**:

- Run as `TOKEN_FILE=… CASE=… node --import tsx …/dump-knowledge-prod.ts`.
- It reads through `prod-client.ts`'s `api()`:
  - `/company-knowledge?limit=0&sort=displayOrder&depth=0`, in the order management set
  - `/work-catalogue-items?where[workNote][exists]=true&limit=0&depth=0`
- It writes `cases/<CASE>/inputs/wiedza-firmowa.md` with two sections:
  - „Wiedza firmowa”: `### <temat>` + text per entry.
  - „Komentarze do prac z katalogu”: `### <opis> [<j.m.>]` + note per entry.
- The file is a new one; the other session's `new-case-prod.ts` stays untouched.

#### 2. Procedure

**File**: `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md`

**Intent**: the agent reads the file, and the prose rules stop being a second source.

**Contract**:

- Method step 4 adds „run `dump-knowledge-prod.ts`, read `inputs/wiedza-firmowa.md` in full before
  choosing a position or a quantity, and name the entry an assumption comes from in „Co / ile
  założono”.”
- The house-knowledge section (`:256-289`) gets a line saying these rules now live in „Wiedza
  firmowa” (migration `20261008_3`), and that the book wins where they differ.

### Success Criteria:

#### Automated Verification:

- No automated check for this phase; the script is run by hand against production with a session (see Manual).

#### Manual Verification:

- Running the script for a case writes `inputs/wiedza-firmowa.md` with every entry from the dialog and every katalog note. An entry added in the dialog appears on the next run.

---

## Testing Strategy

### Unit Tests:

- The action spec (Phase 2) covers validation and the role refusal. Assert on what was refused, not
  on the return message.
- The claim that a reorder does not bump `updated_at` is a single SQL statement. Phase 3's drag check
  covers it, so no DB-backed spec is added for one line.

### Component Tests:

- The button spec (Phase 3) covers EMPLOYEE hiding, the dialog opening with the entries, the empty
  state, the Polish-letter search and the grip disappearing outside „Własna kolejność”. The query is
  stubbed with `vi.mock`.
- Dragging itself is not unit-tested: jsdom has no layout, so framer-motion's reorder cannot run
  there. The manual check covers it.

### Manual Testing Steps:

1. As OWNER on desktop: open, add, edit and delete an entry, and reload after each step.
2. Drag an entry, reload, and check the order and „Ostatnio zmienione”.
3. Search with and without Polish letters.
4. At 390px: open from the menu, check the drawer closes and the dialog is usable.
5. As EMPLOYEE: no entry point anywhere.
6. Run the dump script for a case and read the file.

## Migration Notes

- The migration is additive. Prod is migrated by a human with `pnpm db:migrate:prod` before the push
  that ships the code.
- The seed runs only while the table is empty, so a local re-run after `db:import` (which brings the
  table back empty or missing) re-seeds it, and a prod re-run is a no-op.

## Whole-tree Gate

Run once, after the final phase:

- `pnpm typecheck`
- `pnpm lint`

The full suite is not run unasked (owner rule); the touched specs are listed per phase.

## References

- Owner decisions: `context/changes/2026-10-08-company-knowledge/change.md`
- Collection analogue: `src/collections/work-catalogue-items.ts`
- Migration analogue: `src/migrations/20260901_0_add_work_catalogue_items.ts`
- Reorder analogues: `src/components/ui/column-order-dialog.tsx` (UI),
  `src/lib/db/kosztorys-layout.ts:42` (bulk order write)
- The spike: `src/components/company-knowledge/`
- Action/dialog analogue: `src/lib/actions/work-catalogue.ts:118`,
  `src/components/kosztorys/editor/dialogs/catalogue/work-note-dialog.tsx`
- The rules being seeded: `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md:256-289`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Collection, migration and seed

#### Automated

- [x] 1.1 Migration applies locally — c15fd7ae2
- [x] 1.2 Types regenerate — c15fd7ae2
- [x] 1.3 9 seed rows exist — c15fd7ae2

### Phase 2: Reads and writes

#### Automated

- [x] 2.1 Action spec passes

### Phase 3: Dialog and triggers

#### Automated

- [ ] 3.1 Button/dialog DOM spec passes

### Phase 4: The agent's read path

#### Automated

- [ ] 4.1 No automated check (manual run against production)
