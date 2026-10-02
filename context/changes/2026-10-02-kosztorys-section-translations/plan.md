# Section name translations (UA/RU) on the worker report link — Implementation Plan

## Overview

On `/zgloszenie-prac/…`, a worker set to Українська or Русский reads section names in their
language, next to the opisy EX-948 already translates. The translations sit in **one shared list
keyed by the normalised Polish name**. A manager fixes an entry from the section band menu, and the
list ships pre-filled with the names in use today. Linear: **EX-965**.

## Current State Analysis

- `translateTree` (`src/lib/kosztorys/worker-report/translate-tree.ts:8-20`) is the single swap point
  on the report page. It rewrites `item.description` and leaves `section.name` Polish. The band
  (`section-header-cell.tsx:144-157`), the „Razem …" footer (`section-footer-cell.tsx:42-45`), the
  itemless bands (`kosztorys-editor-body.tsx:333`) and the search (`row-view.ts:14`) all read the
  name from that tree. Rewriting `section.name` there covers all four.
- Its only caller is `report-grid.tsx:72`. The language switches on the client, without a
  server round-trip (`translations-provider.tsx`). So the page has to ship every language's text,
  not only the active one.
- `getWorkerReportPage` (`src/lib/queries/worker-report-page.ts:33-62`) is the page's whole read and
  is deliberately uncached. The tree inside it comes from a cached entry
  (`worker-kosztorys-data-v3`), whose tags we leave alone.
- Sending copies the Polish name from the **server** tree (`src/lib/actions/worker-report.ts:42-65`).
  A client-side swap never reaches it, so the manager's review is unchanged.
- The section band menu (`grid/menus/kosztorys-section-actions-menu.tsx`) is rendered only when
  `actions` is defined. That makes it absent on every read-only surface: the report link, `/p`,
  „Podgląd pracownika", `/k`, history and a locked investment. It does render in the szablon editor.
- The vocabulary is small. The local DB has 24 distinct names, which become **22 keys** once the
  number placeholder is applied (the query is in `research.md`). Almost all of them come from the
  szablon, plus the spelling variants left by its 2026-09-23 rewording.

## Desired End State

- A worker on the report link, set to UA or RU (or switched to it), sees every section band, every
  „Razem <sekcja>" and the search hits in that language. „Łazienka 2" reads „Ванна кімната 2" with
  the number kept. A name with no entry stays Polish.
- A manager opens „Tłumaczenie sekcji…" from a section's menu in the rozpiska or szablon editor, sees
  the current UA and RU text (numbers already filled in for this section) and saves. The fix applies
  on every rozpiska carrying that name, future ones included.
- The report a worker sends, the manager's editor and every other surface are unchanged.

### Key Discoveries:

- No existing normaliser fits. `sqlNameKey` (`section-target.ts:11`) does not collapse spaces, and
  `fold()` strips diacritics, which would merge „łazienka" with „lazienka". A new pure helper is
  needed (research gap agent).
- `stripSectionOrdinal` (`work-catalogue/section-category.ts:4`) is a trailing-only ordinal rule for
  katalog categories. Our rule covers a standalone number anywhere, so it is a separate function.
  Don't reuse or change that one.
- Every action writing a global list goes through `protectedAction(label, handler, [tag])`, which is
  MANAGEMENT_ROLES (`run-action.ts:84`). Pattern: `src/lib/actions/work-catalogue.ts:88-99`.
- A client-invoked read is a `'use server'` function in `src/lib/queries`, guarded by
  `requireAuth(MANAGEMENT_ROLES)` (`src/lib/queries/register-balance.ts`).
- The global cached read pattern is `getWorkCatalogue` (`src/lib/queries/work-catalogue.ts:20-27`).
- Dialog pattern: `SaveItemToCatalogueDialog` (`dialogs/catalogue/save-item-to-catalogue-dialog.tsx`):
  `FormDialogShell` + `useState` + `settleAction` + `toastMessage`, mounted from a menu's local
  state. Fetch-on-open: `use-catalogue-save-preview.ts`.
- Raw tables need no Payload registration (`kosztorys_snapshots`, `worker_reports`). The latest
  migration is `20261001_2_vehicles_equipment_trashed_at.ts`, registered at `src/migrations/index.ts:113`
  and `:677-679`.

## What We're NOT Doing

