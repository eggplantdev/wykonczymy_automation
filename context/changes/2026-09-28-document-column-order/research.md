---
date: 2026-09-28T18:00:00+02:00
researcher: Claude (Opus 5.5)
git_commit: 9ca4b64c3d2627f3df733886ac6bb931f56873cf
branch: staging
repository: wykonczymy
topic: "EX-884 — owner-set column order for the investor and worker documents"
tags: [research, kosztorys, client-view, worker-view, offer-print, column-order, migrations]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: owner-set column order for the investor and worker documents (EX-884)

**Git Commit**: `9ca4b64c` · **Branch**: `staging`

## Research Question

What does it take to let the owner set the column ORDER of the investor document (podgląd, `/k/`
link, offer PDF) and the worker document (worker link, worker podgląd, worker PDF) in their settings
dialogs — and where does that collide with work other agents have in flight?

## Summary

- **The EX-884 issue text is stale.** It predates `170d5586` (16:00), which made each document ONE
  ordered list shared by screen and paper (`CLIENT_DOCUMENT_COLUMNS` / `WORKER_DOCUMENT_COLUMNS`).
  The "do the PDFs follow the order" question — billed as the biggest part — is solved by construction
  **provided one helper replaces the constant at all three consumers**. The per-variant question was
  settled by `20260928_2_client_view_single_set`. `scopeFirst` no longer exists.
- **A migration IS needed.** `hiddenColumns` is a Payload `json` *field* (its own column), so
  `columnRanks` is a new `jsonb` column on three tables: `kosztorys_client_view`,
  `kosztorys_client_view_defaults`, `kosztorys_worker_view_settings`.
- **Three consumers, one helper each audience.** `documentOrder` (screen), `offerPrintColumns`
  (investor PDF), `workerPrintColumns` (worker PDF). Everything else already carries the whole
  settings object; only four hops thread `hiddenColumns` field-by-field.
- **One latent print bug becomes a one-drag bug.** `build-offer-print-html.ts:160` places the
  section total by `moneyIndex`; with the money column first the figure prints one column right, under
  the wrong heading. Must be fixed in this change.
- **`opts.columnRanks` is already taken** — it is the owner's per-browser localStorage order, which
  closed documents ignore on purpose (pinned by `worker-columns.test.ts:107-117`). Document ranks
  need their own field.
- **Collisions are manageable**: nothing in flight depends on column order. The shared hunks are
  `use-kosztorys-editor.ts:501-557` (investor-change-history phase 5) and `src/migrations/index.ts`.

## Detailed Findings

### 1. The document lists and their three consumers

- `CLIENT_DOCUMENT_COLUMNS` — `src/lib/kosztorys/column-config.ts:241-262`; reading order is an owner
  ruling of 2026-09-28 (`:236-240`): the offered scope reads as one phrase (ilość, j.m., cena,
  wartość) ahead of the etapy, pomiar after the etapy it sums.
- `WORKER_DOCUMENT_COLUMNS` — `column-config.ts:292-303`, using the logical key `WORKER_RATE_KEY =
  'rate'` (`:268`); `workerDocumentColumns(plane)` maps it to `price__<plane>`
  (`src/lib/kosztorys/worker-view/settings.ts:75-79`).
- Ceilings: `PREVIEW_VISIBLE_COLUMNS` (`column-config.ts:232`, from `CLIENT_VIEW_GROUPS` `:199-230`)
  and `WORKER_VIEW_KEYS` (`worker-view/settings.ts:17`, from `WORKER_VIEW_GROUPS` `column-config.ts:275-288`).
  The GROUPS order the settings dialog; the DOCUMENT lists order the document — they differ.

Consumers (the only three that must change to follow a stored order):

