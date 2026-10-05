---
date: 2026-10-05T12:19:32+02:00
researcher: Claude (Opus 5.5)
git_commit: e46e8850cdfa131ff04542751d61ce37f5d8fac3
branch: staging
repository: wykonczymy
topic: "Worker PDF in the worker's language (uk/ru)"
tags: [research, codebase, kosztorys, print, worker-pdf, i18n, translations]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (Opus 5.5)
---

# Research: Worker PDF in the worker's language (uk/ru)

**Date**: 2026-10-05T12:19:32+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: e46e8850
**Branch**: staging
**Repository**: wykonczymy

## Research Question

What would it take to render the worker's PDF (the editor's „Pracownicy → Drukuj PDF") in the worker's
saved language? That covers column headers, opisy prac, section names and the rozliczenie footer. The
question also covers what the PDF shares with the investor offer PDF, and whether EX-949 makes the work
throwaway.

## Summary

- **The PDF is Polish-only today, and every input needed to translate it already exists.**
- **Language.** The worker's language is stored as `users.language`.
- **Opisy.** Translated opisy already ride inside the print data as `item.descriptionTranslations`; the
  PDF just never reads them.
- **Section names.** These need one extra read, `getSectionTranslations()`.
- **One translation helper covers opisy and section names.** `translateTree(tree, locale,
sectionTranslations)` is pure, already used by the worker's link, and applied before `treeToRows` it
  translates both in one step.
- **Labels.** The rozliczenie labels already exist in pl/uk/ru (`report.summary*`), and the footer reads
  `pl.report` directly. Swapping in the worker's dictionary is mechanical.
- **Column headers are the only real design question.** The PDF's Polish headers do not match the
  grid's dictionary keys („Stawka j.m." vs grid „Cena j.m. netto — …", „Pozostało" vs „Pozostało netto
  (względem przedmiaru)"). The choice is to reuse grid keys, which changes the Polish PDF's wording, or to
  add print-specific keys, which keeps the Polish PDF byte-identical.
- **The offer PDF must stay unchanged.** `print/build-html.ts` and `print/columns.ts` are shared with it,
  and they hard-code „Razem — ", `lang="pl"` and the „Opis prac" / „Przedmiar" / „Jednostka miary"
  columns. Any seam there needs a Polish default.
- **Money and dates stay pl-PL.** The worker's link formats everything pl-PL in every language, and
  switching `formatPLN` to a uk/ru locale would print „PLN" instead of „zł".
- **EX-949 does not make this throwaway.** It adds row numbers, a QR and an empty column to the same
  builder. EX-948's decision explicitly wants the PDF translated _first_, so EX-949 "builds on the
  dictionary".

## Detailed Findings

### The one call site, and how data reaches it

- Trigger: editor → „Pracownicy" menu → per-worker „Drukuj PDF"
  (`src/components/kosztorys/editor/kosztorys-workers-menu.tsx:80` →
  `src/components/kosztorys/editor/actions/worker-print-action.tsx`). The report link `(share)/z/…` and
  the Podgląd `(share)/podglad-pracownika/…` have no print path.
- The flow runs on the client (`worker-print-action.tsx:23-62`):
  1. `openPrintWindow` opens the window synchronously, on the click.
  2. The `'use server'` call `getWorkerKosztorysPrintData(investmentId, workerId)` fetches the data
     (`src/lib/queries/worker-kosztorys-print-endpoint.ts:8-13`).
  3. That call goes through `getWorkerKosztorysPreview` → cached `buildWorkerKosztorysData`
     (`src/lib/queries/worker-kosztorys.ts:45-148`, cache key `'worker-kosztorys-data-v5'` at `:114`).
  4. The client renders with `buildWorkerPrintHtml({ data, logoUrl, fillByColorKey })` and then
     `writeAndPrint`.
- The projection is the same one the link and the Podgląd use (`worker-kosztorys.ts:35-37`). It reads
  the worker with `select: { name: true }` only (`:53-61`). `WorkerAudienceT` / `WorkerKosztorysT`
  (`src/lib/kosztorys/worker-view/types.ts:8-34`) carry **no language and no section translations**.
