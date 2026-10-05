# AI translations Implementation Plan

## Overview

The app gets its first AI translation calls, through the existing OpenRouter setup. They fill missing
and stale uk/ru translations of opisy (kosztorys + katalog) and section names, and translate
„prace spoza rozpiski" written in uk/ru into Polish for the manager. Linear **EX-992** (under EX-946).
It lands before EX-949, which reuses `translateToPolish` for scanned kartki.

## Current State Analysis

- Translations exist only as data. An opis carries `description_translations` jsonb
  `{ uk|ru: { text, source } }` (`src/lib/i18n/description-translations.ts`), and an entry is stale when
  `source !== description`. Section names have a shared table `kosztorys_section_translations`
  keyed by `sectionNameKey(name)`.
- They are filled by hand (grid column, katalog form, section dialog) or by the offline TSV script
  `src/scripts/fill-description-translations.ts`. There is no AI call anywhere.
- „Problemy → Tłumaczenia" lists only stale translations (`row-conditions/registry.ts:575-587`). The
  katalog already has both filters (`work-catalogue/catalogue-conditions.ts:56-72`).
- Worker extras are stored and reviewed as typed (`worker_report_lines.description`), and accepted
  into a pozycja with `descriptionTranslations: {}` (`accept-worker-report.ts:375`).

## Desired End State

- „Opcje → Uzupełnij tłumaczenia (AI)" in the kosztorys editor fills every missing or stale uk/ru
  translation of that kosztorys' opisy and of its section names, then reports counts in a toast.
- Katalog prac has the same button for the whole katalog.
- „Problemy → Tłumaczenia" lists „bez tłumaczenia (UA)" / „(RU)" next to the stale conditions.
- „Nowa pozycja" and the katalog add dialog have a „Tłumacz automatycznie przy pomocy AI" checkbox,
  on by default and remembered. When it is checked, a new praca is saved with uk + ru filled.
- A section created from the katalog, or renamed, gets its name template translated when the shared
  list has none.
- A worker's extra typed in uk/ru is translated into Polish right after the send. In the review
  dialog the manager sees the Polish with the original beside it. Each pending extra has a
  „Przetłumacz" / „Przetłumacz ponownie" button, so a translation that failed or came back as
  nonsense can be redone in place. Accepting creates the pozycja with the Polish opis and the
  worker's original as its uk/ru translation.
- An AI failure never blocks a save. The row is saved untranslated, and it shows up as missing.

### Key Discoveries:

- `openrouter.ts:47-66` holds the provider client and `timeoutSignal`, both private to the receipt
  extractor. The fallback pattern (primary → `FALLBACK_MODEL`, `logError` on the primary) is at
  `:145-155`.
- `setItemTexts` (`src/lib/db/kosztorys-item-texts.ts`) overwrites opis + unit + translations. If the
  bulk fill reused it, it would clobber a grid edit made while the AI was running.
- `planTranslationFill` (`src/lib/i18n/translation-fill.ts:82`) fills only empty translations. The AI
  fill needs "missing **or stale**", so it gets its own selector rather than reusing this one.
- `upsertSectionTranslations` (`src/lib/db/section-translations.ts:26`) replaces the whole entry. An
  AI fill must merge so that existing languages win.
- `listCatalogueTranslationsByMatchKey` (`src/lib/db/work-catalogue.ts:92`) is the katalog-first
  lookup. A katalog translation that is current against its own opis is reused before the AI is
  called.
- `usePersistedFlag` (`src/hooks/use-persisted-enum.ts:63`) gives the remembered checkbox.
- `tokenAction` doesn't pass `share.language`, and the worker's switcher can differ from the stored
  language anyway, so the AI detects the language of each extra itself.