- `/p`, „Podgląd pracownika" and the worker PDF. That is **EX-966**, which reuses this lookup.
- Etapy and units: etapy stay as typed (owner, 2026-10-01).
- A „Sekcje bez tłumaczenia" problem in „Problemy". EX-948's reason applies here too
  (`registry.ts:561-563`): most rozpiski never reach a crew that needs one.
- A list page for the translations, and a fill script. A name that appears later is filled in the
  dialog.
- Merging or cleaning up the old szablon spelling variants. Each spelling gets its own entry.
- Any stale or out-of-date state. A rename simply looks up the new name.
- Showing translations anywhere in the manager's editor apart from the dialog.

## Implementation Approach

A raw table `kosztorys_section_translations` (`name_key` primary key, `translations jsonb`), created
and seeded by one additive migration. A pure module owns the three rules: the key, typed text →
stored template, and template → displayed name. The DB layer, a tag-cached whole-list read and one
manager action sit on top. The report page loads the list beside its other reads and passes it to
`translateTree`. The manager's dialog fetches its one entry when it opens, so nothing new threads
through the editor's props or context.

**Placeholder rule.** A _standalone number_ is a run of digits bounded by whitespace or the string
edges. `230V` and `c.o.` are text. The key replaces each standalone number with `#`. The stored
translation is a template with the same `#`s, and rendering puts the section's own numbers back in
order. In the dialog the manager types real numbers. On save, the numbers in the translation must
equal the name's numbers, in the same order. That catches typos and rules out swapped pairs, so
positional mapping is always safe.

## Critical Implementation Details

**The seed keys must be exactly what the normaliser produces.** The seed sits in SQL, while the lookup
key is computed in TS. One stray capital or double space would leave a seeded row unreachable, with
no error anywhere. So the seed is an exported const in the migration file, and the pure spec asserts
`sectionNameKey(key) === key` for every seeded key (the normaliser is idempotent on keys, since `#`
is not a digit).

**The seed never overwrites.** It uses `ON CONFLICT (name_key) DO NOTHING`. A human runs the migration
on prod, possibly after a manager has already typed something on staging or prod, and that typed
entry must win.

## Phase 1: Shared list and its rules

### Overview

The table, its seed, the pure key/template/render rules, the DB layer and the cached read. Nothing is
visible yet.

### Changes Required:

#### 1. Pure rules

**File**: `src/lib/i18n/section-translations.ts`

**Intent**: Own the placeholder rule in one React-free module, so the action, the report swap and
EX-966 can't disagree.

**Contract**:

- `type SectionTranslationsT = Partial<Record<TranslationLanguageT, string>>` holds the stored
  templates.
- `type SectionTranslationMapT = Record<string, SectionTranslationsT>` is keyed by name key.
- `sectionNameKey(name): string`: `trim` → `toLowerCase` → collapse whitespace runs to one space →
  standalone digit runs → `#`.
- `toSectionTemplate(name, typed): { ok: true; template: string } | { ok: false; expected: string[] }`.
  - Collapse spaces in `typed` and trim it.
  - Empty text → `{ ok: true, template: '' }`, which means "remove this language".
  - Refuse when the typed standalone numbers ≠ the name's numbers (order-sensitive), or when the
    typed text contains a literal `#`.
  - Otherwise replace those numbers with `#`. The template keeps the manager's casing.
- `renderSectionName(name, translations: SectionTranslationsT | undefined, locale): string`.
  - Returns `name` itself for `pl`, for a missing or empty template, and when the template's `#`
    count ≠ the name's number count.
  - Otherwise fills the `#`s with the name's numbers in order.

#### 2. Migration + seed

