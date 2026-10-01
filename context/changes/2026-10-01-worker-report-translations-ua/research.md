---
date: 2026-10-01T07:53:53+0200
researcher: Claude (Opus 5.5)
git_commit: 4039d4f4
branch: staging
repository: wykonczymy
topic: 'EX-948 — Ukrainian translations: work catalogue, worker language, worker-page UI strings'
tags:
  [
    research,
    codebase,
    work-catalogue,
    worker-report,
    worker-view,
    i18n,
    users,
    catalogue-conditions,
  ]
status: complete
last_updated: 2026-10-01
last_updated_by: Claude (Opus 5.5)
last_updated_note: 'Added follow-up: identity by id vs by opis — split into two questions'
---

# Research: EX-948 — Ukrainian translations for the worker surfaces

**Date**: 2026-10-01T07:53:53+0200
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 4039d4f4
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Ground slice 2 of EX-946 in the code. The agreed shape (slice 1's `change.md` § The arc, point 2;
untagged, not an owner ruling) is:

- a translation table keyed by **catalogue item × language**, where a rozpiska pozycja resolves to its
  catalogue item by opis + j.m.;
- a language set on the worker;
- a small UI-string dictionary;
- translations authored by Claude as an export → translate → import;
- a manual „Tłumaczenie (UA)" field and a „bez tłumaczenia" problem filter for new catalogue items;
- identity never going through translated text.

## Summary

- **All of it lands on existing seams. Nothing here needs a new mechanism.**
  - The catalogue already has an identity key (`match_key`, UNIQUE).
  - The katalog page already has a „Problemy" registry.
  - The report page's token lookup already joins `users`.
  - The report page's data is read uncached after a cached core, so a translated opis can be swapped
    in data-side without touching any cache key.
- **The design has a coverage hole.**
  - A pozycja has no stored link to the catalogue. It resolves by `catalogueKey(opis, j.m.)` on every
    read.
  - Only **69.2 %** of used pozycje match a catalogue entry exactly (2026-09-29 measurement on a prod
    copy). The other 27 % carry older, generic names, such as „Fugowanie ścian i podłóg" against the
    catalogue's format variants.
  - Translations keyed by catalogue item would therefore leave roughly a third of rozpiska lines in
    Polish. Keying by the fold key instead of the catalogue id closes most of that gap (see Open
    Questions §1).
- **Catalogue ids are not stable identities.**
  - Rows are hard-deleted: ~379 of 940 are gone already.
  - Rows are renamed in place, by „Edytuj", the compare dialog and „Nadpisz w katalogu", which
    rewrites `description` + `match_key` on the same id.
  - Ids differ across environments for any row created outside prod.
  - A translation keyed by id goes silently stale on a rename. The earlier bulk text fix
    (`fix-work-catalogue-texts`) keyed its TSV by `match_key` for exactly the cross-environment reason.
- **The UI strings split in two.**
  - About 70 strings are owned by the report surface and can be translated in place.
  - The rest is grid copy in shared editor modules: `COLUMN_LABELS`, empty and search states, section
    bands, `polish-plural`, `WORKER_SCOPE_BLOCK_MESSAGES`, `UNIT_SUGGESTIONS`. These need a seam, not
    an in-place edit.
  - The compact report view (Opis + Zgłaszam + j.m.) touches very little shared copy. „Wszystkie
    kolumny" touches all of it.
- **There is no i18n infrastructure.**
  - `lang="pl"` is hard-coded in the `(share)` layout.
  - Number formatting can stay `pl-PL`, because Ukrainian also uses a decimal comma.
  - Plural forms cannot stay: Polish and Ukrainian treat 21, 31, … differently.

## Detailed Findings

### 1. The work catalogue: model and identity

**Model**