- `readInvestmentReport` is uncached, so writes to `worker_report_lines` need no tag expiry.
- Lessons: an LLM answer is used only when it maps back exactly (by id) and is non-empty, otherwise
  it is left blank. A server action that revalidates already renders, so no `router.refresh()`. A spec
  touching `after()` collects and flushes the scheduled promises (lessons.md §"Post-response cleanup
  belongs in after()").

## What We're NOT Doing

- No review/approval step for AI output. The owner fixes mistakes by hand (decision).
- No AI call on an opis edit after creation, in the grid or in the katalog. Stale → Problemy → bulk
  button (decision).
- No global „all section names" action. The kosztorys button covers that kosztorys' sections only.
- No Problemy condition for a section name without a translation.
- No AI for etapy names, notes, units or UI strings.
- No translation of rozpiska lines in a worker report (they point at a pozycja), and no AI on the
  worker's side of the page. The worker sees his own text, and nothing on his page (sent history
  included) shows a translation state, an error or a retry button. Those live in the manager's review
  dialog only.
- No rate limiting on the public send (token-gated, pennies).
- The TSV script stays as is.

## Implementation Approach

One small AI module with two pure-input functions (`translateTexts`: pl → uk/ru, `translateToPolish`:
uk/ru → pl with language detection). Each is batched, has the primary + fallback model, a
per-call timeout, and maps results back by id. Above it sit pure planners: which rows need which
language, deduplicated by Polish text, with the katalog reused first. The planners are unit-tested
with the AI mocked. Every DB write is translation-only and guarded, so an AI answer that arrives
late can never overwrite a newer opis or a hand-typed translation. The phases go bottom-up: the
layer, then the two bulk surfaces, then creation hooks, then the worker extras.

## Critical Implementation Details

- **Late answers must lose.** The opis write is compare-and-set per row: it writes only where
  `description IS NOT DISTINCT FROM <source the AI translated>`. Per language, it writes only where
  the stored entry is still missing or stale at write time. A grid edit or a hand-typed translation
  made during the AI wait therefore wins. Section templates merge with the existing languages
  winning. The after() write on report lines lands only `WHERE description_language IS NULL`, so it
  never overwrites a manager's retry that finished first.
- **No DB transaction is held across an AI call.** At creation the AI runs before the insert
  transaction opens, and a failure degrades to `descriptionTranslations: {}` without failing the action.
- **Section rename/create translate in `after()`**, expiring `CACHE_TAGS.sectionTranslations` with
  `revalidateTag(…, EXPIRE_NOW)`. This is the narrow case lessons §EX-909 allows: the rename autosave
  must stay render-free (`deferRefresh`), and the readers are the worker share pages and the PDF,
  which are other routes and another visitor. The editor's client router cache never carried the
  value.
- **The bulk action runs within one server-action invocation.** Distinct texts are deduplicated,
  then sent in batches of ~40 with concurrency 4, each batch caught on its own
  (`mapWithConcurrency` rejects on the first failure). A 1000-row kosztorys therefore stays well
  inside the 300 s function ceiling.

## Phase 1: AI translation layer

### Overview

A shared OpenRouter client, the two translate functions, and the pure planners every surface uses.

### Changes Required:

#### 1. Shared client

**File**: `src/lib/ai/openrouter-client.ts` (new), `src/lib/ai/openrouter.ts`

**Intent**: Move the `createOpenRouter` client and `timeoutSignal` out of the receipt module, so the
translator uses the same headers and timeout behaviour. `openrouter.ts` imports them, and its
behaviour is unchanged.

**Contract**: `export const openrouter`, `export function timeoutSignal(ms, label)`. The module stays
server-only (it imports `serverEnv`) and outside the Payload CLI graph.

#### 2. Translator

**File**: `src/lib/ai/translate.ts` (new)

**Intent**: Two batched `generateObject` calls with a zod schema: `translateTexts` translates Polish
construction-work opisy / section names into every `TRANSLATION_LANGUAGES` entry, and
`translateToPolish` detects pl/uk/ru and returns Polish. The prompt keeps numbers, dimensions and
units verbatim. The primary model is used with one retry on `FALLBACK_MODEL`; `logError` records the
primary failure.

**Contract**:
- `TRANSLATION_MODEL` constant; `translateTexts(texts: {id, text}[]): Promise<Map<id, TranslationTextsT>>`.
- `translateToPolish(texts: {id, text}[], opts?: { model?: string }): Promise<Map<id, { language: 'pl'|'uk'|'ru'|'other'; polish: string | null }>>`.
- An id the model didn't return, an id it invented, or an empty string is dropped (blank, never
  guessed). A whole-batch failure throws, and callers catch it per batch.

