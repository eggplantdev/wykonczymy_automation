# Worker PDF in the worker's language — Implementation Plan

## Overview

The worker's link already speaks uk/ru: column headers, opisy prac, section names and the
rozliczenie footer. The PDF printed from „Drukuj PDF" is still all Polish. This plan makes the PDF
print in the worker's **stored** language with the link's wording, and adds one thing neither
surface does yet: **units of measure** (j.m.) translated from a fixed set, on the link and on paper.
It is the last translation gap in the worker view (EX-966). It lands before EX-949 (kartka → AI),
which rebuilds the same PDF and keeps whatever wording it finds.

## Current State Analysis

- **PDF flow is client-side.** `worker-print-action.tsx` calls the `'use server'` read
  `getWorkerKosztorysPrintData(investmentId, workerId)`
  (`src/lib/queries/worker-kosztorys-print-endpoint.ts:8-13`) → the cached projection
  (`buildWorkerKosztorysData`, worker select `{ name }` only), then `buildWorkerPrintHtml`
  (`src/lib/kosztorys/print/worker.ts`) → `writeAndPrint`.
- **The link's translation seam is `translateTree`** (`src/lib/kosztorys/worker-report/translate-tree.ts`,
  used at `report-grid.tsx:79`). It is pure: it translates opisy (`item.descriptionTranslations`) and
  section names (`getSectionTranslations()`). Missing → Polish, stale → shown as is, `pl` → tree
  unchanged. It does not touch `item.unit`.
- **Link header wording** comes from `columnLabelForView(id, view, dictionary)`
  (`src/lib/kosztorys/columns/column-config.ts:74`), called with the worker's grid translator
  (`column-headers.tsx` `surfaceDictionary`). For plane view `withTools` it reads, in Polish:
  „Opis prac", „Przedmiar", „Jednostka miary", „Cena j.m. netto — z narzędziami (podwykonawca)",
  „Wartość przedmiaru netto — z narzędziami (podwykonawca)", „Pomiar — suma etapów z narzędziami
  (podwykonawca)", „Suma etapy z narzędziami (podwykonawca) netto", „Pozostało netto (względem
  przedmiaru)". Stage headers: `stageLabel(stage, dictionary)` and
  `dictionary.t('stageValueNetHeader', { stage })`.
- **PDF header wording is hard-coded and shorter** (`worker-columns.ts:40-70`): „Stawka j.m.",
  „Wartość przedmiaru", „Pozostało", plus `workerColumnLabel` for `stageQtySum` / `net`
  („Pomiar (razem etapy)", „Wartość wykonana netto"). These `workerColumnLabel` overrides are the
  settings dialog's plane-agnostic names; they stay there.