- A Payload collection `work-catalogue-items` (`src/collections/work-catalogue-items.ts:5-91`).
- Writes go through Payload. Reads go through raw SQL (`src/lib/db/work-catalogue.ts:13`).
- Columns: `description`, `category`, `unit`, `client_price`, the two rates and their coefficients,
  `match_key` (NOT NULL, UNIQUE index `work_catalogue_items_match_key_idx`, migration
  `20260901_0:27-28`), and timestamps.

**Size**

- Prod (dump 2026-10-01): **561 rows**, ids 1–939 with gaps, all created 2026-09-02. No row has been
  created in the app on prod yet. The translation batch is ≈ 561 opisy averaging ~50 chars.
- Stale counts remain in comments: „843" at `build-catalogue-comparison.ts:231` and „~950" at
  `work-catalogue-data-table.tsx:138,207`.

**Identity key**

- `catalogueKey(description, unit) = foldDescription(desc) + '|' + (foldUnit(unit) || '~')`
  (`src/lib/kosztorys/work-catalogue/catalogue-key.ts:15-17`).
- `foldDescription` (`sheet-import/item-key.ts:35-43`) applies, in order:
  - lowercasing, stripping diacritics and collapsing whitespace;
  - the `TYPO_FIXES` substring rules;
  - the 938-entry whole-name `CATALOGUE_NAME_FIXES` (`catalogue-name-fixes.ts`).
- The key is computed for writes in exactly one place: `catalogueRow` (`write-catalogue-entry.ts:18-28`).
- **The stored key drives the matching.** Readers build a lookup from the _stored_ `match_key` and
  probe it with a _freshly computed_ key (`build-catalogue-comparison.ts:157,182`,
  `already-in-kosztorys.ts:42`).
- Widening the fold therefore owes a backfill (`lessons.md:1794`). A drift spec guards it:
  `__tests__/lib/kosztorys/work-catalogue/catalogue-key-collisions.test.ts:40-45`, with a floor of
  `> 500` against 561 rows, which is a thin margin.
- The „[stary arkusz]" marker is gone from both data and code (`20260922_1_catalogue_legacy_marker_cleanup.ts`).
  The `lessons.md:1636` hazard is retired.

**How a pozycja resolves to a catalogue entry**

- `kosztorys_items` has no `match_key` and no catalogue FK. Resolution is always computed.
- The callers are:
  - `buildCatalogueComparison` (`build-catalogue-comparison.ts:152-225`);
  - `partitionAlreadyInKosztorys` (`already-in-kosztorys.ts:18-44`);
  - `catalogue-to-kosztorys.ts:195-217`;
  - `catalogueSwap` (`line-draft.ts:46-60`).
- A pozycja matches 0 or 1 entries, since the key is unique. One entry matches many pozycje across
  sekcje. A nameless pozycja is skipped.
- A rename that the fold does not absorb drops the pozycja to „spoza katalogu", a documented blind
  spot at `already-in-kosztorys.ts:29-31` that the owner accepted (domain notes `:944-947`).
- **Coverage**: 1040 used pozycje across 24 kosztorysy; 69.2 % exact matches; 27 % (284) match
  nothing (`context/archive/2026-09-28-catalogue-filters-and-usage/change.md:38-42`).

**Lifecycle hazards for a table keyed by catalogue id**

- Hard delete: `deleteCatalogueItemAction` (`src/lib/actions/work-catalogue.ts:66-77`). There is no
  trash.
- In-place rename:
  - `updateCatalogueItemAction` (`:44-64`);
  - overwrite mode of `saveItemToCatalogueAction` (`:100-135` → `write-catalogue-entry.ts:72-77`),
    which rewrites the row from the pozycja;
  - `src/scripts/fix-kosztorys-descriptions.ts:64-106` (raw SQL, `CATALOGUE=1 APPLY=1`).
- No merge action exists; near-duplicates are only flagged. No re-import exists either: the 2026-09-02
  load was a one-off, insert-only load by `match_key`.

### 2. Writers and the katalog page (manual field + „bez tłumaczenia")

**Page and data**