#### 3. Planners

**File**: `src/lib/i18n/ai-translation-fill.ts` (new)

**Intent**: Pure functions with no AI or DB. One picks, per row and language, what needs filling
(missing or stale, non-empty opis). One deduplicates by trimmed Polish text. One applies katalog
translations that are current for the same match key before anything goes to the AI. One turns
AI/katalog texts into per-row writes stamped with the row's own opis as `source`. A section variant
keeps only AI output that passes `toSectionTemplate`.

**Contract**: `needsTranslation(translations, language, description)`; `planAiFill(rows, catalogueByKey)` → `{ fromCatalogue: RowWriteT[], toTranslate: {text, rowIds}[] }`; `sectionTemplatesFromAi(name, texts)` → `SectionTranslationsT` (failed languages omitted).

#### 4. Tests

**File**: `src/__tests__/lib/ai/translate.test.ts`, `src/__tests__/lib/i18n/ai-translation-fill.test.ts`

**Intent**: Mock `ai` + `@openrouter/ai-sdk-provider` (pattern: `src/__tests__/openrouter-fallback.test.ts`).
Cover the fallback, a dropped id, an invented id, an empty text, and the language detection
mapping. The planners cover: stale vs fresh vs hand-typed; dedup; the katalog reused only when
current; a section output with the wrong numbers dropped.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/ai/translate.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/i18n/ai-translation-fill.test.ts` passes
- `pnpm exec vitest run src/__tests__/openrouter-fallback.test.ts` still passes after the client move

#### Manual Verification:

- None (no UI in this phase).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Kosztorys — „Opcje" bulk action + Problemy

### Overview

One button fills a kosztorys' missing/stale opis translations and its section-name templates.
Problemy gains „bez tłumaczenia".

### Changes Required:

#### 1. Translation-only writers

**File**: `src/lib/db/kosztorys-item-texts.ts` (or a sibling `kosztorys-item-translations.ts`), `src/lib/db/section-translations.ts`

**Intent**: Write AI translations without touching opis/unit, guarded as described in Critical
Implementation Details. Bump `investments.updated_at` only when a row actually changed, so the editor
reseeds. Add a merge upsert for section templates where the existing languages win.

**Contract**: `setItemTranslations(db, investmentId, rows: {id, source, translations}[]): Promise<number>` returns the number of rows written. `fillSectionTranslations(db, key, translations)` uses `ON CONFLICT … SET translations = EXCLUDED.translations || kosztorys_section_translations.translations`.

#### 2. Action

**File**: `src/lib/actions/kosztorys-translations.ts` (new)

**Intent**: `investmentAction` that reads the item texts + section names, plans (katalog first), calls
`translateTexts` in batches with per-batch catch, writes, and returns counts. Tags:
`kosztorysItems`, `sectionTranslations`.

**Contract**: `fillKosztorysTranslationsAction(investmentId): ActionResultT<{ items: number; sections: number; failed: number }>`.

#### 3. Menu entry

**File**: `src/components/kosztorys/editor/actions/fill-translations-action.tsx` (new), `toolbar/menus/kosztorys-actions-menu.tsx`

**Intent**: Mirror `clean-item-texts-action.tsx`: busy state, `settleAction`, `onTreeReplaced()`, and
a result toast („Przetłumaczono N opisów i M nazw sekcji" / „… K się nie udało" / „Wszystko już
przetłumaczone"). The notice wording goes in `lib/utils/notice.ts`, not `toast.ts`.

#### 4. Problemy condition

**File**: `src/lib/kosztorys/row-conditions/registry.ts`

**Intent**: Add `missing-translation-<lang>` („bez tłumaczenia (UA/RU)") in the same `translations`
group, matching a non-empty opis with an empty translation. Rewrite the comment that explains why a
missing translation was not listed.

#### 5. Tests

**File**: `src/__tests__/lib/db/kosztorys-item-translations.test.ts` (DB), `src/__tests__/lib/actions/kosztorys-translations.test.ts`, registry spec beside the existing row-condition specs

**Intent**: DB tests: an opis changed after planning → no write; a hand-typed fresh translation →
kept; stale → replaced; `updated_at` bumped only on a write. Action test with the AI mocked: a batch
failure counts as failed and the rest are still written. Condition: missing vs stale vs fresh.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-translations.test.ts` passes
- The new DB spec passes under `pnpm test:integration`'s discovery (run the single file against 5435)
- The row-condition spec passes