- **Shared with the offer PDF:** `columns.ts` (`DESCRIPTION_COLUMN`, `PLANNED_QTY_COLUMN`,
  `UNIT_COLUMN`, `stageQtyColumns`, `stageNetColumns`) and `build-html.ts` („Razem — {sekcja}"
  :72, `<html lang="pl">` :135, „Razem netto" :112). The offer must print byte-for-byte as today.
- **Footer** (`worker.ts:36`) already reads `pl.report.summary*`, so swapping `pl` for the locale's
  dictionary is the whole change there. `stageLabel(stage)` in it still uses Polish „Etap N".
- **Language is stored** in `users.language` (`LanguageT`, `toLanguage`, `DEFAULT_LANGUAGE`). The
  cached roster from `fetchReferenceData()` (`src/lib/queries/reference-data.ts:53`) already
  carries it on every worker ref.
- **Units in use** (local DB copy, 2026-10-05, `kosztorys_items.unit`): szt 4747, m² 3165, mb 3149,
  kpl 2865, m2 1974, pkt 533, (empty) 111, klp 73, kontener 61, szt. 26, big bag 12, kg 12, h 1.
  `cleanUnit` (`src/lib/kosztorys/clean-unit.ts`) already folds m2→m², klp→kpl, szt.→szt.
- **The worker picks units himself** in „Prace dodatkowe": `extra-work-rows.tsx:41-46`
  (`unitOptions(...)` mapped to `{ value, label }`), echoed in `draft-extra-works.tsx:17`.

## Desired End State

- A worker whose stored language is uk/ru gets a PDF in that language: column headers in the link's
  wording, opisy and section names translated where a translation exists (Polish otherwise),
  units from the fixed set translated, „Razem — {sekcja}", the document kind „Kosztorys — {imię}",
  the rozliczenie footer and unnamed etapy („Етап 2") in his language, `<html lang>` matching.
- A Polish worker's PDF uses the link's header wording too (longer than today).
- Amounts and dates stay pl-PL („zł", dd.mm.yyyy), as on the link.
- On the uk/ru link, the j.m. column and the „Prace dodatkowe" unit picker show translated units.
  The stored value stays Polish.
- The offer PDF is unchanged — `offer.test.ts` passes untouched.

### Key Discoveries:

- `translateTree` is the one place both surfaces read, so units go there — `translate-tree.ts`.
- `columnLabelForView` already resolves every worker column (`price__<plane>` through
  `planePriceKeyParts`), so the PDF needs no label table of its own — `column-config.ts:74-108`.
- `pl.grid.stageValueNetHeader` is „{{stage}} netto", identical to the offer's
  `` `${stageLabel(stage)} netto` ``, so a Polish-default translator keeps the offer's stage headers
  identical.
- `grid.total` („Razem") already exists in pl/uk/ru for the section-total prefix.

## What We're NOT Doing

- The owner's Podgląd language (it opens in Polish — newer single-view decision).
- The worker's on-device language switcher choice — the PDF reads the **stored** language only.
- Translating amounts/dates formatting, the owner-facing „Drukuj PDF" label or its toasts.
- Translating units on the offer PDF, the editor, or the investor's link.
- Storing translated units — the value written by „Prace dodatkowe" stays the Polish unit.
- Adding `language` to the cached worker projection (`buildWorkerKosztorysData`) — no cache-key bump.
- Any edit to `src/components/kosztorys/editor/grid/*`, `use-kosztorys-editor.ts`,
  `section-colors.ts`, `globals.css` (another session is in them).
- Owner sign-off on uk/ru unit wording — proposed here, owner reviews (see Open Risks in the brief).

## Implementation Approach

Phase 1 adds a fixed unit dictionary and runs it inside `translateTree` and the extra-works unit
labels, so the link gets units first and the PDF inherits them for free. Phase 2 hands the PDF
builder a locale and the section translations, runs the same `translateTree`, and resolves every
label through the dictionaries the link already uses. Shared print modules get optional
parameters whose defaults are today's Polish, so the offer path is untouched.

## Critical Implementation Details

- **Unit lookup is by fold, display is by language.** Key the dictionary by `foldUnit(cleanUnit(unit))`
  so m2 / m² / M2, klp / kpl and szt / szt. hit one entry. For `pl` return the unit **as typed**
  (no cleanup — the link and paper must keep showing what the owner wrote). An unknown unit or an
  empty one is returned unchanged in every language.
- **Order in `buildWorkerPrintHtml`:** `translateTree` must run before `treeToRows`. Section totals
  are keyed by section id, so translation cannot desync them.

## Phase 1: Units of measure on the worker's link

### Overview

A fixed pl→uk/ru unit dictionary, applied by `translateTree` (the link's grid, later the PDF) and by
the „Prace dodatkowe" unit picker and its draft echo.

### Changes Required:

#### 1. Unit dictionary

**File**: `src/lib/kosztorys/worker-report/translate-unit.ts` (new)

**Intent**: Translate a j.m. from the fixed set into the worker's language; everything else passes
through as typed.

**Contract**: `translateUnit(unit: string, locale: LanguageT): string`. Proposed entries (keyed by
fold; uk / ru):

| fold     | uk        | ru        |
| -------- | --------- | --------- |
| szt      | шт.       | шт.       |
| m2       | м²        | м²        |
| m3       | м³        | м³        |
| mb       | пог. м    | пог. м    |
| kpl      | компл.    | компл.    |
| pkt      | точ.      | точ.      |
| kontener | контейнер | контейнер |
| kg       | кг        | кг        |
| h / godz | год.      | ч         |

`big bag` and anything off this list stay as typed.

#### 2. Tree translation

**File**: `src/lib/kosztorys/worker-report/translate-tree.ts`

**Intent**: Translate `item.unit` alongside the opis, under the same `pl` → unchanged rule.

**Contract**: Signature unchanged. A `null` unit stays `null`.

#### 3. „Prace dodatkowe" unit picker

**Files**: `src/components/kosztorys/worker-report/extra-work-rows.tsx`,
`src/components/kosztorys/worker-report/draft-extra-works.tsx`

**Intent**: Show translated labels while the option **value** stays the Polish unit, so what is sent
and stored does not change. The draft echo shows the same translated label.

**Contract**: `options` map `value: option`, `label: translateUnit(option, locale)`; locale from the
report's existing translation context (`useTranslation` / provider already in these components).

### Success Criteria:

#### Automated Verification:

- `translate-unit` spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-report/translate-unit.test.ts` (fold variants, unknown unit, empty unit, `pl` returns as typed)
- `translate-tree` spec passes with a unit case: `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-report/translate-tree.test.ts`
- Extra-works spec covers translated label + Polish value: `pnpm exec vitest run src/__tests__/components/kosztorys/worker-report/worker-report-form.test.tsx` (or the spec that already renders `ExtraWorkRows`)

#### Manual Verification:

- Worker link of a worker set to Ukrainian → „Zgłaszam pracę": the j.m. column shows „шт.", „м²", „пог. м"; a unit off the list (e.g. „big bag") shows as typed.
- Same link → „Prace dodatkowe" → j.m. picker lists the Ukrainian units; after sending, the zgłoszenie in the app shows the Polish unit.
- Worker link of a Polish worker: units look exactly as before (including „m2" typed without the superscript).

**Implementation Note**: When this phase's automated verification passes, commit and continue — do **not** pause for per-phase manual confirmation.

---

## Phase 2: Worker PDF in the worker's language

### Overview

The print read returns the worker's stored language and the section translations; the builder
translates the tree, the headers, the section totals, the document kind and the footer.

### Changes Required:

#### 1. Print read

**File**: `src/lib/queries/worker-kosztorys-print-endpoint.ts`

**Intent**: Return what the client needs to print in the worker's language, in one round trip.

**Contract**: Returns `{ data: WorkerKosztorysT; language: LanguageT; sectionTranslations: SectionTranslationMapT } | null`.
Language from the worker's ref in `fetchReferenceData()` (`?? DEFAULT_LANGUAGE`, also when the ref
is not found); section translations from `getSectionTranslations()`. The three reads run in
parallel. The session gate stays inside `getWorkerKosztorysPreview`, which runs first or alongside —
nothing is returned without it.

#### 2. Caller

**File**: `src/components/kosztorys/editor/actions/worker-print-action.tsx`

**Intent**: Pass `locale` and `sectionTranslations` through to `buildWorkerPrintHtml`. Toasts and the
button label stay Polish.

#### 3. Builder

**File**: `src/lib/kosztorys/print/worker.ts`

**Intent**: Print the worker's document in `locale`.

**Contract**: `WorkerPrintArgsT` gains `locale: LanguageT` and `sectionTranslations: SectionTranslationMapT`.
`translateTree(data.tree, locale, sectionTranslations)` before `treeToRows`. Footer reads
`getTranslations(locale).report` and names etapy with `stageLabel(stage, grid)` where
`grid = createTranslator(locale, 'grid')`. `documentKind` from a new key `report.documentKind`
(„Kosztorys — {{name}}" in pl, uk/ru equivalents using the dictionaries' existing words:
„Кошторис", „Смета"). Passes `lang: locale` and `totalLabel: grid.t('total')` to the shared builder.

#### 4. Worker columns

**File**: `src/lib/kosztorys/print/worker-columns.ts`

**Intent**: Every header = the link's header, through `columnLabelForView(key, plane, grid)`.
Drop the hard-coded „Stawka j.m." / „Wartość przedmiaru" / „Pozostało" and the `workerColumnLabel`
calls.

**Contract**: `WorkerPrintColumnsArgsT` gains `dictionary: TranslatorT<'grid'>`. The rate column is
labelled with `columnLabelForView(rateKey, plane, dictionary)`. The shared description / przedmiar /
unit columns take a label override by spread (`{ ...DESCRIPTION_COLUMN, label }`). Stage columns get
the dictionary (below).

#### 5. Shared print modules (Polish defaults)

**Files**: `src/lib/kosztorys/print/columns.ts`, `src/lib/kosztorys/print/build-html.ts`

**Intent**: Accept the language without changing the offer.

**Contract**: `stageQtyColumns(stages, dictionary = POLISH_GRID)` labels with `stageLabel(stage, dictionary)`;
`stageNetColumns(stages, valueOf, format, dictionary = POLISH_GRID)` labels with
`dictionary.t('stageValueNetHeader', { stage: stageLabel(stage, dictionary) })`.
`buildKosztorysPrintHtml` gains optional `lang = 'pl'` (the `<html lang>`) and `totalLabel = 'Razem'`
(the section-total prefix). „Razem netto" is untouched — the worker's `footerHtml` replaces it.

#### 6. Dictionaries

**Files**: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`

**Intent**: Add `report.documentKind`. Any other new key only if a Polish word in the PDF has no
existing key.

#### 7. Specs

**Files**: `src/__tests__/lib/kosztorys/print/worker.test.ts`

**Intent**: Update the Polish header assertions to the link wording („Cena j.m. netto — …",
„Wartość przedmiaru netto — …", „Pomiar — suma etapów …", „Suma etapy … netto",
„Pozostało netto (względem przedmiaru)"); add a uk case asserting Ukrainian headers, a translated
opis, a Polish opis where no translation exists, a translated section name in „Разом — …", a
translated unit, Ukrainian footer labels, „Етап N" for an unnamed etap, `lang="uk"`, and amounts
still in „zł".

### Success Criteria:

#### Automated Verification:

- Worker PDF spec passes (Polish link wording + uk case): `pnpm exec vitest run src/__tests__/lib/kosztorys/print/worker.test.ts`
- Offer PDF spec passes unchanged: `pnpm exec vitest run src/__tests__/lib/kosztorys/print/offer.test.ts`
- Dictionary parity spec (if one asserts pl/uk/ru key sets) passes: `pnpm exec vitest run src/__tests__/lib/i18n`

#### Manual Verification:

- Kosztorys of an investment → „Drukuj PDF" for a worker set to Ukrainian: headers, opisy with a translation, section names, units, „Разом — …", „Кошторис — {imię}" and the rozliczenie are Ukrainian; an opis without a translation is Polish; amounts in „zł".
- Same for a worker set to Russian.
- „Drukuj PDF" for a Polish worker: headers read like his link („Cena j.m. netto — z narzędziami (podwykonawca)" etc.) and still fit the A4 landscape page without overlapping.
- „Drukuj PDF" of the client offer: identical to before.
- The browser's „Zapisz jako PDF" file name is still „{inwestycja} — {imię}".

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- `translateUnit`: each fold variant, unknown, empty, `pl` passthrough as typed.
- `translateTree`: unit translated next to opis; `pl` tree unchanged.
- `buildWorkerPrintHtml`: Polish wording; uk document end to end at the HTML-string level.

### Integration Tests:

- None — the print read composes two cached reads that already have their own coverage; the PDF is
  HTML built client-side.

### Manual Testing Steps:

1. Set a worker's language to „українська" in his account, print his PDF from the kosztorys.
2. Print a Polish worker's PDF; check the longer headers on A4.
3. Print the client offer; compare with a print from before the change.

## Performance Considerations

One extra cached read (`fetchReferenceData`, `getSectionTranslations`) per print, in parallel. No
cost on the link — `translateUnit` is a map lookup per row.

## Migration Notes

None — no schema change, nothing stored.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Lint passes on changed files: `pnpm exec eslint <changed files>`
- Full suite: owed by the pre-push hook (not run unasked)

## References

- Research: `context/changes/2026-10-05-worker-pdf-translations/research.md`
- Link translation seam: `src/lib/kosztorys/worker-report/translate-tree.ts`
- Link header wording: `src/lib/kosztorys/columns/column-config.ts:74`
- Issue: EX-988 · umbrella: EX-946 · translation work it closes: EX-966 · next on this PDF: EX-949

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Units of measure on the worker's link

#### Automated

- [x] 1.1 translate-unit spec passes — f9e64d88
- [x] 1.2 translate-tree spec passes with a unit case — f9e64d88
- [x] 1.3 Extra-works spec covers translated label + Polish value — f9e64d88

### Phase 2: Worker PDF in the worker's language

#### Automated

- [x] 2.1 Worker PDF spec passes (Polish link wording + uk case) — e8872496
- [x] 2.2 Offer PDF spec passes unchanged — e8872496
- [x] 2.3 Dictionary parity spec passes — e8872496