**File**: `src/migrations/20261002_0_section_translations.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Create the shared list and pre-fill it, so production has translations the moment the
human runs the migration. No separate script.

**Contract**:

- Hand-written, copying `20261001_0_description_translations.ts`. Header comment: hand-written,
  purely ADDITIVE, so migrate prod before pushing.
- `up`: `CREATE TABLE IF NOT EXISTS "kosztorys_section_translations" ("name_key" varchar PRIMARY KEY,
"translations" jsonb NOT NULL DEFAULT '{}'::jsonb, "updated_at" timestamptz NOT NULL DEFAULT now())`.
  Then insert the seed with `ON CONFLICT ("name_key") DO NOTHING`.
- `down`: `DROP TABLE IF EXISTS`.
- `export const SECTION_TRANSLATION_SEED: { key: string; uk: string; ru: string }[]` is the seed
  source, which the spec imports.
- Seed content: Claude writes UA + RU for every key in use. Re-run the distinct-names query from
  `research.md` against the local DB (refresh it with `pnpm db:import` if the dump is newer) and
  cover every key it returns. As of 2026-10-02 these are:

  `ściany i sufity bez łazienek`, `kuchnia`, `podłogi`, `prace dodatkowe`, `wiatrołap`,
  `klimatyzacja`, `wyburzenia i demontaże`, `wyburzenia, demontaże, zabezpieczenia`,
  `instalacja elektryczna i oświetlenie`, `instalacja elektryczna i oświetleniowa`,
  `instalacja wodno-kanalizacyjna / c.o.`, `instalacja wodno-kanalizacyjna + c.o.`,
  `montaż stolarki i ślusarki`, `montaż stolarki i ślusarski`, `łazienka #`, `łazienka`, `wc`,
  `łazienka wc`, `łazienka # wanna`, `łazienka # prysznic`, `pralnia`, `nowa sekcja`.

  Translations start with a capital letter, the way the szablon writes names.

#### 3. DB layer

**File**: `src/lib/db/section-translations.ts`

**Intent**: The SQL statements plus the row mapper, nothing else.

**Contract**:

- `listSectionTranslations(db): Promise<SectionTranslationMapT>`.
- `upsertSectionTranslations(db, key, translations)`: `INSERT … ON CONFLICT DO UPDATE SET
translations, updated_at`.
- `deleteSectionTranslations(db, key)`.
- Shape copied from `src/lib/db/worker-reports.ts`.

#### 4. Cache tag + cached read

**File**: `src/lib/cache/tags.ts`, `src/lib/queries/section-translations.ts`

**Intent**: One argument-free cached entry for the whole list, the same as `getWorkCatalogue`.

**Contract**:

- Add `CACHE_TAGS.sectionTranslations: 'table:kosztorys-section-translations'`.
- Export `getSectionTranslations = unstable_cache(…, ['section-translations-v1'], { tags: [CACHE_TAGS.sectionTranslations] })`.
- `tags.ts` carries another session's uncommitted edits, so commit it by pathspec and review the
  hunk.

### Success Criteria:

#### Automated Verification:

- Pure spec passes: `pnpm exec vitest run src/__tests__/lib/i18n/section-translations.test.ts`
  - The key covers case, outer and inner spaces, a number anywhere, `230V` untouched and Polish
    letters kept.
  - Every seeded key equals its own `sectionNameKey`.
  - The template is refused on a different number, on a swapped order, on a missing number and on a
    literal `#`.
  - An empty input means removal.
  - Rendering fills the numbers back in, and falls back to Polish on a miss, on `pl` and on a count
    mismatch.
- Migration applies to the test DB: `pnpm db:migrate:test`
  (check `git status src/migrations` first).
- The DB round trip passes: `pnpm exec vitest run src/__tests__/lib/db/section-translations.db.test.ts`
  (upsert → list → delete on a fixture key it cleans up itself).

#### Manual Verification:

- `select name_key, translations from kosztorys_section_translations` on the local DB lists all 22
  seed keys with UA and RU text.

**Implementation Note**: When this phase's automated verification passes, commit and continue. Do
**not** pause for per-phase manual confirmation.

---

## Phase 2: „Tłumaczenie sekcji…" in the section menu

### Overview

The manager's editing surface: an action, a read for the dialog, the dialog and the menu entry.

### Changes Required:

#### 1. Save action

**File**: `src/lib/actions/section-translations.ts`

**Intent**: Write one entry of the shared list from a section's name. The key is derived server-side
from the name, so the client never sends a key.

**Contract**:

- `saveSectionTranslationsAction(sectionName: string, typed: Record<TranslationLanguageT, string>)`
  through `protectedAction('saveSectionTranslationsAction', …, ['sectionTranslations'])`.
- zod validation via `validateAction`, with the name non-empty after trim.
- Per language, run `toSectionTemplate`. The first refusal returns
  `{ success: false, error: 'Tłumaczenie (UA) musi zawierać te same liczby co nazwa sekcji: 2.' }`,
  using `LANGUAGE_SHORT` and the expected numbers, or a "#" sentence for the literal case. Nothing is
  written.
- When every template is empty, call `deleteSectionTranslations`. Otherwise upsert the non-empty ones.
- The dialog always sends every language, so a full replace is right.

#### 2. Read for the dialog

**File**: `src/lib/queries/section-translation-for-name.ts` (`'use server'`)