| Surface | Code | Has in scope |
|---|---|---|
| Screen (both docs) | `documentOrder` / `orderAssembled`, `src/components/kosztorys/editor/grid/column-selection.ts:82-86, 184-197` | `BuildV2ColumnsOptsT` — only `previewHiddenColumns` and `workerSurface.{plane,hiddenColumns}` |
| Investor PDF | `offerPrintColumns(stages, hiddenColumns)` + `printableKeys`, `src/lib/kosztorys/offer-print/columns.ts:261-283`; caller `build-offer-print-html.ts:75` | caller has whole `settings` |
| Worker PDF | `workerPrintColumns({plane, stages, hiddenColumns, executedQtyByItem})`, `offer-print/worker-columns.ts:42-86`; caller `build-worker-print-html.ts:70-75` | caller has whole `worker.settings` |

### 2. Data flow — where the field must be threaded by hand

Whole settings object travels DB → query → page → `KosztorysEditorBody` → `useKosztorysEditor` and
→ print actions unchanged:

- Investor: `getClientViewSettings` (`src/lib/queries/kosztorys-client-view.ts:46-59`, uncached) →
  `withClientView` (`preview-kosztorys.ts:101-107`, outside the cached block — no cache-key bump) →
  `(share)/k/[token]/page.tsx`, `(share)/podglad-inwestora/[id]/page.tsx`; print
  `offer-print-action.tsx:90-93`.
- Worker: `getWorkerViewSettings` (`kosztorys-worker-view.ts:14-22`) → `withWorkerSettings`
  (`worker-kosztorys.ts:117-127`) → `WorkerKosztorysPage`; print `worker-print-action.tsx:58`.

Field-by-field hops (the full list):

1. `use-kosztorys-editor.ts:501-507` — `previewHiddenColumns` Set from `clientView.hiddenColumns`.
2. `use-kosztorys-editor.ts:549-555` — `workerSurface.hiddenColumns`.
3. `BuildV2ColumnsOptsT` — `kosztorys-v2-column-opts.ts:95-116`.
4. `offerPrintColumns` signature + `WorkerPrintColumnsArgsT`.

Sanitizers return only the two known fields (`client-view-settings.ts:44-58`,
`worker-view/settings.ts:41-55`) — an unlearned `columnRanks` is dropped on write and read.

### 3. Default resolution

`getClientViewSettings` — **the row wins as a whole** (`kosztorys-client-view.ts:30-33`): row → else
global → else `{}` → code default. A row whose field is NULL resolves to the code default, not to the
global. Consequence for ranks: every investment that already saved a row (ranks NULL) will NOT
inherit an order later saved as firm default. The dialog always saves the row first, then the global
when „Zapisz jako domyślne" (`kosztorys-client-view-dialog.tsx:37-63`; `saveClientViewDefaultsAction`
`lib/actions/kosztorys-client-view.ts:47-61`, owner-only). Worker settings are a single global, no
per-row fallback.

Fail-closed does not apply to ranks: an order discloses nothing. Invalid/absent → `{}` = document
order. Sanitize to finite numbers (`dropNonFiniteRanks`, `src/lib/table/column-order.ts:30`) and keys
inside the ceiling (group keys; `rate` for the worker, never `price__<plane>`).

### 4. Ordering mechanics — screen and paper agree over group keys

- `toggleKey = stageGroupOfKey(id) ?? id` (`column-selection.ts:29-31`); stage families
  `stages` / `stageValueNet` / `stageValueGross` (`stage-keys.ts:10-12`).
- `orderColumns` (`column-order.ts:85-92`) groups by key, orders keys with `orderColumnKeys`
  (unranked → its base index), expands — a stage family moves as one block.
- Print expands one group key into N columns (`offerColumnsByKey` `columns.ts:154-256`;
  `worker-columns.ts:65,71`).
- So: one function `orderColumnKeys(DOC, ranks)` per audience; the print iterates its result, the
  screen feeds it to `baseRanksFromKeys` (as today). Worker: order `WORKER_DOCUMENT_COLUMNS` by ranks
  keyed `rate` BEFORE the `rate → price__<plane>` map, inside `workerDocumentColumns(plane, ranks)`.
- Sparse ranks keep their lesson (`lessons.md:1259` "a stored preference records the DEVIATION"): a
  column added to the document list later lands at its declared index. Unlike the workbench, the base
  is one fixed list per document, so no cross-view rank ties (`column-order.ts:43-47` caveat does not
  apply).