#### Manual Verification:

- On a kosztorys with missing + stale opisy, „Opcje → Uzupełnij tłumaczenia (AI)" fills them; the grid reseeds without a reload; Problemy empties.
- A uk translation typed by hand before the run is unchanged afterwards.
- A section without a template gets one; `/p` for a uk worker shows the translated section name.

---

## Phase 3: Katalog prac bulk action

### Overview

The same fill for the whole katalog.

### Changes Required:

#### 1. Writer + action

**File**: `src/lib/db/work-catalogue.ts`, `src/lib/actions/work-catalogue.ts`

**Intent**: A translation-only, compare-and-set writer for `work_catalogue_items` (same guard as
Phase 2), and a management action using the same planner (no katalog-first step, since this is the
katalog). Tag `workCatalogue`.

**Contract**: `fillCatalogueTranslationsAction(): ActionResultT<{ items: number; failed: number }>`.

#### 2. Toolbar button

**File**: `src/components/work-catalogue/work-catalogue-data-table.tsx`

**Intent**: A button in the toolbar actions slot, with the same busy state and result toast as
Phase 2.

#### 3. Tests

**File**: `src/__tests__/lib/actions/work-catalogue-translations.test.ts`

**Intent**: AI mocked; covers only missing/stale written, fresh kept, and a failed batch counted.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/actions/work-catalogue-translations.test.ts` passes

#### Manual Verification:

- Katalog prac → the button; the „bez tłumaczenia" / „z nieaktualnym tłumaczeniem" filters empty out.

---

## Phase 4: Translate at creation

### Overview

The checkbox on „Nowa pozycja" and the katalog add dialog, plus automatic section-name templates on
create/rename.

### Changes Required:

#### 1. Checkbox

**File**: `src/components/kosztorys/editor/dialogs/new-item/new-item-form.tsx` (+ schema), `src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx`, `src/components/dialogs/add-catalogue-item-dialog.tsx`

**Intent**: „Tłumacz automatycznie przy pomocy AI", read from `usePersistedFlag` (one shared key, on
by default). Shown only in add mode, not in the katalog edit form.

#### 2. Actions

**File**: `src/lib/actions/kosztorys.ts` (`addItemAction`), `src/lib/actions/work-catalogue.ts` (`createCatalogueItemAction`)

**Intent**: Take `translate: boolean`. When set, fill the languages still empty after the katalog copy,
before the insert transaction. A failure saves the row untranslated and returns
`translationFailed: true`, which the dialog shows as a soft notice („Zapisano bez tłumaczenia").

**Contract**: input gains `translate?: boolean`; result data gains `translationFailed?: boolean`.

#### 3. Section names

**File**: `src/lib/actions/kosztorys.ts` (`updateSectionFieldAction`), `src/lib/actions/catalogue-to-kosztorys.ts` (`createSectionWithCatalogueItemsAction`)

**Intent**: When a name is written and its key has no template for some language, `after()`
translates it, keeps only output that passes `toSectionTemplate`, merge-writes it, and expires
`sectionTranslations` (`revalidateTag`, `EXPIRE_NOW`). `DEFAULT_SECTION_NAME` gets a template like
any other name; `addSectionAction` is untouched because it only ever writes that default.

#### 4. Tests

**File**: `src/__tests__/lib/actions/kosztorys.test.ts` (or the existing addItem spec), `src/__tests__/lib/actions/work-catalogue.test.ts`, section-rename spec

**Intent**: Cover translate on/off, an AI throw that still saves, and a katalog translation not
overwritten. For rename, use an `after` stub that collects and flushes. Assert an existing template
is untouched, and that a wrong-number output is dropped.

### Success Criteria:

#### Automated Verification:

- The touched action specs pass (`pnpm exec vitest run <each file>`)

#### Manual Verification:

- „Nowa pozycja" with the box checked → the UA/RU columns are filled; unchecking is remembered after a reload.
- Katalog add with the box checked → the entry shows translations in the katalog table.
- Rename a section to a new name → after a moment, `/p` for a uk worker shows it translated.

---

## Phase 5: Prace spoza rozpiski → Polish

### Overview

The worker's extras are translated after the send. The manager reviews the Polish next to the
original, can retranslate any pending extra from the dialog, and accepts the Polish opis.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/<next free counter>_add_worker_report_line_translations.ts`, `src/migrations/index.ts`

