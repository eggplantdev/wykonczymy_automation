# Ukrainian translations for the worker report surface — Implementation Plan

## Overview

EX-948, slice 2 of EX-946. Build the i18n scaffolding (language list, dictionaries, `useTranslation`,
plurals, switcher, the worker's stored language) and translate the first worker surface on it: the
report link `/zgloszenie-prac/[name]/[token]` and everything it opens. Translations of the prace
themselves live on the row next to the opis, are copied the way the opis is copied, and are filled by a
re-runnable script. Every decision behind this plan is in `change.md` § Decisions; this file does not
re-argue them.

## Current State Analysis

- **No i18n anywhere.** `src/app/(share)/layout.tsx:18` hard-codes `<html lang="pl">`; every string is
  inline Polish. `src/lib/utils/polish-plural.ts` is Polish-only (~38 consumers).
- **The report page is one client tree.** `page.tsx` → `WorkerReportForm` → `ReportGrid` →
  `KosztorysEditorBody preview worker report={…}`, so one provider at the form root reaches the
  grid, its portaled footer and its Radix dialogs. The notice branch (`page.tsx:20-26`) is server JSX
  outside that tree.
- **Column headers are pure functions** called from `useKosztorysEditor` with an options object that
  already carries `workerSurface` (`use-kosztorys-editor.ts:556-600`): `columnTitle` / `stageValueHeader`
  (`grid/column-headers.tsx:50-88`), `columnLabelForView` (`columns/column-config.ts:57-77`),
  `headerTipFor` (`header-tips.ts:54-60`), `stageLabel` (`stage-label.ts:7`).
- **Server messages are Polish strings**: `REPORT_REFUSALS` (`worker-report/refusals.ts:4-9`),
  `reportShareRefusal` (`share-refusal.ts:7-16`), `WORKER_SCOPE_BLOCK_MESSAGES`
  (`worker-view/labels.ts:3-7`, also used owner-side), `worker-report.ts:17,18,34,71`,
  `token-action.ts:42-59`, Zod messages in `worker-report/schemas.ts:9,21,22`, the generic
  `run-action.ts:17` / `action-failure.ts` / `settle-action.ts:5`. `FailureT` (`src/types/action.ts:9`)
  carries only `error` + an optional `code`.
- **No translation storage.** `kosztorys_items` and `work_catalogue_items` have no translation column;
  `users` has no language. A Payload `select` field always creates a Postgres enum
  (`@payloadcms/drizzle` `traverseFields.js:574-590`), so a select-backed language would need an
  `ALTER TYPE` per new language.
- **A pozycja's fields are enumerated in a handful of choke points**, and almost every copy path goes
  through them: `mapItem` (`db/kosztorys-tree.ts:150-172`), `ITEM_INSERT_COLUMNS` + VALUES tuple
  (`kosztorys/insert-rows.ts:21-37,125`), `itemWithColumnDefaults` + the `TolerantT` list
  (`snapshot-format.ts:112-122,162-174`), `itemFromFields` (`item-from-fields.ts:5-41`). Snapshots,
  „Cofnij", szablony (`serialize-preset.ts:23-31` spreads the item), replace-tree and the in-editor
  undo copy whole items through them.
- **The worker projection carries whole items.** `buildWorkerKosztorysData`
  (`queries/worker-kosztorys.ts:45-108`) passes `buildKosztorysTree` items through, so a field on the
  item reaches the report page's client without a projection change — but the cache key
  `['worker-kosztorys-data-v2']` (`:114`) has to move with the shape.
- **The sheet import never reads the katalog.** `buildImportPlan` is pure
  (`sheet-import/build-import-plan.ts:84`); existing pozycje are matched by section + opis and keep
  their `note` (`:226`).

## Desired End State

- A worker whose language is Українська opens their report link and reads the whole page in
  Ukrainian. That covers the header, both views (compact and „Wszystkie kolumny"), column headers and
  tooltips, „Razem", empty and search states, the „Prace spoza rozpiski" dialog, sending and its
  confirm, the sent history, toasts and refusal notices. Every opis that has a translation shows in
  Ukrainian; the rest show in Polish.
- A switcher in the header flips the page between Polski and Українська. The choice survives a reload
  in that browser.
- A worker with no language set, and the manager's own editor, see exactly today's Polish page.
- The report the worker sends is stored in Polish (opis copied server-side from the pozycja by id).
- The rozpiska has a hidden „Opis prac (UA)" column and a „nieaktualne tłumaczenie" problem. The
  katalog has the field in its form, a hidden column, and „bez tłumaczenia (UA)" / „z nieaktualnym
  tłumaczeniem (UA)" problems.
- Picking from the katalog, accepting a report against a katalog entry, szablony and the sheet import
  all carry the translation.
- `src/scripts/fill-description-translations.ts` exports what is missing and imports a translated
  file. It fills only empty translations and runs dry by default.
- Adding a third language means one list entry plus one dictionary file, with no migration.

### Key Discoveries:

- `CatalogueSeedItemT = Omit<WorkCatalogueItemT,'id'>` (`work-catalogue/types.ts:25`) feeds
  `catalogueRow` → `applyCatalogueWrite`. If it required the new field, every katalog edit would
  overwrite translations with `{}`. A Payload `update` leaves a missing key alone, so omit it there and
  merge explicitly.
- `NOT NULL DEFAULT '{}'` plus an explicit NULL bind fails with 23502. That makes `?? {}` in
  `itemWithColumnDefaults` load-bearing, and the field must be in the `TolerantT` list or `tsc` reads
  the `??` as dead (lessons `:531`, `:778-808`). No `SNAPSHOT_SCHEMA_VERSION` bump: an additive column
  with a default doesn't need one.
- Cell saves run on per-field lanes (`save-lanes.ts:14`), so a `description` save and a translation
  save are unordered. `source` must be stamped **on the client** from the grid row, never read back
  from the DB on the server.
- `useHiddenColumns` stores only deviations (`use-hidden-columns.ts:15-48`), so adding the new id to
  `DEFAULT_HIDDEN_COLUMNS` hides it for everyone with no stored-data change. The katalog `DataTable`
  has no default-hidden mechanism (`tables/data-table/data-table.tsx:95-103`).
- A namespaced column id (lessons `:1643`): configuration that says what kind of figure it is
  (label, layer, tip) resolves through the base key, and visibility matches the full id. Never rename
  the id once it ships, because a renamed id drops out of a stored hidden set and the column
  reappears.
- `ui/` must not import i18n (AGENTS.md): `dialog.tsx:73`'s „Zamknij" aria needs a prop.
- `@/lib/utils/toast` is hand-mocked in ~22 specs, so no constants or translation lookups go there.

## What We're NOT Doing

- The rozpiska link `/p`, „Podgląd pracownika" and the worker PDF. They are later slices on this
  scaffolding, and the PDF lands before EX-949 reshapes it.
- The logged-in app, `/k` and „Podgląd inwestora".
- Any AI call. That includes the „wygeneruj tłumaczenie" button, which ships with the AI translation
  change.
- Translating „Prace spoza rozpiski" typed by the worker. They are stored and reviewed as typed.
- A Polish original under the translated opis. The switcher covers it.
- A pozycja → katalog id link (`kosztorys-item-catalogue-link`, verdict: not now).
- Stage names, section names and units as data. They are owner-typed and stay as typed. Unit
  **option labels** in the dialog get dictionary labels; the stored values stay Polish.
- Number formatting. It stays `pl-PL`, because Ukrainian also uses a decimal comma.
- `generateMetadata` for the tab title.
- „Porównaj z katalogiem" applying translations. It applies prices only, as today.
- Copying a katalog translation onto „Nowa praca": a one-off praca starts empty.

## Implementation Approach

Data plane first, so every later phase builds on a field that already round-trips. Then the copy
rules and the manager's editing surfaces. Then the worker's language, then the i18n core, then the
report surface on top of the core. The fill script comes last, because it writes the column the
earlier phases created.

The opis swap happens **on the client**, in `ReportGrid`, from the tree the page already receives.
The switcher's choice lives in the browser, so the server can't know it. Swapping before
`KosztorysEditorBody` keeps search and row-height measurement on the translated text. Server-side
nothing changes: send copies the Polish opis by item id (`worker-report.ts:41-66`).

---

## Phase 1: Data model and field threading

### Overview

Add the columns and the language list, and thread the new field through every place that enumerates
a pozycja's or a katalog entry's fields. This phase changes no behaviour. It only makes the field
survive every copy.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261001_0_description_translations.ts` (+ register in `src/migrations/index.ts`
after `20260930_3_cash_register_trashed_at`)

**Intent**: Add the two translation columns and the worker language column, additive only. Copy the
shape of `20260928_4_document_column_ranks.ts`.

**Contract**:

- `kosztorys_items.description_translations jsonb NOT NULL DEFAULT '{}'::jsonb`
- `work_catalogue_items.description_translations jsonb NOT NULL DEFAULT '{}'::jsonb`
- `users.language varchar NULL` (no default, no backfill; null = Polish)
- `down` drops all three with `IF EXISTS`.
- One concept, one name: the same identifier on both tables (AGENTS.md naming rule 4).

#### 2. Language list

**File**: `src/lib/i18n/languages.ts` (new)

**Intent**: The single list every other piece reads, so a new language is one entry.

**Contract**:

- `LANGUAGES = ['pl', 'uk'] as const` and `LanguageT`.
- `TRANSLATION_LANGUAGES` = every language except `pl`, plus `TranslationLanguageT`.
- `LANGUAGE_LABELS` (`Polski`, `Українська`) and `LANGUAGE_SHORT` (`PL`, `UA`, for column labels).
- `isLanguage(x)` guard and a Zod `languageSchema`.
- `DescriptionTranslationsT = Partial<Record<TranslationLanguageT, { text: string; source: string }>>`
  goes in `src/lib/i18n/types.ts`.

#### 3. Pozycja field threading

**Files**:

- `src/collections/kosztorys-items.ts`
- `src/lib/kosztorys/types.ts` (`KosztorysItemT`, `ItemPatchT`)
- `src/lib/db/kosztorys-tree.ts` (SELECT `:69-74`, `mapItem` `:150-172`)
- `src/lib/kosztorys/insert-rows.ts`
- `src/lib/kosztorys/snapshot-format.ts`
- `src/lib/kosztorys/v2-rows.ts` (`ITEM_FIELDS`)
- `src/lib/kosztorys/item-patch-schema.ts`
- `src/lib/kosztorys/item-from-fields.ts`
- `src/lib/actions/accept-worker-report.ts:371-388` (free-text extra)
- `src/lib/kosztorys/sheet-import/parse-labor-tab.ts:176-193`

**Intent**: Carry `descriptionTranslations` exactly like `description` everywhere a pozycja is read,
inserted, snapshotted, restored, patched or built from fields. Free-text extras and parsed sheet rows
start with `{}`.

**Contract**:

- Payload `type: 'json'` field `descriptionTranslations`.
- `mapItem` and `itemWithColumnDefaults` default to `{}`, and the field goes in the `TolerantT` list.
- The VALUES tuple binds `${JSON.stringify(…)}::jsonb`, as `db/snapshots.ts:71` does.
- The patch schema validates
  `z.record(TRANSLATION_LANGUAGE_ENUM, z.object({ text: z.string(), source: z.string() }))`.
- `ITEM_FIELDS` includes it, so `diffRow` (reference `!==`) detects a replaced map.
- Update `ITEM_INSERT_COLUMNS` in the same edit as the collection field (lessons `:531`).

#### 4. Katalog field threading

**Files**:

- `src/collections/work-catalogue-items.ts`
- `src/lib/kosztorys/work-catalogue/types.ts`
- `src/lib/db/work-catalogue.ts` (`CATALOGUE_COLUMNS`, `toCatalogueItem`, `insertCatalogueItems`,
  `getCatalogueSourceItem` / `CatalogueSourceItemT`)

**Intent**: The katalog entry carries the same field, read with a `{}` default.

**Contract**:

- `WorkCatalogueItemT.descriptionTranslations`.
- `CatalogueSeedItemT = Omit<WorkCatalogueItemT, 'id' | 'descriptionTranslations'>`, so the existing
  writers never send the key by accident. Phase 2 adds the explicit merge.
- `CatalogueSourceItemT` gains the field (needed by „Zapisz do katalogu").

#### 5. Cache keys

**Files**: `src/lib/queries/work-catalogue.ts`, `src/lib/queries/worker-kosztorys.ts:114`,
`src/lib/queries/preview-kosztorys.ts:97`

**Intent**: A cached entry written before the deploy has no `descriptionTranslations`. Bump every
`unstable_cache` key whose payload shape changes.

**Contract**:

- `['work-catalogue']` → `['work-catalogue-v2']`
- `worker-kosztorys-data-v2` → `-v3`
- `preview-kosztorys-editor-data-v3` → `-v4`

### Success Criteria:

#### Automated Verification:

- Migration applies to the test DB: `pnpm db:migrate:test`
- The round-trip spec covers the field. Add a translation to the "every nullable field set"
  fixture in `src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`; it passes against
  5435: `source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" node --env-file=.env node_modules/vitest/vitest.mjs run src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts src/__tests__/lib/kosztorys/insert-schema-drift.test.ts`
- An old payload without the key restores as `{}`. Extend
  `src/__tests__/lib/kosztorys/insert-kosztorys-tree.test.ts` and run it the same way.
- `itemFromFields` copies the field (unit spec beside the existing one): `pnpm exec vitest run <that spec>`

#### Manual Verification:

- On local, restore an older kosztorys version and save a szablon from a kosztorys. Neither errors,
  and the rozpiska renders unchanged.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Copy rules and the manager's editing surfaces

### Overview

Make translations flow from the katalog into pozycje, survive the import and the owner's text fixes,
and give the manager a place to see, edit and find the ones that are missing or out of date.

### Changes Required:

#### 1. Katalog → pozycja

**Files**: `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts`,
`src/lib/actions/accept-worker-report.ts:89-98,370`

**Intent**: The picker and accept-from-report already build the pozycja through `itemFromFields(entry, …)`.
Once phase 1 threads the field, the translation copies. Verify both and add nothing beyond that.

**Contract**: The copied map is the entry's map verbatim, `source` included. A katalog translation
made from the same Polish text stays current on the row.

#### 2. Sheet import

**Files**: `src/lib/kosztorys/sheet-import/build-import-plan.ts:205-227`, `src/lib/actions/kosztorys-import.ts`
(`derivePlan` `:77-89`), `src/lib/db/work-catalogue.ts`

**Intent**:

- An existing pozycja keeps its translation, the way it keeps its `note`.
- A new pozycja whose opis matches a katalog entry gets that entry's translation.
- `buildImportPlan` stays pure: the action looks the katalog up and passes a map in.

**Contract**:

- `buildImportPlan(…, { translationsByMatchKey?: Map<string, DescriptionTranslationsT> })`.
- Per item: `current?.descriptionTranslations ?? translationsByMatchKey.get(catalogueKey(opis, unit)) ?? {}`.
- A loose match can copy a translation whose `source` differs from the imported opis. That row
  then shows as out of date, which is the truthful state.

#### 3. „Zapisz do katalogu" (overwrite from a pozycja)

**Files**: `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts` (`applyCatalogueWrite` `:55-78`),
`src/lib/kosztorys/work-catalogue/item-to-catalogue.ts` (`toCatalogueCandidate`),
`src/lib/actions/work-catalogue.ts` (`saveItemToCatalogueAction` `:100-135`)

**Intent**: Owner ruling, this plan: the pozycja's translation wins per language when it has one, and
the katalog keeps its own otherwise. The opis and its translation then come from one source.

**Contract**: A pure `mergeTranslations(katalog, pozycja)`, applied per language: pozycja non-empty
`text` → pozycja's `{text, source}`, else katalog's. It applies on overwrite and on create; on create
there is nothing to merge with.

#### 4. „Popraw literówki" and the opis-cleaning script keep a fresh translation fresh

**Files**: `src/lib/db/kosztorys-item-texts.ts`, the action that drives it,
`src/scripts/fix-kosztorys-descriptions.ts`

**Intent**: Owner ruling, this plan: a typo fix doesn't change meaning, so a translation that was
current before the fix stays current after it. One that was already out of date stays out of date.

**Contract**:

- A pure `restampTranslations(map, oldDescription, newDescription)`: every language whose
  `source === oldDescription` gets `source = newDescription`; the rest are untouched.
- `getItemTexts` / `ItemTextRowT` carry the map.
- `setItemTexts` writes it in the same single `UPDATE … FROM (VALUES …)`.

#### 5. Rozpiska column „Opis prac (UA)"

**Files**:

- `src/lib/kosztorys/columns/column-config.ts` (label, `DEFAULT_HIDDEN_COLUMNS`, `LAYER_NEUTRAL_COLUMNS`)
- a new key helper on the `plane-price-keys.ts` pattern
- `src/components/kosztorys/editor/grid/cells/translation-column.tsx` (new)
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx` (`identity` array `:121-133`)
- `src/lib/kosztorys/row-content-lines.ts:7` (`WRAPPING_COLUMN_IDS`)

**Intent**: One editable long-text column per translation language, hidden by default, placed right
after „Opis prac". An edit stamps `source` from the row's current Polish opis.

**Contract**:

- Column id `descriptionTranslation__<lang>`, built by the helper from `TRANSLATION_LANGUAGES`.
- Label `Opis prac (<LANGUAGE_SHORT>)`, resolved through the base key per lessons `:1643`;
  visibility by the full id.
- The cell wraps `longTextColumn` (`ui/datasheet-grid/long-text-cell.tsx:53`). It maps
  `row.descriptionTranslations?.[lang]?.text` in, and writes out
  `{ ...map, [lang]: { text, source: row.description ?? '' } }`. An emptied cell removes the
  language key.
- Copy, paste and delete go through the same mapping.
- The column is not added to `PREVIEW_VISIBLE_COLUMNS`. It is added to `WORKSHOP_VISIBLE_COLUMNS`,
  because szablony are where katalog-born rows get reviewed.

#### 6. Rozpiska „Problemy": „nieaktualne tłumaczenie"

**Files**: `src/lib/kosztorys/row-conditions/registry.ts`, `src/lib/kosztorys/row-conditions/problem-groups.ts`

**Intent**: Flag rows whose translation was made from a different Polish text. This is a per-row
check that doesn't use `ctx`, so `use-kosztorys-editor.ts` stays untouched.

**Contract**:

- One diagnostic per translation language: `matches(row) = t != null && t.source !== (row.description ?? '')`.
- New problem group „Tłumaczenia".
- `revealsColumns: [descriptionTranslation__<lang>]`.

#### 7. Katalog form, column and „Problemy"

**Files**:

- `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts`
- `work-catalogue-item-form.tsx`
- `edit-catalogue-item-dialog.tsx`
- `src/components/kosztorys/editor/dialogs/catalogue/catalogue-item-from-kosztorys-dialog.tsx`
- `src/lib/actions/work-catalogue.ts`
- `src/components/tables/work-catalogue.tsx`
- `src/components/tables/data-table/data-table.tsx`
- `src/lib/kosztorys/work-catalogue/catalogue-conditions.ts`

**Intent**:

- An „Opis prac (UA)" textarea after „Opis pracy", in all three dialogs.
- A hidden-by-default table column.
- Two problems per language.

**Contract**:

- The form field is optional, so `NewItemForm`, which reuses the schema, is unaffected.
- On save the action builds the map: changed text → `source` = the form's current opis; unchanged
  text → keep the stored `source`. An empty text drops the language.
- The update sends the full map, because a json value replaces the whole object.
- From-kosztorys dialog default: `existing?.descriptionTranslations ?? candidate.descriptionTranslations`,
  as `category` does.
- `DataTable` gains a `defaultColumnVisibility` prop merged as `{ ...defaults, ...stored }`. Only
  deviations are stored (lessons `:1301`).
- Problems: `catalogue-no-translation-<lang>` („bez tłumaczenia (UA)") and
  `catalogue-stale-translation-<lang>` („z nieaktualnym tłumaczeniem (UA)").
  - Labels must read after „Prace" and be unique.
  - Generated from `TRANSLATION_LANGUAGES`; they join `CATALOGUE_PROBLEM_IDS` automatically.

### Success Criteria:

#### Automated Verification:

- Unit specs pass: `pnpm exec vitest run <spec>` for each of:
  - `mergeTranslations`: pozycja wins when non-empty; katalog kept when the pozycja is empty.
  - `restampTranslations`: fresh → restamped; stale → untouched; untranslated → untouched.
  - `buildImportPlan`: existing row keeps; new row takes the katalog's; no match → `{}`.
  - the rozpiska row condition (with a helper that throws on an unknown id, lessons „tolerant lookup").
  - `catalogue-conditions` (updated `CATALOGUE_PROBLEM_IDS` list + the two predicates).
- Spec for the translation cell's out-mapping (pure function): it stamps `source` from the row.

#### Manual Verification:

- In a szablon:
  - Show „Opis prac (UA)" and type a translation.
  - Change the Polish opis; „nieaktualne tłumaczenie" lists the row.
  - Revert the opis; the row leaves the list.
- Add a praca from the katalog whose entry has a translation; the new row shows it.
- Run „Popraw literówki" on a kosztorys whose translated rows are current; no row appears under
  „nieaktualne tłumaczenie".
- In the katalog, edit an entry's „Opis prac (UA)"; „bez tłumaczenia (UA)" drops by one.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: The worker's language

### Overview

An optional „Język" on the worker, read by the report link.

### Changes Required:

#### 1. Users collection and form

**Files**:

- `src/collections/users.ts` (after `role`)
- `src/components/forms/worker-form/worker-schema.ts`
- `worker-form.tsx`
- `add-worker-dialog.tsx`
- `edit-worker-dialog.tsx`
- `src/app/(frontend)/pracownicy/[id]/page.tsx:49-54`

**Intent**: A plain text field validated against `LANGUAGES`, so no enum and no migration per
language. The form shows a „Język" select. Polski stores null.

**Contract**:

- The Payload field is `text` with a `validate` (null / `''` / a language code).
- Form value `''` ↔ stored `null`. If the Select primitive rejects an empty item value, use the
  `'pl'` sentinel and map it to null in `toData`.
- The employee card shows `LANGUAGE_LABELS[language ?? 'pl']`.

#### 2. Reference data and the share read

**Files**: `src/types/reference-data.ts`, `src/lib/queries/reference-data.ts`,
`src/lib/db/worker-report-share.ts`

**Intent**: The worker list and the token lookup carry the language. An unknown stored value reads
as null.

**Contract**:

- `WorkerRefT.language: LanguageT | null`; the cache key goes `reference-data-v3` → `-v4`.
- `ReportShareT.language: LanguageT | null`, from `w.language`.

### Success Criteria:

#### Automated Verification:

- The worker schema maps `''`/`'pl'` to null and `'uk'` through, and rejects others. Run the unit
  spec: `pnpm exec vitest run <spec>`.

#### Manual Verification:

- Set a worker to Українська and reopen the edit dialog; it shows Українська. The employee card shows
  „Język: Українська". Set them back to Polski; the stored value is null.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: The i18n core

### Overview

`src/lib/i18n/`, modelled on `~/workspace/yolo/landing_26/src/lib/i18n/`, with this repo's
adaptations.

### Changes Required:

#### 1. Dictionaries and lookup

**Files**: `src/lib/i18n/dictionaries/pl.ts`, `uk.ts`, `src/lib/i18n/translations.ts`

**Intent**:

- Namespaced TS objects, not JSON, so plural forms can be objects and `uk` is type-checked against
  `pl`.
- `getTranslations(locale)` serves non-React code: server, pure functions and the column builders.

**Contract**:

- `type TranslationsT = typeof pl`; `uk: TranslationsT`.
- Namespaces follow the surface (`report`, `grid`, `actions`, `common`).
- `{{param}}` interpolation; an unknown key logs and returns the key.
- A plural entry is `{ one, few, many, other }`, resolved by `new Intl.PluralRules(locale).select(n)`.
- Polish `few`/`many` must match today's `pluralize` output.

#### 2. Provider, hook, switcher state

**Files**: `src/lib/i18n/i18n-context.ts`, `translations-provider.tsx`, `use-translation.ts`

**Intent**:

- The context **defaults to the Polish dictionary**, with no throw, so the manager's editor, which
  renders the same grid components, needs no provider.
- The provider owns the active language:
  - initial value = the worker's stored language;
  - a localStorage override wrapped in try/catch, validated with `languageSchema`;
  - `document.documentElement.lang` set in an effect.

**Contract**:

- `useTranslation(ns)` returns `{ t, tp, locale }`, where `tp(key, count)` resolves plurals.
- No `useMemo`/`useCallback` (React Compiler).
- Storage key `worker-report-lang:<workerId>`.
- The provider exposes `setLocale` for the switcher.

### Success Criteria:

#### Automated Verification:

- DOM spec `src/__tests__/lib/i18n/translations-provider.test.tsx`:
  - Without a provider, `t` returns Polish.
  - With `uk`, it returns Ukrainian.
  - A stored override wins over the initial language.
  - A junk stored value falls back to the initial language.
  - `lang` follows the locale.

  Run: `pnpm exec vitest run src/__tests__/lib/i18n/translations-provider.test.tsx`

- Unit spec `src/__tests__/lib/i18n/translations.test.ts`:
  - `tp` for 1, 2, 5, 12, 21, 22, 25 in `pl` and `uk`.
  - Polish output equals `pluralize` for the same numbers.
  - Interpolation works.
  - Every `uk` key exists in `pl` (enforced by the type; asserted for nested plural shapes).

#### Manual Verification:

- None. The core has no screen of its own until phase 5.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: The report link in Ukrainian

### Overview

Translate every string the report link shows, in both views, plus the notices. Swap the opisy and add
the switcher.

### Changes Required:

#### 1. Page, provider and notices

**Files**:

- `src/app/(share)/zgloszenie-prac/[name]/[token]/page.tsx`
- `src/lib/queries/worker-report-page.ts`
- `src/components/kosztorys/worker-report/branded-header.tsx`
- `src/app/(share)/not-found.tsx` (new)

**Intent**:

- The provider wraps both branches with `initialLocale = page.language`.
- The notice carries a message **key** instead of text.
- `BrandedHeader` becomes a client component that reads `t` and hosts the switcher, so the switcher
  shows on notices too.
- An unknown token gets a two-language PL/UA not-found, since the language can't be known there.

**Contract**:

- `WorkerReportPageT` gains `language` and `workerId` on both variants.
- `notice.message` → `notice.messageKey: ReportNoticeKeyT`.

#### 2. Server messages as keys

**Files**:

- `src/types/action.ts`
- `src/lib/kosztorys/worker-report/refusals.ts`
- `share-refusal.ts`
- `src/lib/kosztorys/worker-view/labels.ts`
- `src/lib/actions/token-action.ts`
- `src/lib/actions/worker-report.ts`
- `src/lib/kosztorys/worker-report/schemas.ts`

**Intent**:

- Every message the report page can receive gets a stable key next to its Polish text.
- The client renders `t(key)` and falls back to `error`.
- Owner-side consumers keep reading the Polish values, unchanged.

**Contract**:

- `FailureT.messageKey?: string`.
- `refuse()` in `token-action.ts` and the send action set it.
- Zod messages on the report schemas become keys, mapped on the client.
- Generic failures (`REQUEST_FAILED`, „Wystąpił błąd", `STALE_ROW`, `DATABASE_ERROR`) map by `code`
  to a `common` key.
- A raw `err.message` falls back to the generic key.
- Existing `token-action.test.ts` assertions on the Polish values stay green.

#### 3. Report-owned components

**Files**: under `src/components/kosztorys/worker-report/`:

- `worker-report-form.tsx`
- `report-grid.tsx`
- `report-bar.tsx`
- `draft-extra-works.tsx`
- `extra-work-rows.tsx`
- `extra-works-dialog-button.tsx`
- `send-bar.tsx`
- `sent-reports.tsx`

Plus `src/components/kosztorys/editor/grid/report-column.tsx`.

**Intent**:

- Every inline string goes through `t`/`tp`, and `itemNoun` / `VANISHED_FORMS` become `tp` keys.
- `formatPLDateTime` takes a locale.
- `reportColumn` / `pendingColumn` titles become small components that read context, since a
  module-level JSX constant can't.
- `ConfirmDialog` gets an explicit `cancelLabel`.

#### 4. Shared grid copy reached in report mode

**Files**:

- `src/lib/kosztorys/columns/column-config.ts`
- `header-tips.ts`
- `stage-label.ts`
- `labels.ts` (`PLANE_LABELS`)
- `src/components/kosztorys/editor/grid/column-headers.tsx`
- `use-kosztorys-editor.ts` (`columnOpts` only)
- `kosztorys-synthetic-rows.tsx`
- `kosztorys-editor-body.tsx`
- `empty-grid-copy.ts`
- `editor-noun.ts`
- `section-footer-cell.tsx`
- `section-header-cell.tsx`
- `src/lib/utils/notice.ts` (`rejectedEntryMessage`)
- `src/components/ui/dialog.tsx`

**Intent**:

- Pure builders take an optional dictionary through the options object they already accept. When it
  is absent they return today's Polish, so offer print, column selection and the manager's editor
  are untouched.
- Components inside the tree read `useTranslation`.
- `dialog.tsx` gets a `closeLabel` prop, because `ui/` must not import i18n.

**Contract**:

- `columnOpts` gains `dictionary` from `useTranslation('grid')`. It is only read on the
  `workerSurface` path.
- `withSyntheticRows` and `emptyGridCopy` take the label as an argument.

#### 5. Opis swap

**Files**: `src/lib/i18n/translate-tree.ts` (new, pure), `src/components/kosztorys/worker-report/report-grid.tsx`

**Intent**: Before handing the tree to `KosztorysEditorBody`, replace each item's `description` with
its translation for the active locale, falling back to Polish when the translation is empty. A
stale translation shows as is.

**Contract**:

- `translateTree(tree, locale)` returns the same reference for `pl`.
- `toFormData` and the draft key by item id, so nothing else moves.

### Success Criteria:

#### Automated Verification:

- `extra-works-dialog-button.test.tsx` stays green without a provider. Add a `uk` case under the
  provider: `pnpm exec vitest run src/__tests__/components/kosztorys/worker-report/extra-works-dialog-button.test.tsx`
- New DOM spec on the `kosztorys-editor-body-history.test.tsx` harness: report mode under `uk`
  renders Ukrainian column headers, „Razem" and the search-empty state; without a provider they are
  Polish. Run with `pnpm exec vitest run <spec>`.
- `translateTree` unit spec: translated, empty → Polish, stale → shown, `pl` → same reference.
- `token-action.test.ts` and `worker-report.test.ts` stay green and assert `messageKey`:
  `pnpm exec vitest run src/__tests__/lib/actions/token-action.test.ts`
- Column-label specs (`planned-net-for-plane-columns.test.ts`) stay green with no dictionary.

#### Manual Verification:

- On local:
  - Set a worker to Українська and open their report link.
  - Check both views, the dialog, the send confirm, the toast, the sent history and the 21/22/25
    plurals (drafts).
  - All read in Ukrainian; translated opisy show in Ukrainian, the rest in Polish.
  - Search finds a Ukrainian word.
- Flip the switcher to Polski and reload; the page stays Polish. The manager's review of the sent
  report shows Polish opisy.
- Revoke the link or close the inwestycja; the notice reads in the worker's language. An unknown
  token shows the PL/UA page.
- At 390px (EX-947 phone exception), the header with the switcher doesn't overflow.
- The manager's editor and `/p` look exactly as before.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 6: The fill script, translations and docs

### Overview

The re-runnable script, the first Ukrainian translation file, and the living-doc updates.

### Changes Required:

#### 1. Script

**File**: `src/scripts/fill-description-translations.ts` (new); data in `src/scripts/data/`

**Intent**: Follow `fix-work-catalogue-texts.ts` (`git show 4de2666e^:…`) and `import-catalogue.ts`
(`git show 5599b877^:…`).

- `export --lang uk`: prints JSON of the distinct trimmed Polish opisy that have an empty translation.
  The scope is katalog entries plus pozycje of open investments (`status <> 'completed' AND
trashed_at IS NULL`, szablony included), with counts and where each opis appears.
- `import <file> --lang uk [--apply]`: matches by exact Polish text and fills only an empty
  translation, with `source` = the row's current opis. It prints filled / already translated /
  missing from the file. It runs dry by default; `--apply` writes in one `withPayloadTransaction`
  with a bulk `UPDATE … FROM (VALUES …)`.

**Contract**:

- The header documents the local run, the prod run (`DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" … --apply`,
  run by a human after `pnpm db:dump`) and the cache flush. Raw SQL skips the tags, so any katalog edit
  or rozpiska cell edit flushes them.
- No figure is baked in.

#### 2. First translation file

**File**: `src/scripts/data/description-translations-uk.tsv`

**Intent**: Export from a fresh local copy (`pnpm db:dump && pnpm db:import`, confirm before wiping
local), translate into Ukrainian, then dry-run and `--apply` against **local** only.

#### 3. Living docs

**Files**:

- `context/reference/kosztorys-editor-domain-notes.md` (`:374-456` worker view/report, `:932-984`
  picker / „Nowa praca" / overwrite rule, `:1155-1157` katalog entry)
- `context/foundation/lessons.md` (only if implementation surfaces a new trap)
- `context/changes/2026-10-01-worker-report-translations-ua/research.md`: mark superseded sections
  (text dictionary, enum language, hidden toggle)

**Intent**: Record the copy semantics, the stale rule and the two owner rulings from this plan in the
domain notes.

### Success Criteria:

#### Automated Verification:

- A pure-matcher unit spec (fills empty, skips filled, skips text not in the file, stamps `source`):
  `pnpm exec vitest run <spec>`
- A dry run against local prints counts and writes nothing:
  `node --env-file=.env --import tsx src/scripts/fill-description-translations.ts import src/scripts/data/description-translations-uk.tsv --lang uk`

#### Manual Verification:

- After `--apply` on local, „bez tłumaczenia (UA)" in the katalog drops to (near) zero, and a report
  link for a Ukrainian worker on an open investment shows Ukrainian opisy.
- A second `--apply` fills 0.

**Implementation Note**: When this phase's automated verification passes, commit.

---

## Testing Strategy

### Unit Tests:

- The round-trip (DB, 5435) carries the field. A payload without it restores as `{}`.
- Copy rules: `mergeTranslations`, `restampTranslations`, the import plan with the katalog map,
  `itemFromFields`.
- Conditions: the rozpiska stale check, katalog „bez" / „nieaktualne".
- i18n: plurals across 1/2/5/12/21/22/25 for both languages, interpolation, Polish parity with
  `pluralize`.
- `translateTree`, the fill-script matcher.

### Integration Tests:

- DOM: the provider default, the override and `lang`. The report grid under `uk` vs no provider. The
  extras dialog under `uk`.
- No E2E in this change. The report page has no E2E today. A browser-level risk (client → action →
  DB) is not introduced here, because send is unchanged.

### Manual Testing Steps:

See each phase's Manual Verification. The phase 5 run on a Ukrainian worker's link is the one that
matters.

## Performance Considerations

- `translateTree` is one pass over the worker's rows per locale change. That is negligible next to
  the grid render.
- The rozpiska stale condition is a per-row string compare with no `ctx`. The EX-496 hook is not
  touched.
- The sheet import adds one `listCatalogueItemsByMatchKeys` read per import.

## Migration Notes

- Additive only. **Migrate prod before pushing** the code that reads the columns. A human runs
  `pnpm db:migrate:prod`.
- Run `git status src/migrations` before any migrate on a shared DB (AGENTS.md).
- Running the fill script on prod is a separate human step after deploy.

## Whole-tree Gate

Run once, after the final phase:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`, only when the user asks for the full suite (memory: never unasked). Otherwise the
  touched specs above.
- `pnpm test:integration`, which covers the DB round-trip leg, also only when asked.

## References

- Decisions: `context/changes/2026-10-01-worker-report-translations-ua/change.md` § Decisions
- Research: `context/changes/2026-10-01-worker-report-translations-ua/research.md` (partly
  superseded, see change.md)
- Not-now sibling: `context/changes/2026-10-01-kosztorys-item-catalogue-link/research.md`
- Reference i18n: `~/workspace/yolo/landing_26/src/lib/i18n/`, `~/workspace/fest/fest-frontend/lib/i18n/`
- Slice 1: `context/archive/2026-09-30-worker-work-reports/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model and field threading

#### Automated

- [ ] 1.1 Migration applies to the test DB
- [ ] 1.2 Round-trip + schema-drift specs carry the field (5435)
- [ ] 1.3 Old payload without the key restores as `{}`
- [ ] 1.4 `itemFromFields` copies the field

### Phase 2: Copy rules and the manager's editing surfaces

#### Automated

- [ ] 2.1 Unit specs: merge, restamp, import plan, rozpiska condition, katalog conditions
- [ ] 2.2 Translation cell out-mapping stamps `source`

### Phase 3: The worker's language

#### Automated

- [ ] 3.1 Worker schema language mapping spec

### Phase 4: The i18n core

#### Automated

- [ ] 4.1 Provider DOM spec
- [ ] 4.2 Translations / plurals unit spec

### Phase 5: The report link in Ukrainian

#### Automated

- [ ] 5.1 Extras dialog spec green without provider + `uk` case
- [ ] 5.2 Report grid DOM spec under `uk` vs Polish default
- [ ] 5.3 `translateTree` unit spec
- [ ] 5.4 Token-action / worker-report specs assert `messageKey`
- [ ] 5.5 Column-label specs green with no dictionary

### Phase 6: The fill script, translations and docs

#### Automated

- [ ] 6.1 Fill-script matcher unit spec
- [ ] 6.2 Dry run against local prints counts, writes nothing
