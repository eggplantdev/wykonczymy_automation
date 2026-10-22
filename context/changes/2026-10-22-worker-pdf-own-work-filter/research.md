---
date: 2026-10-22T15:00:08+02:00
researcher: Claude (Opus 5.5)
git_commit: 3b6f74142d6027c3c78f86a7ac6d17686e42beb7
branch: staging
repository: wykonczymy
topic: 'Opt-in filter: worker PDF / view lists only pozycje where his etapy have work done'
tags: [research, codebase, kosztorys, worker-view, print, row-conditions, worker-view-settings]
status: complete
last_updated: 2026-10-22
last_updated_by: Claude (Opus 5.5)
---

# Research: opt-in „only pozycje with his work done" for the worker PDF

**Date**: 2026-10-22T15:00:08+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 3b6f74142
**Branch**: staging
**Repository**: wykonczymy

## Research Question

The worker's kosztorys PDF prints every pozycja with a Przedmiar, not only the ones he worked on.
The owner wants a tickable/untickable option so the worker's printout (and possibly view) lists only
pozycje where **his etapy have qty done > 0**. Where does the option live, which surfaces share the
projection, how does the row-conditions engine take it, and how is a setting persisted?

## Summary

- **Confirmed behaviour.** The worker projection narrows `stages`/`progress` to his etapy but keeps
  every item (`src/lib/queries/worker-kosztorys.ts:75-80`). The PDF's only row filter is
  `client-empty` (no Przedmiar AND no work in his etapy). On investment 149 (local dump): Kyryl
  Elektryk ~146 printed rows / 12 with his work; Taras Vendysh ~152 / 29; Valerii ~156 / 49.
- **The full scope was a deliberate design decision**, not an oversight: „Pracownik widzi wszystkie
  pozycje … pusta kolumna etapu to lista do zrobienia" (`context/reference/kosztorys-editor-domain-notes.md:415-416,449`).
  So the new behaviour must be **opt-in**, defaulting to today's.
- **Predicate is trivial** — `!(qtyDone(row, ctx) > 0)` already exists as the `filter` condition
  `no-measured-qty` (`row-conditions/registry.ts:191-198`); in the worker view `ctx.stages` is already
  his etapy, so `qtyDone` is "his work".
- **The real work is the totals.** PDF grand/section totals are computed over the **unfiltered** rows
  (`print/worker.ts:117-136`). Today that's safe only because `client-empty` hides rows that add zero
  to both axes (`registry.ts:248`). A row with a Przedmiar and no work of his adds to „Wartość
  przedmiaru — ⟨rozliczenie⟩" and „Pozostało", so with the filter on, totals must be computed over the
  filtered rows or they'll disagree with the page.