**Intent**: Hand-written. Add `polish_description text NULL` and `description_language text NULL`
on `worker_report_lines`. Both null means "not translated yet / failed". Take the next free counter
at implementation time: `20261005_3_…` is another session's uncommitted file, so run
`git status src/migrations` first.

#### 2. DB + types

**File**: `src/lib/db/worker-reports.ts`, `src/lib/kosztorys/worker-report/types.ts`

**Intent**: Read both columns in `readWorkerReport`/`toLineRow`. Add
`setLineTranslations(db, rows, { onlyUntranslated })`: the after() path writes only where
`description_language IS NULL`, and the retry writes unconditionally.

**Contract**: `WorkerReportLineRowT` / `ReportLineT` gain `polishDescription: string | null`, `descriptionLanguage: string | null`.

#### 3. Send

**File**: `src/lib/actions/worker-report.ts`

**Intent**: After `insertWorkerReport`, `after()` runs `translateToPolish` over the report's extra
lines and writes the result. A failure is logged with `logError` and leaves the line untranslated.
The send result does not depend on it.

#### 4. Retry action

**File**: `src/lib/actions/worker-report-translation.ts` (new)

**Intent**: Management-only `investmentAction`. It retranslates one extra line of a **pending**
report in that investment. It calls `translateToPolish` with `FALLBACK_MODEL` directly, because the
manager retries after a bad answer and asking the same cheap model again tends to repeat it. It
returns the new pair so the dialog updates in place. Nothing is cached, so it needs no tag.

**Contract**: `retranslateReportLineAction(investmentId, lineId): ActionResultT<{ polishDescription: string | null; descriptionLanguage: string }>`. It refuses a rozpiska line, an accepted/rejected report, or a line from another investment.

#### 5. Review dialog

**File**: `src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx`, `worker-report-review.tsx`, `line-draft.ts`

**Intent**: `ManualDescriptionCell` shows the Polish when present, plus a muted „Zgłoszono (UA):
„<original>”" line. Without Polish it shows the original, a muted „Brak tłumaczenia", and the button.
Every pending, unaccepted extra has the button: „Przetłumacz" with no Polish, „Przetłumacz ponownie"
with Polish. It is busy while running, and a failure toasts and keeps the current text. A
successful retry patches the report held in dialog state. The katalog hints (`closestEntries`) match
on the Polish when present. In `SwapNote`, „Zgłoszono" quotes the Polish with the original beside it.

#### 6. Accept

**File**: `src/lib/actions/accept-worker-report.ts` (`extraAsItem`)

**Intent**: An extra whose `polishDescription` is set and whose language is uk/ru becomes a pozycja with
`description = polishDescription` and `descriptionTranslations = { [lang]: { text: original, source: polish } }`.
The worker's own words thus become the translation his crew reads, and they are current. A katalog
swap still wins, as today. A line without Polish is accepted as typed.

#### 7. Tests

**File**: `src/__tests__/lib/actions/worker-report.test.ts`, `src/__tests__/lib/actions/worker-report-translation.test.ts` (new), `src/__tests__/lib/actions/accept-worker-report.test.ts`, `src/__tests__/lib/db/worker-reports.test.ts`, `src/__tests__/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.test.tsx` (new, dom)