- `buildWorkerPrintHtml` is called from nowhere else; the other caller is its spec
  `src/__tests__/lib/kosztorys/print/worker.test.ts`.

### Where the worker's language lives, and two routes to the PDF

- The field is `users.language`: text, validated against `LANGUAGES`, empty = Polish
  (`src/collections/users.ts:83-91`; column added in
  `src/migrations/20261001_0_description_translations.ts:17`).
- Its type is `LanguageT = 'pl' | 'uk' | 'ru'`, with `DEFAULT_LANGUAGE`, `toLanguage` and `isLanguage`
  (`src/lib/i18n/languages.ts:5-8,30,36`).
- The report link reads it in three steps:
  1. `readReportShare` selects `w.language AS worker_language` (`src/lib/db/worker-report-share.ts:28,42`).
  2. `getWorkerReportPage` sets `language` (`src/lib/queries/worker-report-page.ts:43-46`).
  3. `TranslationsProvider initialLocale` receives it (`worker-report-view.tsx:14`).

  The switcher on the link overrides it per worker in localStorage
  (`translations-provider.tsx:17-24`), and the PDF cannot see that override.

- **Route A (client).** The editor's `workers` roster is `WorkerRefT[]`, which already carries
  `language: LanguageT | null` (`src/types/reference-data.ts:39-43`; filled at
  `src/lib/queries/reference-data.ts:86,155`; held at `use-kosztorys-editor.ts:150,1394`).
  `WorkerPrintMenuItem` could read it from `useKosztorysEditorContext()`. `assignedWorkers` drops the
  field (`src/lib/kosztorys/worker-view/assigned-workers.ts:4,15`).
- **Route B (server).** Read the language in the print endpoint, or add `language: true` to the
  projection's select plus a field on `WorkerAudienceT` and a cache-key bump. Route B also lets the
  Podgląd open in the stored language. Today `getWorkerReportPreview` hard-codes `DEFAULT_LANGUAGE`
  (`worker-report-page.ts:60,74`); see Historical Context.
- Section translations must come from the server either way, so the print endpoint changes regardless.
  Returning the language from the same endpoint keeps it to one round trip and one source.

### Opisy and section names

- **Opisy (EX-948).**
  - Storage: `kosztorys_items.description_translations` jsonb `{ [lang]: { text, source } }`
    (`src/collections/kosztorys-items.ts:42-44`).
  - Mapping: `mapItem` → `descriptionTranslations` (`src/lib/db/kosztorys-tree.ts:156`).
  - Flow: the field passes through `buildWorkerKosztorysData` (`...tree`, `worker-kosztorys.ts:84`) and
    `treeToRows` (`src/lib/kosztorys/v2-rows.ts:8`).
  - **It is already in the PDF's `data.tree`** and is never read.
- **Section names (EX-965).**
  - Storage: a shared table `kosztorys_section_translations(name_key PK, translations jsonb)`, keyed by
    `sectionNameKey` with numbers as a `#` placeholder
    (`src/migrations/20261002_2_section_translations.ts:66-72`).
  - Read path: `listSectionTranslations` (`src/lib/db/section-translations.ts:17-24`) → cached
    `getSectionTranslations()` (`src/lib/queries/section-translations.ts:11-18`), used by
    `assembleReportPage` (`worker-report-page.ts:86`).
  - **Not in the print data.**