- Page: `src/app/(frontend)/katalog-prac/page.tsx` → `WorkCatalogueDataTable`
  (`src/components/work-catalogue/work-catalogue-data-table.tsx`). Columns are in
  `src/components/tables/work-catalogue.tsx`.
- Data: `getWorkCatalogue`, `unstable_cache` key `['work-catalogue']` (no version suffix), tag
  `collection:work-catalogue-items` (`src/lib/queries/work-catalogue.ts:20-27`).
- If `WorkCatalogueItemT` (`src/lib/kosztorys/work-catalogue/types.ts:12-23`) gains a field, the key
  needs a version bump. Otherwise the first read after deploy serves rows without it, and „bez
  tłumaczenia" counts every row.

**„Problemy"**

- Registry: `src/lib/kosztorys/work-catalogue/catalogue-conditions.ts`. Shape:
  `{ id, kind: 'problem'|'filter', group, label, matches(entry) }` (`:14-21`).
- Existing problems are `catalogue-no-price`, `catalogue-zero-rate-<plane>` (`:37-54`) and
  `catalogue-near-duplicate` (`:91-110`).
- Ids persist in localStorage under `'work-catalogue-filters'`. Problems are mutually exclusive via
  `CATALOGUE_PROBLEM_IDS`.
- A „bez tłumaczenia (UA)" entry is one more `PROBLEMS` item. Menu, chips (`catalogue-active-filters-model.ts:41-53`)
  and counts follow with no other wiring. `listCatalogueItems` (`db/work-catalogue.ts:56-60`) must
  carry the field.
