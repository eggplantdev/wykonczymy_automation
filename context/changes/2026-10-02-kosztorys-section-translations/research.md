---
date: 2026-10-02T08:12:51+02:00
researcher: Claude (Opus 5.5)
git_commit: 716933960261b2992ac014108a502f48a46bf0f9
branch: staging
repository: wykonczymy
topic: "EX-965 — where a kosztorys section name's UA/RU translation lives, and what translating it on the report link touches"
tags: [research, codebase, i18n, kosztorys-sections, worker-report, translations]
status: complete
last_updated: 2026-10-02
last_updated_by: Claude (Opus 5.5)
---

# Research: translating section names on the worker report link (EX-965)

**Date**: 2026-10-02T08:12:51+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 71693396
**Branch**: staging
**Repository**: wykonczymy

## Research Question

EX-965: on `/zgloszenie-prac/…` opened in UA/RU, opisy and UI strings are translated but section
names stay Polish. Etapy stay untranslated (owner, 2026-10-01). Decide where a section's translation
lives — **on the section row** (mirroring EX-948's `description_translations`) or **in a shared
catalogue of section names** — and whether the fill script covers sections.

## Summary

- **The vocabulary is tiny and generic.** Local DB: 430 sections across 35 investments use **24
  distinct names** after normalising (`lower` + `trim` + collapsed spaces); open investments use 22.
  The dump file (newer than the local DB) shows 613 rows / 26 names — same picture. No addresses, no
  personal names; the long tail is 5 rows (`pralnia`, `Łazienka 1 wanna`, `Łazienka 2 prysznic`,
  `Łazienka WC`, `Nowa sekcja` ×2).
- **Names come almost entirely from the szablon.** Both szablony carry the same 11 names; every new
  kosztorys copies them. Variants exist only because the szablon was reworded once (2026-09-23):
  `…i oświetlenie` / `…i oświetleniowa`, `/ c.o.` / `+ c.o.`, `ślusarki` / `ślusarski`,
  `Wyburzenia i demontaże` / `Wyburzenia, demontaże, zabezpieczenia`, plus a trailing-space copy.
- **The swap point is one function.** Every section name on the report page reads
  `tree.sections[].name` (band, „Razem …" footer, itemless bands, search).
  `translateTree` (`src/lib/kosztorys/worker-report/translate-tree.ts:8-20`) swaps opisy and leaves
  `section.name` alone — translating sections is a change there, under either design.
- **Sending is unaffected.** The send copies the Polish name from the **server** tree onto
  `worker_report_lines.section_name` (`src/lib/actions/worker-report.ts:42-65`), which only the
  manager reads. The client-side swap never reaches it.
- **No section catalogue exists today.** The nearest thing is `work_catalogue_items.category` (15
  values), which is _derived from_ section names via `stripSectionOrdinal`
  (`src/lib/kosztorys/work-catalogue/section-category.ts`) — but its wording diverges from the
  szablon on 4 names and lacks Wiatrołap / WC, so it cannot serve as the catalogue as-is.
- **Evidence leans to a shared lookup keyed by normalised Polish name** — 22 translations cover
  100% of open investments, versus ~430 row copies of the same strings and ~9 threading sites for an
  on-row column. The cost of the lookup is who maintains new names (see Open Questions).

## Detailed Findings

### Section data model

- Table `kosztorys_sections`: `id, investment_id (FK, CASCADE), name varchar NOT NULL,
display_order, color, created_at, updated_at` (`src/migrations/20260708_2_add_kosztorys_sections_items.ts:10-22`,
  `color` from `20260726_2_…`). Payload collection `src/collections/kosztorys-sections.ts:29-37`;
  domain type `KosztorysSectionT` at `src/lib/kosztorys/types.ts:25-32`.
- **Section ids are not stable** — restore, szablon apply/append/reload and sheet import all
  wipe-and-reinsert with fresh serial ids (`restore-kosztorys.ts:35`, `insert-kosztorys-tree.ts:69-75`;
  lessons.md § "Wipe-and-reinsert is safe…", line 253). So anything keyed on section id is lost on
  every restore unless the field travels in the snapshot.
- **The name is the section's identity by owner ruling (2026-09-22)**, matched by `lower(btrim(name))`
  (`create-section-with-catalogue-items.ts:13-28`, `section-target.ts:5`). A name-keyed lookup is
  therefore consistent with how the app already identifies sections.

### Where section names originate

| Path                            | Name source                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| „Dodaj sekcję"                  | placeholder `DEFAULT_SECTION_NAME = 'Nowa sekcja'` (`constants.ts:42`, `create-section.ts:19-26`), then renamed       |
| Rename                          | `updateSectionFieldAction` (`src/lib/actions/kosztorys.ts:134-146`, schema `:68-74`)                                  |
| Szablon apply / reload / append | copied verbatim from the szablon's own rows (`apply-preset.ts:25` → `insertSections`, `append-preset-sections.ts:46`) |
| Sheet import                    | header row marked `x` in Przedmiar (`parse-labor-tab.ts:138-156`) → `build-import-plan.ts:202`                        |
| Katalog → kosztorys             | typed/picked name (`create-section-with-catalogue-items.ts:77-81`); katalog `category` is not used                    |
| AI generation                   | creates no sections — seeds from szablon #165 and appends into existing ones by name                                  |
| Snapshot restore                | from the snapshot JSON (`restore-kosztorys.ts:35-38`)                                                                 |

### The report page — where section names render

- Language: `page.tsx:29` → `TranslationsProvider initialLocale={page.language}`; localStorage
  override in `translations-provider.tsx:17-24`.
- Swap: `report-grid.tsx:72` passes `translateTree(document.tree, locale)`; body is keyed by locale.
- Section band: `grid/cells/section-header-cell.tsx:144-145` (compact) / `:157` (full), from
  `rowData.sectionName`, which `v2-rows.ts:39` fills from `section.name`.
- „Razem <name>" footer: `section-footer-cell.tsx:42-45` — only in „Wszystkie kolumny".
- Itemless bands: `buildSectionBandRows` (`kosztorys-editor-body.tsx:333`).
- Search matches `sectionName` (`row-view.ts:14`) — after a swap it matches the translated name.
- **Not on the page:** a „Sekcja" column (hidden, not in `WORKER_DOCUMENT_COLUMNS`), a section
  rail/menu, section in the „Prace spoza rozpiski" dialog (extras store `sectionName: null`), section
  in the sent-reports history (`sent-reports.tsx:23-37`: date, count, status only).

### What EX-948 built for opisy (the template an on-row design would mirror)

- Storage: `description_translations jsonb NOT NULL DEFAULT '{}'` on `kosztorys_items` and
  `work_catalogue_items` (`src/migrations/20261001_0_description_translations.ts:14-16`). Value type
  `DescriptionTranslationsT = Partial<Record<lang, { text, source }>>`
  (`src/lib/i18n/description-translations.ts:10-18`); `source` = the Polish text it was made from,
  powering `isTranslationStale` (`:41`).
- Languages: `src/lib/i18n/languages.ts:5` `['pl','uk','ru']`; a new language is a list entry + files.
- Manager surfaces: hidden „Opis prac (UA/RU)" grid column (`translation-column.tsx`,
  `column-config.ts:93-95,235`), stale problem (`problems/registry.ts:564-574`), katalog column and
  „bez tłumaczenia" / stale problems (`catalogue-conditions.ts:56-72`).
- Fill: `src/scripts/fill-description-translations.ts` + pure `src/lib/i18n/translation-fill.ts`;
  `export` / `import <tsv> [--apply]`, exact-trimmed-Polish match, fills only empty; TSVs in
  `src/scripts/data/description-translations-{uk,ru}.tsv` (`<pl>\t<translation>`).

### Cost of an on-row `name_translations` column

Threading sites (from the copy-path map):

1. Migration + collection field (`kosztorys-sections.ts`).
2. `KosztorysSectionT` (`types.ts:26`) and `SectionMetaT` (`:255`).
3. Tree read: SELECT `db/kosztorys-tree.ts:63`, `mapSection` `:142`.
4. `SECTION_INSERT_COLUMNS` + VALUES tuple (`insert-rows.ts:19,97-100`).
5. Snapshot tolerance for old payloads (`snapshot-format.ts:112`).
6. Hand-built shapes: `append-preset-sections.ts:62-66`, `create-item.ts:20-43`,
   `create-section-with-catalogue-items.ts:84-87`, `parse-labor-tab.ts:150`.
7. Rename semantics (stale vs cleared) in `updateSectionFieldAction`.
8. A manager editing surface — sections have no `diffRow` lane; edits go through
   `applySectionField` / `SECTION_ROW_FIELDS` (`use-kosztorys-editor.ts:1134-1158`), so a section
   translation cell is new UI on the section band, not a reuse of the item column.
9. Cache-key bump: `worker-kosztorys-data-v3` (`queries/worker-kosztorys.ts:114`) and siblings,
   since the tree shape changes.

Guards that would force part of it: `insert-schema-drift.test.ts:30-35` (DB-backed, checks
`SECTION_INSERT_COLUMNS`), `kosztorys-tree-sql-drift.test.ts:25`, `serialize-restore-roundtrip.test.ts`.

Upside the on-row design keeps: szablon apply would carry translations into every new kosztorys for
free (copy semantics), and the manager could fix a one-off name per section.

### Cost of a shared lookup keyed by normalised name

- No migration, no tree-shape change, no threading, no cache bump: the tree stays Polish and
  `translateTree` looks the name up.
- Normalisation: `lower(trim(collapse-spaces))`. Numbered rooms: strip a trailing ordinal
  (`stripSectionOrdinal` already exists), translate the base, re-append the number — `Łazienka 2` →
  `Ванна кімната 2`. Mid-string numbers (`Łazienka 1 wanna`) need their own entry or fall back.
- Miss → Polish, as untranslated opisy already do.
- Storage choices: (i) a code-side data file per language (fits "a language = a list entry plus
  files"; a new name needs a deploy), or (ii) a small DB table with a manager editing surface (new
  names fixable without a deploy, but needs UI + migration).

## Code References

- `src/lib/kosztorys/worker-report/translate-tree.ts:8-20` — the single swap point; translates items only
- `src/components/kosztorys/worker-report/report-grid.tsx:72` — applies `translateTree`
- `src/components/kosztorys/editor/grid/cells/section-header-cell.tsx:144-157` — section band text
- `src/components/kosztorys/editor/grid/cells/section-footer-cell.tsx:42-45` — „Razem <name>"
- `src/lib/kosztorys/v2-rows.ts:39` — `sectionName` filled from `section.name`
- `src/lib/kosztorys/work-catalogue/section-category.ts` — `stripSectionOrdinal`
- `src/lib/actions/worker-report.ts:42-65` — send copies Polish name from the server tree
- `src/lib/i18n/description-translations.ts` — translation value type, stale check
- `src/lib/i18n/languages.ts:5` — language list
- `src/scripts/fill-description-translations.ts` — opis fill script (template for a section variant)
- `src/lib/kosztorys/print/worker.ts:55-57`, `print/build-html.ts:72,83-89` — PDF section names (EX-966)
- `src/lib/queries/worker-kosztorys.ts:45-114` — `/p` + PDF projection (EX-966)

## Architecture Insights

- **One identity rule already exists for sections: the normalised name.** A name-keyed lookup
  follows it; an on-row field adds a second thing to keep in step with the name.
- **The swap is presentation-only and client-side.** The tree, the draft and the send all stay
  Polish and keyed by id — the same contract EX-948 set for opisy. Translating sections in
  `translateTree` keeps that contract.
- **EX-948 chose on-row for opisy for reasons that don't carry over:** hundreds of distinct opisy,
  per-row edits, katalog changes not rewriting existing rows, and a stale warning tied to each row's
  own Polish text. Sections have ~22 names, no catalogue, and their name _is_ their identity.

## Historical Context (from prior changes)

- `context/changes/2026-10-01-worker-report-translations-ua/plan-brief.md` — "stage, section and unit
  names as data" explicitly out of scope; EX-965 reverses it for sections only.
- `context/changes/2026-10-01-worker-report-translations-ua/change.md` — "Translations of prace live
  on the row, copied like the opis… replaces the separate text dictionary and the read-through from
  the katalog"; "Built for more languages than UA… one list entry plus files, with no migration".
- Linear EX-965 — "Etapy: nie" (owner, 2026-10-01); the new rule goes into
  `context/reference/kosztorys-editor-domain-notes.md`.
- Linear EX-966 — `/p`, „Podgląd pracownika" and the PDF follow; whichever lookup this change builds
  is what EX-966 reuses for section names there.

## Related Research

- `context/changes/2026-10-01-worker-report-translations-ua/research.md`
- `context/changes/2026-10-01-kosztorys-item-catalogue-link/research.md` (identity-by-text verdict)

## Open Questions

1. **Storage — the decision this change turns on.** Code-side file per language / DB table with a
   manager editor / on-row column. Evidence favours a lookup; the remaining trade-off is whether a new
   section name (a rename, „pralnia") must be translatable without a deploy.
2. **Manager visibility.** Does the rozpiska need a „sekcja bez tłumaczenia (UA)" problem? Only useful
   if the manager can act on it (rules out the code-file option unless the fix is "tell Claude").
3. **Numbered names.** Translate the base and re-append a trailing number (`Łazienka 2`)? Mid-string
   numbers (`Łazienka 1 wanna`) — own entry or Polish fallback?
4. **Szablon wording variants.** Translate both spellings, or first normalise the old rows to the
   szablon wording? (Cleanup is a separate data change; translating both is cheap.)
5. **Scope of this change.** Report link only (per issue); `/p` and the PDF pick it up in EX-966 by
   calling the same lookup.