- **The helper.** `translateTree` (`src/lib/kosztorys/worker-report/translate-tree.ts:14-36`) is pure and
  returns the tree untouched for `pl`. Its rules:
  - a missing opis translation keeps the Polish opis;
  - a stale opis translation **still shows**, per decision (owner sees it flagged in „Problemy");
  - a section name with no translation, or a `#` count mismatch, keeps the Polish name.

  The link calls it at `report-grid.tsx:79`. Rows take `sectionName: section.name` (`v2-rows.ts:39`), so
  translating the tree before `treeToRows` (`print/worker.ts:91`) also covers the section band and its
  „Razem — {sekcja}" line.

### Every string the PDF prints, and its source

Abbreviations: `w` = `src/lib/kosztorys/print/worker.ts`, `wc` = `print/worker-columns.ts`,
`bh` = `print/build-html.ts`, `col` = `print/columns.ts`.

| Region  | String                                 | Where                                                                             | Source                                            | Shared with offer? |
| ------- | -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------ |
| Shell   | `<html lang="pl">`                     | bh:135                                                                            | hard-coded                                        | yes                |
| Shell   | `<title>` `{inwestycja} — {pracownik}` | w:117                                                                             | DB + `—`                                          | no                 |
| Header  | `Kosztorys — {pracownik}`              | w:115                                                                             | hard-coded „Kosztorys — "                         | no                 |
| Header  | investment name                        | w:116                                                                             | DB                                                | —                  |
| Column  | „Opis prac"                            | col:28 `DESCRIPTION_COLUMN`                                                       | constant                                          | **yes**            |
| Column  | „Przedmiar"                            | col:37 `PLANNED_QTY_COLUMN`                                                       | constant                                          | **yes**            |
| Column  | „Jednostka miary"                      | col:46 `UNIT_COLUMN`                                                              | constant                                          | **yes**            |
| Column  | „Stawka j.m."                          | wc:54                                                                             | hard-coded                                        | no                 |
| Column  | „Wartość przedmiaru"                   | wc:58                                                                             | hard-coded                                        | no                 |
| Column  | etap quantity → `stageLabel(stage)`    | col:97                                                                            | DB label; fallback „Etap N" from `POLISH_GRID`    | **yes**            |
| Column  | „Pomiar (razem etapy)"                 | wc:61 → `workerColumnLabel` → `COLUMN_LABELS.stageQtySum` (`column-config.ts:23`) | constant                                          | no                 |
| Column  | `{etap} netto`                         | col:112                                                                           | DB label + „ netto"                               | **yes**            |
| Column  | „Wartość wykonana netto"               | wc:64 → `WORKER_LABEL_OVERRIDES.net` (`worker-view/columns.ts:51`)                | constant (also used by the settings dialog)       | no                 |
| Column  | „Pozostało"                            | wc:65                                                                             | hard-coded                                        | no                 |
| Section | section name                           | bh:83,89                                                                          | DB, Polish                                        | —                  |
| Section | „Razem — {sekcja}"                     | bh:72                                                                             | hard-coded „Razem — "                             | **yes**            |
| Item    | opis                                   | col:32                                                                            | DB `row.description`, Polish                      | —                  |
| Item    | j.m.                                   | col:50                                                                            | DB `row.unit`; **no translation exists anywhere** | —                  |
| Footer  | 13 rozliczenie labels                  | w:35-81                                                                           | `pl.report.summary*`                              | no                 |
| Footer  | unnamed etap                           | w:58                                                                              | `stageLabel(stage)`, Polish fallback              | no                 |
| Footer  | share „40,0%" / „—"                    | w:60 → `stageShareLabel` (`worker-view/summary.ts:124-127`)                       | pl-PL percent                                     | no                 |
| Footer  | payout date / opis                     | w:74                                                                              | `formatPLDate` / DB                               | no                 |
| All     | amounts                                | w:38-76, wc:47,54,63                                                              | `formatPLN` (pl-PL, „zł")                         | —                  |

- „Razem netto" (bh:112) prints only on the offer; the worker passes its own `footerHtml` (bh:107-108,
  w:125).
- There is no empty-state text: an empty rozpiska prints the header over an empty `<tbody>`.
- Out of scope: the owner-facing toasts and the „Drukuj PDF" menu label in `worker-print-action.tsx` are
  the owner's UI.

### Dictionaries and translators, from a plain `.ts` module

- `src/lib/i18n/dictionaries/{pl,uk,ru}.ts` define namespaces `common`, `notices`, `report`, `grid`.
  `uk`/`ru` are typed `TranslationsT = typeof pl`, so a missing key fails the typecheck
  (`pl.ts:1-3`, `translations.ts:6`).
- `src/lib/i18n/translations.ts` is React-free. It provides:
  - `getTranslations(locale)` (:21)
  - `translate(locale, ns, key, params)` (:35)
  - `translatePlural` (:49)
  - `TranslatorT<NS>` (:72)
  - `createTranslator(locale, ns)` (:82, cached)
  - `POLISH_GRID` (:99)
- Non-React precedents:
  - `failureMessage(locale, …)` (`src/lib/i18n/failure-message.ts:15`)
  - `generateMetadata` → `translate(language, 'report', 'pageTitle')` (`(share)/z/[investment]/[name]/[token]/page.tsx:18`)
  - `(share)/z/not-found.tsx:16`
- Helpers that already take `dictionary = POLISH_GRID`:
  - `stageLabel` (`src/lib/kosztorys/stage-label.ts:7-12`)
  - `columnLabelForView(id, view, dictionary)` (`src/lib/kosztorys/columns/column-config.ts:74`)
  - `headerTipFor` (`header-tips.ts:59`)
  - `empty-grid-copy.ts:47`
- The `grid` header keys are at `pl.ts:92-105`: `description`, `plannedQty`, `unit`, `price`,
  `plannedNetForPlane`, `remainingForPlane`, `planeWithTools`, `planeOwnTools`, `netForPlane`,
  `stageQtySumForPlane`, `stageFallback`, `stageValueNetHeader`, `netSuffix`, `total`.
- **Wording mismatch.** The print labels are not the grid labels even in Polish:

  | PDF today                | Grid key                                                      |
  | ------------------------ | ------------------------------------------------------------- |
  | „Stawka j.m."            | `price` → „Cena j.m. netto — {plane}"                         |
  | „Wartość przedmiaru"     | `plannedNetForPlane` → „Wartość przedmiaru netto"             |
  | „Pozostało"              | `remainingForPlane` → „Pozostało netto (względem przedmiaru)" |
  | „Pomiar (razem etapy)"   | `stageQtySumForPlane` → „Pomiar — suma etapów {plane}"        |
  | „Wartość wykonana netto" | no key                                                        |

  Only „Opis prac", „Przedmiar", „Jednostka miary", the etap fallback, „{etap} netto" and „Razem" have
  an exact key.

- All 13 `report.summary*` keys exist in all three dictionaries. `summaryBalance` is unused by the PDF,
  whose balance table has no head row (the web one does, `worker-summary.tsx:74-75`).

### Number, money and date formatting

- `formatPLN` (`src/lib/utils/format-currency.ts:3,8`) is a module-level `Intl.NumberFormat('pl-PL',
PLN)`. A uk/ru locale would print „PLN" instead of „zł".
- `formatQty`, `formatPercentPrecise` (`src/lib/kosztorys/format.ts:20-62`) and `formatPLDate`
  (`src/lib/utils/format-date.ts:9`) are fixed to pl-PL. uk/ru dates would print the same
  `01.09.2026` anyway.
- The worker's link formats everything pl-PL in every language: `worker-summary.tsx` uses `formatNet` /
  `formatPLDate`. Keeping pl-PL formatters keeps paper and screen alike. One existing difference: the
  link prints a bare `formatNet`, while the PDF prints `formatPLN` with „zł".

### Natural seams

1. **`WorkerPrintArgsT` (w:17-21).** Add `locale: LanguageT` and `sectionTranslations`, or have the
   endpoint return them beside `data`. Inside `buildWorkerPrintHtml`:
   - `translateTree` before `treeToRows` (w:91);
   - `getTranslations(locale).report` for the footer (w:36);
   - a `createTranslator(locale, 'grid')` for `stageLabel` (w:58) and for `workerPrintColumns`;
   - a translated `documentKind` (w:115).
2. **`workerPrintColumns` (wc:22-37).** Takes a `TranslatorT<'grid'>` and passes it on to
   `stageQtyColumns` / `stageNetColumns`. Its five worker-only labels come from dictionary keys.
3. **Shared `print/columns.ts`.** Covers `stageQtyColumns(stages, dictionary = POLISH_GRID)`, the same
   for `stageNetColumns`, and a localizable form of the three column constants (factory or worker-side
   `label` override). The Polish default keeps the offer untouched.
4. **Shared `build-html.ts`.** Covers an optional `lang` (bh:135) and a section-total label (bh:72),
   both defaulting to Polish.
5. **Print endpoint (`worker-kosztorys-print-endpoint.ts:8-13`).** Returns the worker's `users.language`
   and `getSectionTranslations()`.

### Specs that pin the current Polish output

- `src/__tests__/lib/kosztorys/print/worker.test.ts` asserts Polish throughout:
  - document kind and title (104-105);
  - „Razem — Łazienka" (95, 125, 156, 195, 289);
  - footer labels (124-244);
  - header order „Opis prac" / „Wartość przedmiaru" / „Stawka j.m." (181-183, 258-259);
  - „Pomiar (razem etapy)" / „Wartość wykonana netto" (269-297);
  - „Etap 3" fallback (263).

  With a `pl` default these all stay green. A uk/ru case is new.

- `src/__tests__/lib/kosztorys/print/offer.test.ts` touches the shared modules and must stay green
  unchanged:
  - „Opis prac" (85, 317);
  - „Razem — …" (133-141, 298);
  - „Razem netto" (160);
  - stage headers (216-227).
- `src/__tests__/lib/kosztorys/worker-report/translate-tree.test.ts` already covers the reused helper.
- Neither print spec asserts `lang="pl"`.

## Code References

- `src/lib/kosztorys/print/worker.ts:17-21,33-81,89-125` — args, footer (reads `pl.report`), builder
- `src/lib/kosztorys/print/worker-columns.ts:22-70` — worker column set, five hard-coded labels
- `src/lib/kosztorys/print/columns.ts:26-51,97,112` — shared column constants and stage columns
- `src/lib/kosztorys/print/build-html.ts:6-28,72,112,135` — shared builder, „Razem — ", `lang="pl"`
- `src/components/kosztorys/editor/actions/worker-print-action.tsx:23-62` — the only caller
- `src/lib/queries/worker-kosztorys-print-endpoint.ts:8-13` — print data endpoint
- `src/lib/queries/worker-kosztorys.ts:45-148` — the projection, which reads only the worker's name
- `src/lib/kosztorys/worker-view/types.ts:8-34` — `WorkerAudienceT` / `WorkerKosztorysT`
- `src/lib/kosztorys/worker-report/translate-tree.ts:14-36` — reusable opis + section translation
- `src/lib/queries/section-translations.ts:11-18` — cached section translations
- `src/lib/i18n/translations.ts:19-99` — `getTranslations`, `translate`, `createTranslator`, `POLISH_GRID`
- `src/lib/i18n/dictionaries/pl.ts:75-87,91-130` — `report.summary*`, `grid` keys
- `src/lib/kosztorys/stage-label.ts:7-12` — `stageLabel(stage, dictionary)`
- `src/lib/kosztorys/columns/column-config.ts:18-60,74` — `COLUMN_LABELS`, `columnLabelForView`
- `src/lib/kosztorys/worker-view/columns.ts:49-56` — `workerColumnLabel`, Polish overrides
- `src/types/reference-data.ts:39-43` — `WorkerRefT.language`, already on the editor's roster
- `src/lib/queries/worker-report-page.ts:43-46,60,74,86` — link language; Podgląd hard-codes Polish
- `src/lib/utils/format-currency.ts:3,8`, `src/lib/utils/format-date.ts:9` — pl-PL formatters

## Architecture Insights

- **Two-layer helper with a Polish default.** `stageLabel`, `columnLabelForView` and `headerTipFor` take
  `dictionary: TranslatorT<'grid'> = POLISH_GRID`. Every caller that doesn't care stays Polish, and the
  worker surface passes its own translator. The same pattern lets the shared print modules gain a
  translator without touching the offer.
- **Raw data, named per surface.** `WorkerSummaryT` keeps the etap `label`/`ordinal` raw on purpose
  (`worker-view/summary.ts:36`) so each surface names an unnamed etap in its own language. The PDF is
  the last surface still naming it in Polish.
- **Translate at the edge.** The projection carries Polish text plus translations, and the surface picks
  one (`translateTree` on the link). The PDF should do the same rather than translate in the cached
  projection, which is shared with the Podgląd.
- **Dictionary as single source.** The footer already reads `pl.report.summary*`, so screen and paper
  cannot drift (review-gate finding, `worker-view-dogfooding/review-gate.md:40`). Moving the column
  headers into the dictionary extends the same guarantee to them.

## Historical Context (from prior changes)

- `context/archive/2026-10-01-worker-report-translations-ua/change.md` (EX-948):
  - :38-39 — "Every link, PDF and form a worker gets must be translated."
  - :55 — the worker PDF is in scope across the slices.
  - :61 — "Etapy names are owner-typed data and stay as typed."
  - :67-69 — "An unset worker reads Polish … in the PDF. The PDF takes the stored language, because it
    is printed from the editor and can't read the worker's switcher."
  - :70 — "Podgląd pracownika opens in the worker's language." The single-view plan later contradicted
    this (`context/changes/2026-10-05-worker-single-view/plan.md:194`), and the code hard-codes Polish.
  - :72-73 — this slice lands before EX-949, which "builds on the dictionary instead of translating
    the layout afterwards".
  - :97, :102 — a stale translation is shown as is; a missing one falls back to Polish.
- `context/archive/2026-10-02-kosztorys-section-translations/change.md` (EX-965):
  - :25 — sections have no stale state;
  - :35-36 — "/p, „Podgląd pracownika" and the PDF go to EX-966 on the same lookup".
- `context/changes/2026-10-05-worker-single-view/change.md:16,27` and `plan.md:82` (EX-966) — "The
  worker PDF is unchanged here; EX-949 rebuilds it." The PDF was left out of EX-966's slice, and this
  change picks it up.
- `context/changes/2026-10-05-worker-view-dogfooding/review-gate.md:21,40` — "the PDF stays Polish on
  purpose" (the gate's scope call); the footer moved onto `pl.report.summary*`.
- `context/archive/2026-09-30-worker-work-reports/change.md:83-85` — EX-949: "the worker PDF gains a
  row number per line and a QR (worker + etap) and an empty column; a scan becomes a draft report". This
  is additive, so the translation inputs survive it.
- `context/foundation/lessons.md:2404` — print vertical margins belong on `@page`. This doesn't touch
  translation, but any layout tweak for longer Cyrillic headers must respect it.
- `context/foundation/lessons.md:2512` — the worker's own link/PDF is one of the five homes of
  „Pozostało do wypłaty". Labels change, figures do not.

## Related Research

- `context/archive/2026-10-01-worker-report-translations-ua/` — EX-948 research/plan (opis translations)
- `context/archive/2026-10-02-kosztorys-section-translations/` — EX-965 (section name translations)

## Open Questions

1. **Column-header wording.**
   - **(a) Reuse grid keys.** The PDF's Polish headers change to the grid's („Cena j.m. netto — …",
     „Pozostało netto (względem przedmiaru)") and match the link.
   - **(b) Add print keys.** New dictionary keys hold today's PDF wording, so the Polish PDF stays
     identical.

   Recommendation: (b) for the five worker-only labels, and grid keys where the wording already matches
   (opis, przedmiar, j.m., etap fallback, „{etap} netto", „Razem").

2. **Who picks the PDF's language?** Per EX-948 the PDF takes the stored language. Should the owner also
   be able to print the Polish copy of a uk/ru worker's PDF, for themselves? This is the owner's call; the
   default is the stored language only.
3. **Jednostki miary.** „szt.", „mb", „kpl." are Polish abbreviations, and no unit translation exists
   anywhere. Leave them as typed (like etap names), or translate a fixed set? The link shows them as
   typed today.
4. **Podgląd language.** EX-948 (:70) said the Podgląd opens in the worker's language; the code opens it
   in Polish. Route B (language from the server) would make that a one-line fix, but it is outside this
   change unless the owner wants it.
5. **Language source.** Route A uses the client roster `WorkerRefT.language`; route B uses the print
   endpoint. Section translations force an endpoint change anyway, so B is one round trip and one source.
   Recommendation: B, reading the language in the endpoint rather than in the cached projection.
6. **Uncommitted work in the shared tree.** Another session is editing
   `src/components/kosztorys/editor/grid/*` and `use-kosztorys-editor.ts` (column colors). The PDF work
   should stay out of those files. Route A would touch the editor context; route B wouldn't.