- **This is the „Problemy" the slice-1 note means.** The note says the field and filter cover _new
  catalogue items_, and translations are keyed by catalogue item. The kosztorys editor's
  `ROW_CONDITIONS` „Katalog prac" group (`row-conditions/registry.ts:419-438`) could get a sibling
  („this pozycja will show Polish to a UA worker"). That would cost a third set on `ctx.catalogueRowIds`
  computed in `use-kosztorys-editor.ts:447-477`, the EX-496 perf-sensitive hook. It is optional.

**The „Tłumaczenie (UA)" field**

- It belongs in `WorkCatalogueItemForm` (`src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx:76-98`),
  right after „Opis pracy".
- Schema: `work-catalogue-item-schema.ts:52-66` (form layer), `:137-148` (empty values),
  `:163-173` (domain layer). Edit defaults: `edit-catalogue-item-dialog.tsx:32-38`.
- The form is shared by three dialogs: add, edit, and from-kosztorys
  (`editor/dialogs/catalogue/catalogue-item-from-kosztorys-dialog.tsx:88-95`). The field appears in
  all three.
- Writers that would have to carry or preserve the translation:
  - `createCatalogueItemAction` (`:21-42`);
  - `updateCatalogueItemAction` (`:44-64`);
  - `saveItemToCatalogueAction` (`:100-135`). In overwrite mode it must not null the translation. A
    separate table survives this naturally; a column would need a `keep` like `category`.
  - `addItemAction` with `catalogue` (`src/lib/actions/kosztorys.ts:490-549`), the new-item dialog's
    „also save to catalogue".
- All of them revalidate `['workCatalogue']`.

### 3. Import pattern (export → translate → import)

All three precedents were deleted after use and are recoverable from git:

- `git show 5599b877^:src/scripts/legacy-sheet-import/export-catalogue.ts`:
  - JSON on stdout, logs on stderr;
  - refuses on key collisions;
  - awaits the stdout write before exit.
- `git show 5599b877^:src/scripts/legacy-sheet-import/import-catalogue.ts`:
  - stdin input; empty input is an error;
  - dry-run by default, `--apply` to write;
  - `ON CONFLICT (match_key) DO NOTHING`.
- `git show 4de2666e^:src/scripts/fix-work-catalogue-texts.ts` with `src/scripts/data/work-catalogue-fixes.tsv`:
  - **keyed by `match_key`, not id**, because „the same praca carries a different id on production,
    on the local Docker and in the E2E fixture";
  - two-pass matching, so it is idempotent;
  - aborts on collisions;
  - one transaction via `withPayloadTransaction`.

Two more points:

- Auth in all three: `getPayload({ config })` + `getDb(payload)`, run with
  `node --env-file=.env --import tsx …`. Prod is named at the call site
  (`DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" …`), which a human runs.
- A raw-SQL import does **not** expire `collection:work-catalogue-items`. It must bump the tag or
  write through Payload.
- `insertCatalogueItems` / `listCatalogueMatchKeys` (`db/work-catalogue.ts:83-118`) have no callers
  any more. That is dead code, out of scope here.

### 4. Worker language

**Where it is stored**

- A worker is a `users` row (`src/collections/users.ts:78-157`), with fields `name`, `role` (a
  `select`, a Postgres enum), `active` and `defaultCashRegister`. No separate worker collection
  exists, and nothing restricts etap membership to `EMPLOYEE`.
- Migration template: `src/migrations/20260921_0_media_kind.ts:8-27`, which uses a guarded
  `DO $$ CREATE TYPE`, `ADD COLUMN IF NOT EXISTS` and a reverse-order `down`.
- Use `DEFAULT 'pl' NOT NULL` so existing rows need no NULL handling, as `role` did
  (`20260211_204911_add_user_role.ts:5-6`). Register the migration in `src/migrations/index.ts`; the
  current tail is `20260930_3_cash_register_trashed_at`.

**Editing it**

- Schema: `src/components/forms/worker-form/worker-schema.ts:6-21`.
- Form: `worker-form.tsx`, with a „Język" select after „Rola" (`:76-86`) and `toData` at `:52-60`.
- Dialogs: `add-worker-dialog.tsx:11-15` and `edit-worker-dialog.tsx:28-36`.
- Actions: `src/lib/actions/workers.ts:6-44`, which revalidate `['users']`.
- Employee card: `src/app/(frontend)/pracownicy/[id]/page.tsx:49-54` (`infoFields`).
- Reference data: `WorkerRefT` (`src/types/reference-data.ts:38-41`) and the SQL in
  `src/lib/queries/reference-data.ts:77-81,133-141`. Its cache key `['reference-data-v3']` needs a
  bump if the shape changes (`:166-176`).

**Reading it on the public pages**

- **Report page**: add `w.language` to `readReportShare` (`src/lib/db/worker-report-share.ts:22-29`)
  and to `ReportShareT` (`:5-11`). This is uncached and runs on every request. Both readers get it for
  free:
  - the page, including refusal notices shown before any document loads
    (`src/lib/queries/worker-report-page.ts:29-40`);
  - `tokenAction` (`src/lib/actions/token-action.ts:45-53`).
- **Gap**: `validateAction` and the duplicate-line check in `sendWorkerReportAction`
  (`src/lib/actions/worker-report.ts:29-35`) run _before_ the share is read, so their errors cannot
  know the language.
- **`/p` link**: the worker is read inside the cached builder `buildWorkerKosztorysData` with
  `select: { name: true }` (`src/lib/queries/worker-kosztorys.ts:53-61`). That builder is cached under
  `['worker-kosztorys-data-v2']` and tagged `WORKER_KOSZTORYS_TAGS`, which already includes `users`
  (`:24-33`).
  - The same cached build serves the owner's Podgląd (`(share)/podglad-pracownika/[worker]/[id]`) and
    the PDF.
  - So the language must apply only on the token route, never on Podgląd.

### 5. The report page: where a translated opis goes

**Route and loading**

- `src/app/(share)/zgloszenie-prac/[name]/[token]/page.tsx` has no layout, loading or not-found of
  its own. An unknown token gets Next's default English 404.
- The shared `src/app/(share)/layout.tsx:18` hard-codes `<html lang="pl">`. It receives no params, so
  a per-worker `lang` needs a nested layout or moving `<html>` out.
- Loader: `getWorkerReportPage` (`worker-report-page.ts:26-50`), shown below.

```ts
const [document, pending, sentReports] = await Promise.all([
  getWorkerKosztorysByReportShare(share), // cached core, shared with /p, Podgląd, PDF
  pendingQtyByItem(db, share.investmentId, share.workerId),
  listWorkerReports(db, share.investmentId, share.workerId),
])
```

**Substitute data-side, after this read.** Swap `tree.sections[].items[].description` before
returning. The reasons:

- Search filters on `row.description` (`src/lib/kosztorys/row-view.ts:13`). A render-side swap would
  search in Polish.
- Row heights are measured from the cell value (`row-content-lines.ts:36`, with `sizeToContent = preview`).
  A render-side swap would size rows to the Polish text.
- The opis is read-only in report mode. `preview` sets `readOnly`, which disables every data column
  (`use-kosztorys-editor.ts:189`, `kosztorys-v2-columns.tsx:368`); only the report column is editable.
- Send copies the **Polish** opis from its own fresh server tree (`worker-report.ts:41-66`). The client
  sends only `itemId`. So the stored report and the kierownik's review stay Polish without effort.
- Never inside the cached builder: its key has no language, and Podgląd/PDF share it.

**Resolution cost**

- `catalogueKey` per pozycja on the worker's rows means one catalogue (or translation) read plus a
  fold per row.
- `foldDescription` runs 938 whole-name lookups as a map hit, not a scan. Check that against
  `test-plan.md` risk 10 (katalog hint-search cost) before assuming it is free on a 1000-row rozpiska.

### 6. UI strings on the worker surfaces

**Owned by the report surface (~70 strings, safe to translate in place)**

- `page.tsx:7` (title)
- `branded-header.tsx:15-19`
- `worker-report-form.tsx:40-46` (sent screen)
- `report-grid.tsx:33,85-104` (vanished notice, „Wszystkie prace / kolumny")
- `report-bar.tsx:20` (search placeholder)
- `report-column.tsx:46-48,77-78` („Zgłaszam", „Czeka" with their hints)
- `send-bar.tsx:67-88` (toast, button, confirm)
- `sent-reports.tsx:7-17` (statuses)
- `draft-extra-works.tsx:9`, `extra-works-dialog-button.tsx:40-66`, `extra-work-rows.tsx:31-72`
- `src/lib/kosztorys/worker-report/refusals.ts:4-9` (`REPORT_REFUSALS`, shown on the page and
  returned by `tokenAction`)
- `src/lib/actions/worker-report.ts:17-71` (server errors that reach the toast)
- `worker-report/schemas.ts:21-22`

**Shared with the manager's editor or app-wide (need a seam, not an in-place edit)**

- `schemas.ts:9`: the quantity message, shared with `acceptSchema`.
- `src/lib/kosztorys/worker-view/labels.ts:4-6`, `WORKER_SCOPE_BLOCK_MESSAGES`. Also used by `/p`,
  the workers menu, `worker-print-action.tsx:39` and `kosztorys-worker-share.ts`.
- `run-action.ts:17` („Wystąpił błąd") and `settle-action.ts:5` (REQUEST_FAILED).
- `counted-nouns.ts:6` (`itemNoun`) and `src/lib/utils/polish-plural.ts:2-14`. Polish plural rules
  give the wrong form for Ukrainian at 21, 31, … Use `Intl.PluralRules('uk')` or a separate form set.
- `format-date.ts:18` (`formatPLDateTime`). The output is identical for `uk-UA`.
- Primitives: `confirm-dialog.tsx:35` („Anuluj") and `dialog.tsx:73` (aria „Zamknij").
- `src/lib/kosztorys/constants.ts:38`, `UNIT_SUGGESTIONS`. It is shared with the editor's combobox and
  the server's unit allow-list (`worker-report.ts:46-51,70`). Translate the **labels** only; the stored
  values must stay Polish.

**Grid copy**

- `src/lib/kosztorys/columns/column-config.ts:12-43`, `COLUMN_LABELS`, resolved in `columnTitle`
  (`grid/column-headers.tsx:50-65`), where no locale reaches it.
- `header-tips.ts:17-46`.
- `stage-label.ts:7` („Etap N").
- Section band (`section-header-cell.tsx:90,159,166`).
- „Razem" rows (`kosztorys-synthetic-rows.tsx:117`, `section-footer-cell.tsx:41`).
- Empty and search states (`kosztorys-editor-body.tsx:601,628-638`, `empty-grid-copy.ts:42-43`).

There is a seam already: `reportEditorSeams.transformColumns` (`report-column.tsx:96-147`) rebuilds
the column list in report mode and can override titles. The compact view keeps only Opis, Zgłaszam
and j.m. (j.m. on desktop only), so translating compact needs just two shared labels plus the
empty/search states.

**Numbers**

- `formatQty` → `toLocaleString('pl-PL', …)` (`src/lib/kosztorys/format.ts:20-21`).
- Input parsing accepts a comma (`parse-decimal-input.ts:12`).
- `uk-UA` also uses a comma. The only difference is that it groups 4-digit numbers. **Keep `pl-PL`.**

**`/p` rozpiska view and the PDF (if in scope)**

- `/p` has ~25 strings of its own:
  - `worker-kosztorys-page.tsx:14`;
  - the preview header shared with the investor's `/k` (`kosztorys-editor-body.tsx:488-506`);
  - `preview-header-actions.tsx:40,54`;
  - `kosztorys-totals-panel-toggle.tsx:39`;
  - `summary/blocks/worker-summary.tsx:20-49`;
  - `worker-view/summary.ts:118-119`.
    It also carries the full shared grid copy.
- The worker PDF (`src/lib/kosztorys/print/worker.ts`, `build-html.ts:135` `lang="pl"`, shared with
  the offer PDF) is **generated client-side by the manager**. The worker never generates it, and
  slice 3 (EX-949) reshapes it (row numbers, QR, empty column).

## Code References

- `src/collections/work-catalogue-items.ts:5-91`: catalogue collection, `match_key` unique
- `src/lib/kosztorys/work-catalogue/catalogue-key.ts:15-17`: `catalogueKey`
- `src/lib/kosztorys/sheet-import/item-key.ts:35-43`: `foldDescription`
- `src/lib/kosztorys/work-catalogue/write-catalogue-entry.ts:18-78`: the one key writer and overwrite
- `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:152-225`: pozycja → entry resolution
- `src/lib/kosztorys/work-catalogue/catalogue-conditions.ts:14-110`: katalog „Problemy" registry
- `src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx:76-98`: shared catalogue form
- `src/lib/actions/work-catalogue.ts:21-135`: catalogue writers
- `src/lib/queries/work-catalogue.ts:20-27`: unversioned cache key
- `src/collections/users.ts:114-157`: worker fields
- `src/components/forms/worker-form/worker-form.tsx:52-86`: worker form
- `src/lib/db/worker-report-share.ts:17-40`: token lookup joining `users`, where the language is read
- `src/lib/queries/worker-report-page.ts:26-50`: report loader; the swap point is after the cached read
- `src/lib/queries/worker-kosztorys.ts:24-116`: cached worker projection shared with Podgląd and the PDF
- `src/components/kosztorys/worker-report/report-column.tsx:96-147`: `transformColumns` seam
- `src/lib/kosztorys/columns/column-config.ts:12-43`: shared `COLUMN_LABELS`
- `src/lib/utils/polish-plural.ts:2-14`: Polish-only plurals
- `src/app/(share)/layout.tsx:18`: hard-coded `lang="pl"`
- `src/lib/actions/worker-report.ts:17-71`: send action (copies the Polish opis server-side)

## Architecture Insights

- **Translate at the edge, after the cache.** The worker projection is one cached build for four
  audiences (link, report, Podgląd, PDF). Language is a per-request property of _who opened the
  link_, so it belongs after the cached read, in the uncached per-token loader. This is the same rule
  as `lessons.md` „A price-view flag is not an audience flag".
- **Display text vs identity.** The stored report, the kierownik's review and every key stay Polish.
  The translation is a display projection only. This matches „translate at the boundary and never
  again" (`lessons.md:218-222`) and the agreed „identity never goes through translated text".
- **A key-keyed translation fits the codebase's own identity model better than an id-keyed one.**
  `match_key` is how every surface already identifies a praca. It is stable across environments
  (which is why the text fixes were keyed by it), it survives catalogue delete and re-create, and it
  can cover pozycje that never were in the catalogue. The cost: a fold change re-keys translations
  exactly as it re-keys the catalogue, and the drift spec has to cover both.
- **Pattern: Strategy / lookup-table i18n without a framework.** A typed dictionary
  `Record<LanguageT, Record<KeyT, string>>` plus a resolver passed down is the minimal form. next-intl
  or i18next would be enterprise weight for two locales on two public pages.

## Historical Context (from prior changes)

- `context/archive/2026-09-30-worker-work-reports/change.md:74-85`: the arc. Slice 2's design is
  untagged, not an owner ruling. OWNER #8 sequenced translations after the UI spike.
- `context/archive/2026-09-30-worker-work-reports/change.md:54-56,218-220` (OWNER #12/#18): the report
  form and the rozpiska link are separate surfaces.
- `context/archive/2026-09-28-catalogue-filters-and-usage/change.md:27-43`: the katalog „Problemy"
  registry is separate from the editor's. Contains the 69.2 % coverage measurement.
- `context/archive/2026-09-15-clean-texts-catalogue-names/change.md:50-66`: the fixes table feeds the
  key, and units are never fixed.
- `context/archive/2026-08-31-legacy-sheet-work-import/change.md:48-54` and
  `context/reference/legacy-sheet-dumps.md:52-58`: a one-off, insert-only prod load by `match_key`;
  review then happens by editing on prod.
- `context/archive/2026-09-18-lead-delivery/change.md:276-290` (OWNER): the only prior i18n decision.
  Stored data is read by a Polish speaker, so it stays in the Polish dictionary. This supports keeping
  report data Polish.
- `context/reference/kosztorys-editor-domain-notes.md:374-455`: the worker view (EX-875) and the
  report surface (EX-947).
- `context/foundation/test-plan.md`: relevant risks are #19 (public report link writes; the language
  read must not loosen `tokenAction`), #14 (katalog counts tell the truth; the new problem joins this
  registry) and #10 (catalogue lookup cost). No risk covers translations yet.
- Slice-1 leftovers that touch this slice:
  - The report branches in `kosztorys-editor-body.tsx` / `use-kosztorys-editor.ts` were never
    extracted (owner asked; `review-gate.md:17,30`). The Linear id was never recorded. UA grid labels
    would add to those branches unless they go through `transformColumns`.
  - Manual check `manual-checks.md:2933` is still open.
- Stale docs, not this slice's to fix: `roadmap.md:684-714`, `prd.md:326-328` and domain notes
  `:990,1498` still say there is no catalogue table.

## Related Research

- `git show 99953b39^:context/changes/2026-09-30-worker-work-reports/research.md`: slice 1 research
  (deleted at archive)
- `git show 99953b39^:context/changes/2026-09-30-worker-work-reports/plan.md`: slice 1 plan

## Open Questions

These are for the owner, in the sheet's vocabulary when asked.

1. **What does a translation hang on: the catalogue row (id) or the praca's key (opis + j.m. folded)?**
   - By id, as agreed: about a third of the rozpiska shows in Polish, and a rename in the katalog
     silently keeps the old translation.
   - By key: the import can also cover the ~284 used opisy not in the catalogue, translations survive
     a delete and re-add and match across environments, and a rename shows up as „bez tłumaczenia"
     instead of a wrong translation.
   - Both keep identity off the translated text. Recommendation: by key.
2. **Which surfaces get translated in this slice?**
   - The report page only (what the arc names), or also the rozpiska link `/p`? The issue title says
     „napisy widoku pracownika".
   - The PDF is generated by the manager and is being reshaped by slice 3, so it should probably wait.
3. **„Wszystkie kolumny" on the report page.**
   - Translate every column label, or only the compact view (Opis + Zgłaszam + j.m.)?
   - Compact needs two shared labels; the full view needs the whole `COLUMN_LABELS` / header-tip /
     section-band seam.
4. **Prace spoza rozpiski typed in Ukrainian.** The kierownik will see Ukrainian text in the review.
   Is that accepted until slice 3's AI read, or should the dialog ask for Polish?
5. **A renamed catalogue entry's translation** (only if keyed by id): clear it, or flag it as
   „nieaktualne"?
6. **Is the kosztorys-editor „Problemy" variant wanted** („ta pozycja pokaże się pracownikowi po
   polsku")? Or is the katalog filter enough?
7. **A language per worker, or a switch on the page?**
   - The agreed design is per worker.
   - A PL/UA toggle on the page (remembered per browser) needs no migration. It would also let a
     bilingual worker check the Polish wording.

## Follow-up Research 2026-10-01 — identify a praca by id, not by opis?

The question splits in two, and the two have opposite answers.

**1. Which katalog entry is this pozycja? Answer: by id (a stored link). That is a separate change, not this slice.**

- Today six readers re-derive the pairing from opis + j.m.:
  - `build-catalogue-comparison`
  - `already-in-kosztorys`
  - `catalogue-usage`
  - `price-divergence`
  - `line-draft`
  - `new-item-form`
- A 938-entry name-fix table (`src/lib/kosztorys/catalogue-name-fixes.ts`, 1,965 lines) exists to keep them agreeing. Even so, only 69 % of used pozycje pair.
- A link survives a rename on either side. A katalog rename currently unpairs every pozycja that came from that entry, in every kosztorys, at once. Text matching shrinks to the two places that have no id: sheet import and a one-off backfill.
- What the link does not cover:
  - Sheet import is born without ids, and `applyKosztorysImport` replaces the whole tree via `replaceTreeWithSnapshot`, so a re-import wipes the links.
  - Pozycje that match nothing stay unpaired until someone pairs them.
- **Superseded the same day by `context/changes/2026-10-01-kosztorys-item-catalogue-link/research.md` (verdict: not now).** The user stated that the app is moving away from Google Sheets. The measured gain of the link turned out to be small anyway.
- Plumbing it needs:
  - every path that copies pozycje carries the link: snapshots, „Cofnij" restore, szablony, kosztorys copy;
  - the three birth points that already know the id set it: the katalog picker (`catalogue-to-kosztorys.ts`), „Nowa praca" with katalog (`addItemAction`), and accept-from-report (`accept-worker-report.ts`, which already holds `catalogueItemId`);
  - deleting a katalog entry sets the link to null.
- This reverses the owner ruling of 2026-09-01 (domain notes, „Dopasowanie idzie po `matchKey`"). That ruling asked for one rule everywhere, and a stored link is still one rule.

**2. What does this opis say in Ukrainian? Answer: by the Polish text (a dictionary). Keep this in EX-948.**

- Translation is a property of the words, not of the praca:
  - Keyed by katalog id, a renamed pozycja or katalog entry keeps a stale translation and shows nothing wrong.
  - Keyed by text, changed text misses the lookup and falls back to Polish. That is the safe failure, and it is what makes „bez tłumaczenia" truthful.
- The text dictionary also covers opisy that are not in the katalog, if the import includes them, and it does not wait for change 1.
- The key is the opis alone, without j.m., normalised for case and whitespace. Units get their own short dictionary.

This supersedes Open Questions §1 and §5.