### 5. Position-dependent code

**Print — real bug** (`build-offer-print-html.ts:144-167`): `labelSpan = Math.max(1, moneyIndex)`.
At `moneyIndex === 0` the „Razem — <sekcja>" label takes cell 0 (the money column's slot) and the
figure prints in cell 1. Reachable today only by hiding everything left of the money column; with
reordering it is one drag (`plannedNet` / `plannedNetForPlane` first). The test „Wartość netto
pierwsza" (`build-offer-print-html.test.ts:254-277`) asserts only the span count, not where the
figure lands, which is why it passes. The worker print shares the builder shape
(`worker-print.test.ts:98-107`) — verify it at plan time.

**Print — cosmetic**: column 0 always gets `rail` + the section-colour left border
(`build-offer-print-html.ts:189-190`, `styles.ts:55,58`); a narrow first column cramps the label.
Widths are per-class, portrait/landscape counts columns (`PORTRAIT_COLUMN_LIMIT` `:60`) — both
position-independent.

**Screen — order-agnostic already**: section band label on the first visible data column
(`section-header-cell.tsx:48-52`), „Razem" row rides it (`kosztorys-synthetic-rows.tsx:131-135`),
footer label follows `description`/`sectionName` (`section-footer-cell.tsx:18-24`), ordinal is a
separate gutter (`ordinal-gutter-column.tsx:50`). The in-flight header-height measuring is keyed per
column id and re-runs on `columnIds` identity (`kosztorys-editor-body.tsx:305`) — a reorder re-measures
for free.

### 6. Settings dialogs and the reorder UI

- Investor: `KosztorysClientViewDialog` (`dialogs/kosztorys-client-view-dialog.tsx:23`), Radix
  `Dialog` `sm:max-w-md`, draft via `useDraft(settings)` (`:31`), non-optimistic save; opened from
  `ClientViewSettingsMenuItem` (`actions/investor-actions.tsx:120`) and from the share dialog (swap,
  not nest — `kosztorys-share-dialog.tsx:25-28`). Managers may save; defaults owner-only.
- Worker: `KosztorysWorkerViewDialog` (`dialogs/kosztorys-worker-view-dialog.tsx:20`), same draft
  pattern, fields disabled for non-owners (`:55`), owner-only save, no defaults.
- Shared `ViewSettingsFields` (`dialogs/view-settings-fields.tsx:23`) hard-codes
  `ViewSettingsValueT = {hiddenColumns, hideEmptyRows}` (`:7`) — a required `columnRanks` breaks its
  `onChange={setDraft}` assignability; make it generic. Its `{...value}` spread keeps the field at
  runtime.
- `ColumnOrderDialog` (`src/components/ui/column-order-dialog.tsx`) fits a draft: `items` =
  document-ordered keys with `visible: !hidden.has(id)`, `baseRanks = baseRanksFromKeys(DOC)`,
  `onSetRank` → `setDraft`, `onReset` → `columnRanks: {}`. It always renders its own `<Dialog>`
  (`:69`) → reuse means a nested dialog (Radix stacks Escape/focus correctly; both overlays
  `z-10000`, later portal wins). No Dialog-on-Dialog precedent in the editor yet. Gaps: no `disabled`
  prop (hide/disable the entry for a worker-dialog manager); „Zamknij" commits only to the draft —
  the real commit is the parent's „Zapisz", the description must say so.
- Inline alternative: extract its `Reorder.Group` body (`:76-103`). Costs: two scrolling ancestors
  (`DialogContent` + form div) need `layoutScroll`, ~20 extra rows, no autoscroll while dragging.
- List content: all ceiling keys, hidden greyed but draggable (the dialog already does this
  `:40-41,93-98`), no data-driven hiding (global-discount rabat columns, empty settlement columns
  `settlement-columns.ts:31-45` simply drop out at render).