**Intent**: Fill the dialog with what the worker would see for _this_ section, numbers included.

**Contract**:

- `getSectionTranslationForName(sectionName): Promise<Record<TranslationLanguageT, string>>`.
- Guarded by `requireAuth(MANAGEMENT_ROLES)`, as in `register-balance.ts`.
- Reads `getSectionTranslations()` and returns `renderSectionName` per language. A missing entry
  returns `''`, never the Polish fallback, so an empty field means "no translation".
- It lives in its own file because a `'use server'` module may export only async functions.

#### 3. Dialog

**File**: `src/components/kosztorys/editor/dialogs/section-translation/section-translation-dialog.tsx`
(+ a fetch-on-open hook beside it, mirroring `use-catalogue-save-preview.ts`)

**Intent**: Show the Polish name, then one input per `TRANSLATION_LANGUAGES` entry labelled with
`LANGUAGE_LABELS`, filled from the read, and save through the action.

**Contract**:

- Props `{ sectionName, open, onOpenChange }`.
- `FormDialogShell` with title „Tłumaczenie sekcji".
- Description in one sentence: the translation is shared by every rozpiska with this name and is shown
  to the worker on the report link. Numbers in the name are filled in per section.
- „Wczytywanie…" until the read lands. Confirm is disabled while loading or saving.
- On error: `toastMessage(res.error, 'error', 4000)`, and the dialog stays open. On success: a
  `'success'` toast, then close.
- The language list comes from `TRANSLATION_LANGUAGES`, never a hard-coded `uk`/`ru`, so a new
  language appears here automatically.

#### 4. Menu entry

**File**: `src/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu.tsx`

**Intent**: Add „Tłumaczenie sekcji…" (icon `Languages`) after „Dodaj pracę z katalogu do sekcji…",
opening the dialog from the menu's local state, the same way it already opens `ConfirmDialog`.

**Contract**:

- No new field on `SectionBandActionsT`. The menu itself only renders where the editor is editable,
  which is exactly where this entry belongs.
- Not gated by `sortActive`, because it does not touch array position.
- The dialog is mounted only while open.

### Success Criteria:

#### Automated Verification:

- The action spec passes against the test DB:
  `pnpm exec vitest run src/__tests__/lib/actions/section-translations.db.test.ts`.
  - It asserts **persisted rows**, not the return value.
  - A save for „Łazienka 7 wanna" stores the key `łazienka # wanna` with `#` templates.
  - A mismatched number is refused and writes nothing.
  - An all-empty save removes the row.
  - Saves of „Kuchnia" and „ kuchnia " hit the same row.
  - It cleans up its fixture keys. It must not touch any seeded key, so it uses a nonsense name.

#### Manual Verification:

- In the rozpiska of an investment with „Łazienka 2", open „Tłumaczenie sekcji…". UA shows
  „Ванна кімната 2"-style text with the 2 in place, and RU is likewise filled.
- Type UA with „3" instead of „2" and save. The toast names the expected number, and the dialog stays
  open.
- Clear both fields on a one-off name such as „pralnia" and save. Reopen: both fields are empty.
- The entry appears in the szablon editor. On a locked investment there is no section menu at all.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Swap on the report link + docs

### Overview

The report page loads the list and swaps section names together with the opisy.

### Changes Required:

#### 1. Swap

**File**: `src/lib/kosztorys/worker-report/translate-tree.ts`

**Intent**: Also rewrite `section.name` via `renderSectionName(name, map[sectionNameKey(name)], locale)`.

**Contract**:

- The signature becomes `translateTree(tree, locale, sectionTranslations: SectionTranslationMapT)`,
  and the third argument is required.
- `pl` still returns the tree untouched.

#### 2. Page read

**File**: `src/lib/queries/worker-report-page.ts`

**Intent**: Ship the whole list on the `'ready'` variant, so the client-side switcher can use any
language.

**Contract**:

- Add `sectionTranslations: SectionTranslationMapT` to the `kind: 'ready'` variant.
- Add `getSectionTranslations()` to the existing `Promise.all`.
- The page stays uncached as a whole, while this one read is tag-cached and expired by the action.

#### 3. Threading

**Files**: `src/app/(share)/zgloszenie-prac/[name]/[token]/page.tsx`,
`src/components/kosztorys/worker-report/worker-report-form.tsx`,
`src/components/kosztorys/worker-report/report-grid.tsx`