**Intent**:
- Send, with the collect-and-flush `after` stub: uk extra → Polish stored; AI throws → line untranslated and send still succeeds.
- DB: an after() write never overwrites a line a retry already translated.
- Retry: refuses rozpiska/accepted/foreign lines; stores the new pair.
- Accept: Polish opis + original as the current translation; untranslated line as typed.
- DOM: the line without Polish shows „Brak tłumaczenia" + „Przetłumacz"; clicking with the action mocked shows the Polish and the original.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate` (after `git status src/migrations`)
- `pnpm exec vitest run src/__tests__/lib/actions/worker-report-translation.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/actions/worker-report.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/actions/accept-worker-report.test.ts` passes
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.test.tsx` passes
- The worker-reports DB spec passes against 5435

#### Manual Verification:

- From a uk worker's report link, send an extra typed in Ukrainian → the manager's review shows the Polish with „Zgłoszono (UA)" and the original.
- With `OPENROUTER_API_KEY` broken locally, send an extra → the review shows „Brak tłumaczenia" + „Przetłumacz"; fix the key, click → the Polish appears without reopening the dialog.
- „Przetłumacz ponownie" on a translated line replaces the Polish.
- Accept → the new pozycja has the Polish opis, and its UA column holds the worker's text, not stale.

---

## Testing Strategy

### Unit Tests:

- Translator: id mapping, blanks, fallback, language detection.
- Planners: missing vs stale vs fresh, dedup, katalog-first only when current, the section number check.
- Actions with the AI mocked: degrade-on-failure everywhere, counts, refusals.

### Integration Tests:

- Compare-and-set writers (items, katalog, report lines) against the 5435 DB, which the pre-push
  `test:integration` discovers.

### Manual Testing Steps:

1. Kosztorys bulk on the seeded investment (`INV=6 … seed-kosztorys.ts`).
2. Katalog bulk.
3. Creation checkbox in both dialogs, with remember.
4. Worker extra round-trip, including the broken-key retry path.

## Performance Considerations

Distinct texts only, batched ~40 per call with concurrency 4, and a 30 s timeout per call plus one
fallback. A 1000-row kosztorys fits the 300 s ceiling. Cost is fractions of a cent per batch on
flash-lite.

## Migration Notes

Additive (two nullable columns), so prod is migrated **before** the push that ships Phase 5 (human,
`pnpm db:migrate:prod`). Existing lines stay null and show „Brak tłumaczenia" + the button.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit + DOM suite passes: `pnpm test`
- DB integration passes: `pnpm test:integration`

## References

- Change notes and decisions: `context/changes/2026-10-05-ai-translations/change.md`
- Prior slice: `context/archive/2026-10-01-worker-report-translations-ua/change.md`
- AI pattern: `src/lib/ai/openrouter.ts`, `src/__tests__/openrouter-fallback.test.ts`
- Bulk-action pattern: `src/components/kosztorys/editor/actions/clean-item-texts-action.tsx`
- `after()` spec pattern: `context/foundation/lessons.md` §"Post-response cleanup belongs in `after()`"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: AI translation layer

#### Automated

- [x] 1.1 translate.test.ts passes — 399ed2f2
- [x] 1.2 ai-translation-fill.test.ts passes — 399ed2f2
- [x] 1.3 openrouter-fallback.test.ts still passes after the client move — 399ed2f2

### Phase 2: Kosztorys — „Opcje" bulk action + Problemy

#### Automated

- [x] 2.1 kosztorys-translations action spec passes — 0ed47a1f
- [x] 2.2 kosztorys-item-translations DB spec passes against 5435 — 0ed47a1f
- [x] 2.3 row-condition spec passes — 0ed47a1f

### Phase 3: Katalog prac bulk action

#### Automated

- [x] 3.1 work-catalogue-translations action spec passes — 95de69a6

### Phase 4: Translate at creation

#### Automated

- [x] 4.1 touched action specs pass (addItem, createCatalogueItem, section rename/create) — e420514c

### Phase 5: Prace spoza rozpiski → Polish

#### Automated

- [x] 5.1 migration applies to the local DB
- [x] 5.2 worker-report-translation.test.ts passes
- [x] 5.3 worker-report.test.ts passes
- [x] 5.4 accept-worker-report.test.ts passes
- [x] 5.5 review-lines-table DOM spec passes
- [x] 5.6 worker-reports DB spec passes against 5435