- Labels: investor dialog uses raw `COLUMN_LABELS` („Razem netto"), the grid header uses
  `columnLabelForView(id,'client')` („… — po rabacie", `column-config.ts:66-67`); worker uses
  `workerColumnLabel` (every key covered, `worker-view/settings.test.ts:78`).
- Settings aren't reachable from either podgląd (`kosztorys-editor-body.tsx:435-472` mounts a slim
  header); loop is save in editor → reload the podgląd tab (uncached reads, no revalidation).

## Code References

- `src/lib/kosztorys/column-config.ts:199-303` — groups, ceilings, document lists, `WORKER_RATE_KEY`
- `src/components/kosztorys/editor/grid/column-selection.ts:82-86,184-197` — `documentOrder`, `orderAssembled`
- `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts:39,95-116` — existing `columnRanks` (localStorage) + preview/worker opts
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:501-557` — the two hand-threaded hops + `columnOpts`
- `src/lib/kosztorys/offer-print/columns.ts:261-283` — `offerPrintColumns`, `printableKeys`
- `src/lib/kosztorys/offer-print/worker-columns.ts:42-86` — `workerPrintColumns`
- `src/lib/kosztorys/offer-print/build-offer-print-html.ts:144-167` — section-total placement bug
- `src/lib/kosztorys/client-view-settings.ts:44-58`, `src/lib/kosztorys/worker-view/settings.ts:41-79` — sanitizers, `workerDocumentColumns`
- `src/lib/queries/kosztorys-client-view.ts:30-59` — row-wins-whole fallback
- `src/collections/kosztorys-client-view.ts`, `src/globals/kosztorys-client-view-defaults.ts`, `src/globals/kosztorys-worker-view-settings.ts` — storage
- `src/components/kosztorys/editor/dialogs/{kosztorys-client-view-dialog,client-view-settings-form,kosztorys-worker-view-dialog,view-settings-fields}.tsx` — dialogs
- `src/components/ui/column-order-dialog.tsx` — reusable reorder dialog
- `src/lib/table/column-order.ts` — `orderColumnKeys`, `rankForMove`, `baseRanksFromKeys`, `dropNonFiniteRanks`

## Tests that pin today's behaviour

- `src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts:36-46,61-70,111-117` — document order + hidden subtraction; extend with ranks.
- `src/__tests__/components/kosztorys/editor/grid/worker-columns.test.ts:36-46,107-117` — pins that the localStorage `columnRanks` does NOT reorder the document; must keep passing (proves the field split).
- `src/__tests__/lib/kosztorys/offer-print/build-offer-print-html.test.ts:176-189,254-277,302` — section-total markup; `:254-277` needs a placement assertion.
- `src/__tests__/lib/kosztorys/offer-print/worker-print.test.ts:98-107,128-134` — „Pozostało" last.
- Whole-object equality that breaks once the sanitizer adds `columnRanks: {}`:
  `lib/queries/kosztorys-client-view.test.ts:63,88,94,100`, `lib/kosztorys/worker-view/settings.test.ts:38,51`;
  literal fixtures: `offer-print-action.test.tsx:90`, `use-kosztorys-view-state.test.tsx:82`,
  `kosztorys-client-view-defaults.test.ts:26`, `kosztorys-workers-menu.test.tsx:37`,
  `build-offer-print-html.test.ts:49-57`, `worker-print.test.ts:69`.
- No DOM spec for the investor settings dialog; worker dialog covered by
  `toolbar/menus/kosztorys-workers-menu.test.tsx:139,151`. `ColumnOrderDialog` has no spec; the drag is
  browser-level — `data-table-column-order.test.tsx:27-35` calls `rankForMove` + `setRank` directly.

## In-flight work by other agents (checked 2026-09-28 ~18:00)

| Work | Status | Overlap |
|---|---|---|
| **investor-change-history** (EX-881) | implementing; p1 committed `9ca4b64c` (migration `20260928_3_investment_completed_at`) | **p4** extracts `resolveShareInvestmentId` in `preview-kosztorys.ts` (we don't need that file). **p5** edits `kosztorys-editor-body.tsx` (new `history` prop), both investor pages, and `use-kosztorys-editor.ts:501-507` (empty settlement columns over past+current rows) — adjacent to our hops 1–2. Semantic: design #7 (`design.md:35`) renders history with the investor's CURRENT client-view settings → our order is inherited for free if it lives in `ClientViewSettingsT`. |
| Header-height measuring (ad-hoc follow-up to EX-883 `77cf0ac3`, uncommitted) | uncommitted: `use-header-content-height.ts`, `use-grid-measure-pass.ts`, `header-label.tsx`, `row-height.ts`, `ordinal-gutter-column.tsx`, `kosztorys-editor-body.tsx` | None semantic — keyed per column id, re-measures on reorder. We should not need `kosztorys-editor-body.tsx`. |
| QA leftovers | `src/scripts/reset-preview-owner-password.ts`, `manual-checks.md`, review ledgers | none |
| szablon-open-speed, instant-page-shell, catalogue-usage-report, kosztorys-bulk-actions, wydatek-netto, kosz-plikow | planned / new / research | none |
| **EX-886** (Backlog) | reserved DROP of `mode`/`variants` on `kosztorys_client_view` + `_defaults` | same two tables; must stay a separate, later migration (`lessons.md:1521`). Note its ordering on the issue. |

Migration number: `20260928_4_…` (or `20260929_0` if written tomorrow), additive only, pattern of
`20260928_2_client_view_single_set.ts`. `src/migrations/index.ts` is clean as of `9ca4b64c`.

## Architecture Insights

- **One list per audience, decided in one function** — the `170d5586` design. Keeping it means the
  stored ranks must be applied INSIDE the list-producing function, never at a consumer; otherwise
  screen and paper can drift again. This is the load-bearing invariant of the change.
- **Server-stored order does not reopen the 2026-07-28 ruling** (`archive/2026-07-28-preview-column-disclosure/review-gate.md:3-5`,
  restated `column-selection.ts:174-183`): that ruling excludes per-browser, client-writable state from
  a client document. Owner-saved ranks are server state, sanitized; the localStorage map must stay out.
- **Sparse ranks over a fixed base** (`lessons.md:1259`); the earlier column-order change explicitly
  deferred "zapis kolejności do DB" and "osobna kolejność per widok"
  (`archive/2026-08-15-kosztorys-column-order/plan-brief.md:47,70-71`) — this change is that deferral,
  scoped to the two closed documents only.

## Historical Context

- `context/archive/2026-08-15-kosztorys-column-order/` — workbench column order, localStorage, the
  dialog-outside-dropdown rule, deferrals above.
- `context/archive/2026-07-28-preview-column-disclosure/review-gate.md` — closed lists ignore preferences.
- `context/archive/*kosztorys-client-view-auto-columns*`, `*kosztorys-worker-view*` — single set per
  investment, worker ceiling, `rate` logical key.
- `lessons.md:780` (tolerant types for JSON older than the schema), `:1279` (disclosure fails closed —
  still sanitize keys), `:1603` pt 3 (never rename stored ids), `:186,:808,:1521` (migration ordering).

## Open Questions (for /10x-plan)

1. **Defaults fallback for ranks.** Accept the row-wins-whole rule (an investment with a saved row
   never picks up a later firm-default order), or give `columnRanks` its own NULL → global fallback?
   Recommendation: accept — it matches `hiddenColumns`, and „Zapisz jako domyślne" still seeds new
   investments.
2. **Reorder UI: nested `ColumnOrderDialog` vs inline list.** Recommendation: nested dialog opened by
   an „Ustaw kolejność kolumn…" button in each form — zero new drag code; worker entry hidden for
   non-owners.
3. **Section-total placement when the money column is first** — label after the figure, or empty
   label cell? Decide in the plan; test the landing column, not the span.
4. **Should `description` be pinnable first?** Nothing on screen needs it; on paper only the `rail`
   styling assumes column 0. Recommendation: no pin — fix the placement, keep order free.
5. **Label source in the order list** — dialog labels (`COLUMN_LABELS`) or grid-header labels
   (`columnLabelForView`)? Recommendation: same as the tick list beside it.