**Intent**: Pass `sectionTranslations` from page → `WorkerReportForm` → `ReportGrid`, then into
`translateTree` at `report-grid.tsx:72`.

**Contract**: one new prop on each of the two components.

#### 4. Domain notes

**File**: `context/reference/kosztorys-editor-domain-notes.md` (§ „Tłumaczenia dla pracownika", line ~457)

**Intent**: A short paragraph covering:

- section names are a shared list keyed by the normalised name, unlike opisy, which live on the row;
- the number placeholder rule;
- a miss stays Polish, with no „Problemy" entry, and why;
- the seed is in the migration and a new name is filled in the dialog;
- EX-966 reuses `renderSectionName` for `/p` and the PDF.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-report/translate-tree.test.ts` passes.
  This extends the existing spec.
  - „Łazienka 2" under `uk` renders the template with 2.
  - A name missing from the map stays Polish.
  - `pl` leaves both names and opisy alone.
  - Opisy are still swapped alongside section names.

#### Manual Verification:

- Open a worker's report link for an investment using szablon names.
  - In Українська, every band and every „Razem …" (in „Wszystkie kolumny") reads Ukrainian.
    „Łazienka 2" keeps its 2.
  - Switch to Русский: Russian. Switch to Polski: Polish.
  - Searching a Ukrainian section word finds that section's rows.
- Rename a section in the editor to a new name, e.g. „Garderoba". The worker sees it in Polish. Add
  its UA in the dialog and reload the report link: it is Ukrainian, with no deploy and no cache wait.
- Send a report in UA and open it in the manager's review. The section names are Polish.

**Implementation Note**: The final phase. Roll the manual bullets into
`context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests:

- `src/__tests__/lib/i18n/section-translations.test.ts`: the whole placeholder rule plus the seed-key
  guard. This is the main risk: a silent miss turns a translated name back into Polish without any
  error.
- `src/__tests__/lib/kosztorys/worker-report/translate-tree.test.ts`: the swap, extended.

### Integration Tests:

- `src/__tests__/lib/db/section-translations.db.test.ts`: SQL round trip.
- `src/__tests__/lib/actions/section-translations.db.test.ts`: refusal, removal and key unification,
  asserted on persisted rows.
- Both are `describe.skipIf(!ENV_READY)`, discovered by `scripts/test-integration.sh`, and clean up
  their own keys.

### E2E:

- This is a browser-level slice: worker link → translated band. Its E2E is owed at the review gate,
  either authored or filed as an `e2e-backlog` issue in Linear. Do not run `pnpm test:e2e` unasked.

### Manual Testing Steps:

The per-phase `#### Manual Verification:` bullets above are the spec. `/10x-implement` rolls them into
`context/foundation/manual-checks.md`.

## Performance Considerations

The list is ~22 rows behind one argument-free cache entry. The report page adds one cached read to
its existing `Promise.all`. The swap is one `map` over the sections, which is negligible.

## Migration Notes

The migration is additive: the new table plus seed. **Prod must be migrated before the push** that
ships the code reading it. A human runs `pnpm db:migrate:prod`. Run `git status src/migrations` before
any migrate against a shared DB, because other sessions' uncommitted migrations sit in this working
tree. The preview DB needs `pnpm db:migrate:preview` after merge to staging.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Integration specs pass: `pnpm test:integration` (5435; locked machine-wide)
- Full unit suite: `pnpm test`, **only when the user asks** (the pre-push hook runs it)

## References

- Research: `context/changes/2026-10-02-kosztorys-section-translations/research.md`
- EX-948 (opisy, the template): `context/changes/2026-10-01-worker-report-translations-ua/`
- Dialog pattern: `src/components/kosztorys/editor/dialogs/catalogue/save-item-to-catalogue-dialog.tsx`
- Cached global read: `src/lib/queries/work-catalogue.ts:20-27`
- Action pattern: `src/lib/actions/work-catalogue.ts:88-99`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared list and its rules

#### Automated

- [x] 1.1 Pure spec passes (key, seed-key guard, template refusals, render) — f3eee12f
- [x] 1.2 Migration applies to the test DB — f3eee12f
- [x] 1.3 DB round-trip spec passes — f3eee12f

### Phase 2: „Tłumaczenie sekcji…" in the section menu

#### Automated

- [x] 2.1 Action DB spec passes (persisted rows: placeholder key, refusal, removal, key unification)

### Phase 3: Swap on the report link + docs

#### Automated

- [ ] 3.1 translate-tree spec passes with section-name cases