- **The fill-in form („kartka do zgłoszenia prac") and report mode must NOT take the filter** — they
  exist to collect work on pozycje he hasn't started (`archive/2026-09-30-worker-work-reports/change.md:24,101-106`).
- **Shared etap caveat:** `stage_progress` has no worker column (`src/lib/db/stage-progress.ts:29-35`);
  on a split etap "his work" = the whole etap's work, including co-members'.

## Detailed Findings

### Where the PDF gets its rows today

- Menu → `WorkerPrintMenuItem variant="pdf"` (`editor/toolbar/menus/kosztorys-workers-menu.tsx:84-88`)
  → `getWorkerKosztorysPrintData` (`lib/queries/worker-kosztorys-print-endpoint.ts:17-29`) →
  `getWorkerKosztorysPreview` → `withWorkerSettings` (`lib/queries/worker-kosztorys.ts:108-118,129-137`).
- Projection: all items, his etapy, his progress (`worker-kosztorys.ts:75-80`). `executedQtyByItem`
  is all crews (`:69-73`) and feeds only „Pozostało" / progress cells.
- `buildWorkerPrintHtml` (`lib/kosztorys/print/worker.ts:96-143`):
  - rows: `documentRows(rows, stages, worker.settings.hideEmptyRows)` (`:122`) → `client-empty`
  - columns: `workerDataHiddenColumns(rows, …)` over unfiltered rows (`:108`) — unaffected by the
    filter (rows with zero in his etapy don't count as entries)
  - totals: `totalsOf(rows)` and `sectionTotalsById` over unfiltered rows (`:117-119,131-136`)
  - footer `workerFooterHtml(worker.summary)` (`:40-90`) — executed/paid/owed; hidden rows contribute
    0 to his executed figures, so the footer is unaffected.
- `buildKosztorysPrintHtml` (`print/build-html.ts:77-125`): a section with no remaining rows
  vanishes (header + total); the grand total row is always printed.
- No empty-document guard on the worker PDF (the offer has one, `offer-print-action.tsx:37`). Filter
  on + worker with no work yet → header + empty table + totals.

### Which totals move if rows are hidden

| Column                                                                             | Over hidden rows | Effect if left on unfiltered rows                                                                         |
| ---------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| per-etap qty/value, `net`                                                          | 0                | none                                                                                                      |
| `plannedNetForPlane` („Wartość przedmiaru — ⟨rozliczenie⟩", `column-totals.ts:49`) | non-zero         | total > visible sum                                                                                       |
| `remainingForPlane` („Pozostało", `column-totals.ts:53`, all crews' work)          | non-zero         | total > visible sum                                                                                       |
| `currentPlannedQty`                                                                | non-zero         | hidden by default once his etapy have entries (`hidePlannedOnceExecuted`, `worker-view/columns.ts:52-63`) |

Fix shape: when the filter is on, feed the filtered rows to `totalsOf` and to `groupBySection`.

### Surfaces sharing the projection

| Surface                                                 | Entry                                                                         | Row filter                                                                                                           | Should take the new option?                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Worker PDF                                              | `print/worker.ts:96`                                                          | `documentRows`                                                                                                       | **yes** — the request                                                    |
| Fill-in form („kartka")                                 | `print/worker.ts:169-204`                                                     | `documentRows` + non-empty opis                                                                                      | **no** — write-in lines for unstarted pozycje are its purpose; no totals |
| Share link page `(share)/z/[investment]/[name]/[token]` | `ReportGrid` → `KosztorysEditorBody` (`worker-report/report-grid.tsx:92-197`) | `clientConditionIds(hideEmptyRows && !showAllRows, reportedOnly)` (`editor/hooks/use-kosztorys-view-state.ts:62-63`) | report mode **no**; summary mode — optional                              |
| Owner preview `/podglad-pracownika/...`                 | same component tree (`worker-actions.tsx:12-29`)                              | same                                                                                                                 | follows the link page                                                    |
| EMPLOYEE `/pracownicy/[id]`                             | links to the share page (`pracownicy/[id]/page.tsx:109-114`)                  | —                                                                                                                    | —                                                                        |

The live grid applies row conditions in both report and summary modes (no mode check at
`use-kosztorys-view-state.ts:62-63`), so routing the filter through `clientConditionIds` would also hide
unstarted pozycje from report mode.

### Row-conditions engine

- Shape: `RowConditionCtxT` and kinds `filter` / `diagnostic` / `client` (`row-conditions/types.ts:5-53`).
- `applyRowConditions` (`queries.ts:19-43`): `client` conditions hide a row if any matches.
- `clientConditionIds(hideEmptyRows, reportedOnly)` (`queries.ts:191-203`) returns one of three
  module-level sets (stable identity for editor memos, pinned by `queries.test.ts:363`); `reportedOnly`
  replaces `client-empty`, it doesn't compose.
- `qtyDone(row, ctx)` = `ctx.qtyDoneByRowId ?? rowTotalQtyDone(row, ctx.stages, 'client')`
  (`registry.ts:21-22`) — over his etapy in both PDF and live view.
- A new `kind: 'client'` entry doesn't leak into owner-facing lists: „Filtry", active chips, „Problemy"
  enumerate `filter`/`diagnostic` only (`queries.ts:152`, `active-filters-model.ts:32`,
  `problem-conditions.ts:9`). It would need copy in `grid-empty-overlay.tsx:37` if used live, and the
  „Wszystkie prace (+N)" count (`use-kosztorys-editor.ts:417-422`) wouldn't include it.
- For the PDF alone, the engine isn't required: `documentRows` could take the flag and either add an
  id set or post-filter with `rowTotalQtyDone(row, stages, 'client') > 0` — the same predicate
  `protocolScopeRows` uses for the acceptance protocol (`acceptance-protocol/scope-rows.ts:7-13`).

### Settings persistence (if the option is persisted)

- Global `kosztorys-worker-view-settings` (`src/globals/kosztorys-worker-view-settings.ts:4-33`) —
  **one row for every worker and investment**; booleans are real columns (`hideEmptyRows`,
  `hidePlannedOnceExecuted` checkboxes `:22-31`, `defaultValue: true`).
- New boolean = hand-written additive migration (precedent
  `src/migrations/20260929_5_worker_view_hide_planned.ts:9`) + `payload-types.ts` regen.
- Type/defaults/sanitize: `worker-view/settings.ts:19-24,35-40,44-62` (booleans read default-on via
  `!== false` — a default-OFF key needs `=== true`).
- Read uncached (`lib/queries/kosztorys-worker-view.ts:9-17`), merged outside the cache in
  `withWorkerSettings`; write `saveWorkerViewSettingsAction` (`lib/actions/kosztorys-worker-view.ts:10-20`,
  `protectedAction`, no tags). Domain notes say only ADMIN/OWNER save it (`kosztorys-editor-domain-notes.md:410-411`).
- UI: `KosztorysWorkerViewDialog` (`editor/dialogs/view-settings/kosztorys-worker-view-dialog.tsx`);
  `hidePlannedOnceExecuted` is the template for a worker-only `CheckboxRow` (`:80-93`). Hardcoded
  Polish, management-only.
- Tests with full settings literals that must gain the key: `worker-view/settings.test.ts:87-107,163-174`,
  `kosztorys-workers-menu.test.tsx:43-44`, `print/worker.test.ts:88-89`, `print/worker-form.test.ts:91-92`.

### Per-print (not persisted) alternatives

- No per-print option exists on worker prints today — two fixed variants
  (`worker-print-action.tsx:16-23`). A third variant („PDF — tylko wykonane") is a `VARIANTS` entry
  plus a flag into `buildWorkerPrintHtml`, no migration, no settings change.
- Per-visit toggles exist on the live page (`showAllRows`, `reportedOnly` as `useState` +
  `DropdownMenuCheckboxRow`, `report-grid.tsx:132-157`).

## Code References

- `src/lib/queries/worker-kosztorys.ts:69-97` — projection: all items, his etapy/progress, summary
- `src/lib/kosztorys/print/worker.ts:96-143` — worker PDF builder; totals over unfiltered rows
- `src/lib/kosztorys/print/worker.ts:169-204` — fill-in form builder
- `src/lib/kosztorys/print/document-rows.ts:8-18` — the shared row filter for prints
- `src/lib/kosztorys/row-conditions/registry.ts:21-27,191-198,244-257` — `qtyDone`, `no-measured-qty`, `client-empty`, `report-unreported`
- `src/lib/kosztorys/row-conditions/queries.ts:19-43,191-203` — `applyRowConditions`, `clientConditionIds`
- `src/components/kosztorys/editor/actions/worker-print-action.tsx:16-80` — print menu item + variants
- `src/lib/kosztorys/worker-view/settings.ts:19-73` — settings type/defaults/sanitize
- `src/globals/kosztorys-worker-view-settings.ts:4-33` — persisted global
- `src/components/kosztorys/editor/dialogs/view-settings/kosztorys-worker-view-dialog.tsx:37-93` — settings dialog
- `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:54-63` — live-view row conditions
- `src/lib/kosztorys/acceptance-protocol/scope-rows.ts:7-13` — existing "work done > 0" row scope

## Architecture Insights

- **Two-axis empty rule is the invariant** that lets totals ignore the row filter. Any filter that
  hides rows with a Przedmiar breaks it — the totals must then follow the visible rows. This is the
  risk the original design named: „Suma w podsumowaniu ≠ widoczne pozycje" (deleted design doc,
  `git show 985cb683a:context/archive/2026-09-28-kosztorys-worker-view/design.md`, lines 105-106).
- **Audience split:** the same projection serves a _settlement_ reading (PDF, summary mode — "what
  did I do, what am I owed") and a _to-do_ reading (report mode, fill-in form — "what's left"). The new
  filter belongs only to the settlement reading.
- Disclosure lesson (`lessons.md` „Stored preferences record the deviation"): a persisted setting
  stores the deviation; the code default (show all) stays live.

## Historical Context (from prior changes)

- `context/reference/kosztorys-editor-domain-notes.md:415-416,449,452-453` — whole scope visible,
  „Pozostało" is the crew-wide to-do list, two-axis empty rule.
- `context/archive/2026-09-30-worker-work-reports/change.md:24,101-106,170-174` — a strict „Z
  przedmiarem" chip was tried and dropped the same day because it hid pozycje he was actually doing.
- `context/archive/2026-09-29-worker-view-settlement-columns/change.md:13-17` — the only narrowing
  precedent, column-level (his empty etapy hidden until his first entry).
- `context/archive/2026-09-30-kosztorys-stage-worker-split/change.md:34-35` — shared etap shows the
  whole etap's rows.
- No prior "only my pozycje" / per-item worker assignment idea in `context/**` or git log.

## Related Research

- `context/archive/2026-10-05-worker-single-view/` — „Wszystkie prace (+N)" folded in
- `context/archive/2026-10-05-worker-pdf-translations/` — PDF builder history

## Open Questions

1. **Persisted or per-print?** A firm-wide setting flips every worker's PDF at once (the global is
   one row). A per-print choice (third menu item „Drukuj kosztorys pracownika — tylko wykonane" or a
   checkbox at print time) needs no migration and leaves the default untouched. Recommendation:
   per-print, PDF only.
2. **Does the live link page's summary mode get it too**, or only the PDF? Bartek asked about the
   printout only.
3. **Totals under the filter:** compute grand/section totals over the visible rows (recommended), or
   hide the planned/„Pozostało" columns while filtered?
4. **Empty result:** worker with no work yet + filter on → refuse with a toast („Brak wykonanych
   pozycji") like the offer's guard?
5. **Shared etap:** accept that "his work" includes co-members' work on the same etap (data can't
   distinguish), and say so in the option's description?

## Decisions (2026-10-22, with the user)

- **Not persisted.** „Drukuj kosztorys pracownika (PDF)" opens a dialog; the choice lives only in
  that dialog. No settings key, no migration.
- **Checkbox „Tylko pozycje z wykonaną pracą", default ticked.** No special case for a worker with no
  entries yet (the offer phase): the PDF prints what's left — the user sees it's empty and unticks.
  No empty-result toast, no disabled state.
- **Totals follow the printed rows** when the box is ticked (Q3).
- **Only the PDF.** The fill-in form and the live link page keep the full scope (Q2).
- **The fill-in form stays a separate menu item** with no dialog: a different document for a
  different moment, its own disable rule (all his etapy completed), and merging would add a click.
- Offer phase context: before his first entry the PDF is the worker's offer (Przedmiar, stawka,
  „Wartość przedmiaru netto — ⟨rozliczenie⟩", „Pozostało"; settlement columns hidden,
  `settlement-columns.ts:34-52`). The filter does not narrow that phase — other trades' pozycje stay
  there until an item→trade link exists (out of scope).
