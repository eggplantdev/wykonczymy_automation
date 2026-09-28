---
date: 2026-09-28T15:55:29+02:00
researcher: Claude (Opus 5.5)
git_commit: 2dc446504323423db43a516946c25fb6e39a2f81
branch: staging
repository: wykonczymy
topic: 'Investor view: one column set, settlement columns shown only when they hold data, share without the settings step'
tags: [research, codebase, kosztorys, client-view, share-link, offer-print]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: investor view auto-columns

**Date**: 2026-09-28T15:55:29+02:00robocizna

**Git Commit**: 2dc44650 (working tree dirty — see "In-flight work" below; line numbers are from the dirty tree)
**Branch**: staging

## Research Question

What does it take to (a) drop the „Oferta / Rozliczenie" mode and keep one client-view column set,
(b) show „Pomiar z natury", each etap (ilość + wartość), „razem netto" and „% wykonania" only when
they hold data, (c) make „Udostępnij" skip the settings step (mint + copy the link), (d) apply the
same to the offer print — per the owner notes in `change.md`.

## Summary

- **The mode is contained.** One collection, one global, one pure module
  (`src/lib/kosztorys/client-view-settings.ts`) and one resolver (`getClientViewSettings`). Every
  renderer — preview grid, `/k/:token`, offer print — already consumes a **flat**
  `ClientViewSettingsT`. Removing the mode collapses `ClientViewConfigT`; the renderers barely move.
- **Storage needs two migrations and two deploys.** EX-722 already dropped the flat
  `hidden_columns` / `hide_empty_rows` columns (`20260824_0_…`), so the flat shape must be re-added
  (additive, before the push) and `mode` / `variants` + their enums dropped later (destructive, after
  the deploy). `/k/:token` reads the table cookie-less, so one migration doing both has no safe order
  (`lessons.md:1521`).
- **Stored data is real and customised** — local dump: 9 per-investment rows (3 in SETTLEMENT) plus a
  firm-wide default whose SETTLEMENT variant hides „Pozostało". Unlike 0819, a blind `DELETE` would
  lose owner deviations; a backfill rule is needed (see Open Questions).
- **Nothing hides an empty column today** — not the client grid, not the worker view, not either
  print. The one data shape to test: `row['stage_<id>']` is **never null** (`treeToRows` fills
  `?? 0`), and a saved 0 is a real progress row, so „has data" = some row with `!== 0`.
- **One seam feeds grid and print.** Both key columns by the same full ids (`stage_<id>`,
  `stageValueNet_<id>`, `stageQtySum`, `net`, `donePercent`), so a single pure
  `emptySettlementColumnIds(rows, stages)` can be subtracted in both.
- **Share flow:** the settings step exists by deliberate design (EX-695: „a link can never leave with
  unsaved settings behind it"). The owner's new ruling retires that; `ShareLinkPanel` stays as the
  whole dialog body.

## Detailed Findings

### 1. Storage (what (a) retires)

- Collection `kosztorys-client-view` → table `kosztorys_client_view`
  (`src/collections/kosztorys-client-view.ts:12-56`): `investment` (unique), `mode` (:40-49),
  `variants` json (:50-54). `mode` is an admin default column (:20).
- Global `kosztorys-client-view-defaults` (`src/globals/kosztorys-client-view-defaults.ts:7-35`):
  `mode` (:19-28, writable only from /admin), `variants` (:29-33).
- Migrations: `20260815_0_add_kosztorys_client_view.ts` (flat columns), `20260819_0_client_view_offer_settlement_variants.ts`
  (adds `mode`/`variants` + two enums, `DELETE`s rows), `20260824_0_drop_kosztorys_client_view_hidden_columns.ts`
  (EX-722, drops the flat pair from both tables). Current schema: `investment`, `mode`, `variants`.

### 2. Readers

- Pure core `client-view-settings.ts`: `ClientViewSettingsT` (:6), `ClientViewModeT` (:13),
  `ClientViewConfigT` (:19), `OFFER_VISIBLE_COLUMNS` / `SETTLEMENT_VISIBLE_COLUMNS` (:27-48),
  `sanitizeClientViewVariant` (:66, fails closed per mode), `sanitizeClientViewConfig` (:87),
  `clientViewSettingsForMode` (:106), `sameClientViewConfig` (:120).
- `src/lib/queries/kosztorys-client-view.ts`: `getClientViewConfig` (:48, row → global → `{}`,
  uncached on purpose), `getClientViewSettings` (:63, flat, active variant).
- `src/lib/queries/client-view-settings-endpoint.ts:14` `readClientViewSettings` — `'use server'`,
  MANAGEMENT_ROLES, returns the full config to the client.
- `src/lib/queries/preview-kosztorys.ts`: `withClientView` (:101) attaches flat settings outside the
  `unstable_cache` tree read (:94-98); entrances `getPreviewKosztorysByToken` (:117),
  `getPreviewKosztorysById` (:145). Routes `(share)/k/[token]/page.tsx:13-16` and
  `(share)/podglad-inwestora/[id]/page.tsx:12-14` just spread it into `KosztorysEditorBody`.
- `use-kosztorys-editor.ts`: `documentSettings = worker?.settings ?? clientView` (:180),
  `previewHiddenColumns` (:501-502), `previewVisible: preview && !worker` (:542).
- Offer print: `offer-print-action.tsx:57,70` **pins `config.variants.OFFER`** (EX wydruk-oferty
  decision „zawsze wariant OFERTA"); `build-offer-print-html.ts:19` takes flat settings.

### 3. Writers

- `src/lib/actions/kosztorys-client-view.ts`: `saveClientViewSettingsAction` (:15-47, sanitize →
  find/update or create with unique-race retry); `saveClientViewDefaultsAction(config, mode)`
  (:57-84, owner-only, read-modify-writes `variants[mode]`, never `mode`).

### 4. UI touching the mode

- `client-view-settings-form.tsx`: `MODE_OPTIONS` (:23-26), ToggleGroup „Wariant podglądu
  inwestora" (:48-55), copy „Inwestor widzi wariant wybrany tutaj…" (:56-58), edits
  `variants[mode]` through `ViewSettingsFields` (:40-43, :60-67). The empty-row count label reads
  `conditionCounts.get(CLIENT_EMPTY_CONDITION_ID)` (:38).
- `kosztorys-client-view-dialog.tsx`: draft config, `useClientViewModeConfirm` (:35) on both saves
  (:70-72), „Zapisz jako domyślne" → `saveClientViewDefaultsAction(draft, draft.mode)` (:53), toast
  „…domyślne dla tego wariantu" (:63).
- `use-client-view-mode-confirm.ts:15-26` — exists only for the mode → deletable.
  `src/lib/kosztorys/investor-impact.ts:18` `CLIENT_VIEW_MODE_IMPACT` goes with it (the shared
  `useInvestorImpactConfirm` stays — the settlement-mode confirm also uses it).
- `view-settings-fields.tsx` — mode-agnostic, shared with the worker dialog. Stays.
- `investor-actions.tsx`: `clientView: ClientViewConfigT | null` (:19-20), filled by
  `readClientViewSettings` (:50); `requestShare` (:66-80) also reads the settings — unnecessary once
  the share dialog has no settings step.

### 5. Column pipeline — grid

- `buildV2Grid` (`kosztorys-v2-columns.tsx:422-434`) = assemble → order → select, called from
  `use-kosztorys-editor.ts:553`.
- Per-stage columns from `shownStages = stagesMatchingEngaged(stagesForView(...))`
  (`kosztorys-v2-columns.tsx:142-147`, built :231-309); keys `stageKey` / `stageValueNetKey`
  (`stage-keys.ts:20-33`). `stageQtySum` :202, `donePercent` :314, `net` :341.
- `selectV2Columns` (`grid/column-selection.ts:90-133`) — preview branch keep rule
  `closed.has(key) && !opts.previewHiddenColumns?.has(key)` (:114). **Gotcha:** `keep` receives
  `toggleKey(c.id)` (:131), which collapses `stage_7` → `stages`; the per-stage emptiness test must
  read the full `c.id`.
- Stage-column dropping already exists only as `stagesMatchingEngaged` (`stage-conditions.ts:55`,
  conditions `stage-no-plane` / `stage-no-worker`), forced empty under preview
  (`use-kosztorys-editor.ts:483-486`).
- `reconcileSort` (`use-kosztorys-editor.ts:559-562`) already copes with a sorted column vanishing.
- Rows are in scope where `columnOpts` is built (`useState(() => treeToRows(tree))`, :179).

### 6. Data shape — what „has data" means

- Stages are per-investment entities `KosztorysStageT {id, ordinal, label, plane, workerId}`
  (`types.ts:100-106`); progress rows `{itemId, stageId, qtyDone}`.
- `row['stage_<id>']: number` (`types.ts:215-219`), **never null** — `treeToRows` fills
  `qty[st.id] ?? 0` (`v2-rows.ts:35`). An explicitly saved 0 is a real progress row
  (`actions/kosztorys.ts:712-715`); `qtyDone` has no minimum (:696), negatives possible.
- Repo idiom for „has quantity": `qty_done <> 0` (`db/investment-trash.ts:18`,
  `sheet-import/build-import-plan.ts:244`).
- Test over full `rows`, not `documentRows`, so columns don't jump on „Pokaż wszystkie pozycje"
  (no practical difference: rows hidden by `client-empty` have no executed work).

### 7. Offer print

- Launched from the **owner's** editor (`offer-print-action.tsx:23`) with full `rows` + `stages`.
- `offerPrintColumns(stages, hiddenColumns)` (`offer-print/columns.ts:245-252`) →
  `CLIENT_DOCUMENT_COLUMNS` → `printableKeys` (ceiling − hidden, :264-267) → `offerColumnsByKey`
  (:117-240); per-stage columns carry the **full id** as `key` (:153-160, :203-210).
- `buildOfferPrintHtml` (`build-offer-print-html.ts:60-87`) has `rows` and `stages` at :70, where
  `offerPrintColumns` is called. Footer prints only „Razem netto" from `plannedNet` (:192-199) —
  unaffected.

### 8. Surfaces NOT driven by the column set

- Investor tabs Podsumowanie / Materiały / Etapy (`allowed-summary-views.ts:16-27`). The Etapy tab
  (`summary-stages-tab.tsx:42-75`) lists **every** stage incl. empty ones at 0 zł, plus
  `KosztorysProgressCounter` (doneNet / plannedNet ≈ % wykonania). Podsumowanie shows robocizna =
  executed − rabat. None reads `hiddenColumns`.
- Grid totals row follows the grid automatically (`kosztorys-editor-body.tsx:247-263`).

### 9. Worker view — must stay out

- Separate `WorkerViewSettingsT` (`worker-view/settings.ts:12`), flat, firm-wide global, no mode;
  imports nothing from `client-view-settings.ts`. Shares `ViewSettingsFields`, `clientConditionIds`,
  `offeredRows`.
- Worker-view design (in-flight change) plan-brief:49: „An empty etap column is the to-do list" —
  the opposite of (b). The rule must be gated on the investor audience (`previewVisible`), never on
  `view === 'client'` (`lessons.md:1599` rule 2). `assertDisclosurePair`
  (`column-selection.ts:48-64`) already keeps `previewVisible` false for the worker document.

### 10. Share dialog

- `kosztorys-share-dialog.tsx` (dirty — interim „Wygeneruj i skopiuj link" / „Kopiuj link" on the
  settings step from this session): settings step renders `ClientViewSettingsForm` + mode confirm,
  then `ShareLinkPanel`.
- `share-link-panel.tsx` — token lifecycle shared with the worker dialog (generate / rotate /
  revoke). Its no-token branch („Wygeneruj link") is still needed after a revoke.
- Clipboard: `copyToClipboard` (`lib/utils/copy-to-clipboard.ts`) is fire-and-forget with a failure
  toast. Copying after awaited server actions can lose user activation in Safari; Chrome keeps
  transient activation for a few seconds.

## Recommended seam

1. Pure `emptySettlementColumnIds(rows, stages): ReadonlySet<string>` in `src/lib/kosztorys/`
   returning full ids: `stage_<id>` + `stageValueNet_<id>` for every stage where all rows are `0`;
   `stageQtySum`, `net`, `donePercent` when no stage has data. Unit-testable without rendering.
2. Grid: compute in `use-kosztorys-editor.ts` only when `preview && !worker`, pass as a new
   `columnOpts` field, test against `c.id` in the preview branch of `selectV2Columns` (:114/:131).
   It only ever **subtracts** inside the ceiling — the fail-closed invariant (`lessons.md:1279`)
   holds.
3. Print: same function in `buildOfferPrintHtml`, `columns.filter(c => !empty.has(c.key))`.
4. Settings: collapse to one `ClientViewSettingsT`; the single code default is today's SETTLEMENT
   default (a superset — the data rule reproduces the offer look while nothing is recorded). Keep the
   OFFER default around and the settlement keys stay hidden forever, so the rule never fires.

## Code References

- `src/lib/kosztorys/client-view-settings.ts:6-126` — types, defaults, sanitize, compare
- `src/lib/queries/kosztorys-client-view.ts:20-70` — resolver
- `src/lib/actions/kosztorys-client-view.ts:15-84` — save / save-as-default
- `src/collections/kosztorys-client-view.ts:12-56`, `src/globals/kosztorys-client-view-defaults.ts:7-35` — storage
- `src/components/kosztorys/editor/grid/column-selection.ts:90-133` — preview keep rule
- `src/components/kosztorys/editor/kosztorys-v2-columns.tsx:142-147, 231-309` — per-stage columns
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:179-180, 483-486, 501-562` — rows, flags, columnOpts
- `src/lib/kosztorys/offer-print/columns.ts:117-267`, `build-offer-print-html.ts:60-87` — print columns
- `src/components/kosztorys/editor/actions/offer-print-action.tsx:57,70` — `variants.OFFER` pin
- `src/components/kosztorys/editor/dialogs/{client-view-settings-form,kosztorys-client-view-dialog,kosztorys-share-dialog,share-link-panel}.tsx`, `use-client-view-mode-confirm.ts`
- `src/components/kosztorys/editor/actions/investor-actions.tsx:32-95`
- `src/lib/kosztorys/investor-impact.ts:18`

**Tests pinning today's behaviour:** `src/__tests__/lib/kosztorys/client-view-settings.test.ts`,
`src/__tests__/lib/queries/kosztorys-client-view.test.ts`,
`src/__tests__/lib/actions/kosztorys-client-view-defaults.test.ts` (DB),
`src/__tests__/components/kosztorys/editor/actions/offer-print-action.test.tsx:90-94`,
`src/__tests__/lib/kosztorys/offer-print/build-offer-print-html.test.ts:13,41`,
`src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`; E2E
`e2e/client-share.spec.ts` (`selectVariant`, :79-181, :296), `e2e/drivers/share-link.ts`,
`e2e/kosztorys-share-link.spec.ts`.

## Architecture Insights

- Disclosure = code ceiling (`PREVIEW_VISIBLE_COLUMNS`) − owner's hidden set − (new) empty set. All
  three subtract; none can reveal. The new set is derived, never stored.
- Configuration resolves by base key, disclosure by full id (`lessons.md:1599`) — the empty set is
  disclosure, so it matches `c.id`, not `toggleKey`.
- Stored preference records the deviation (`lessons.md:1258`) — the flat hidden set keeps that shape.

## Historical Context (from prior changes)

- `context/archive/2026-08-15-client-preview-settings/` (EX-695) — per-investment → firm → code
  default; the ceiling; the share dialog's two steps („A link can never leave with unsaved settings
  behind it", „every time, not a first-run wizard"); explicit „Zapisz" because the dialog is share
  step 1. **(c) retires the two-step rationale.**
- `context/archive/2026-08-19-kosztorys-client-view-offer-settlement-variants/change.md` — mode as a
  durable state of the investment, the „Uwaga — zmiana widoczna dla inwestora!" confirm (owner
  rejected a banner), per-variant „Zapisz jako domyślne", two code defaults. **(a) retires all of it.**
  E2E backlog EX-721 (variant flip) and `manual-checks.md:458` become obsolete.
- `context/archive/2026-09-23-wydruk-oferty/change.md` — print respects the saved settings, prints
  `rows` not `viewRows`, and is „zawsze wariant OFERTA". **(d) retires the OFFER pin.**
- Commit `cdd32061` (2026-09-24) — managers may share because the share dialog saves settings on the
  way; after (c) that coupling is gone (harmless, justification stale).
- `context/reference/kosztorys-editor-domain-notes.md:301-331` („Co widzi klient") needs rewriting
  after (a)+(b).

## In-flight work that overlaps

- **Uncommitted on `staging`:** `column-config.ts` (`CLIENT_DOCUMENT_COLUMNS` / `WORKER_DOCUMENT_COLUMNS`),
  `column-selection.ts`, `offer-print/{columns,build-offer-print-html,styles,worker-columns}.ts`,
  `worker-view/settings.ts` (another agent / the worker-view change), plus this session's
  `kosztorys-share-dialog.tsx` and `e2e/drivers/share-link.ts`. Land or coordinate those first.
- **„Sekcja" leaves the investor (and worker) view entirely** — the neighbouring agent's
  uncommitted edit drops `sectionName` from `CLIENT_VIEW_GROUPS` / `WORKER_VIEW_GROUPS`
  (`column-config.ts`), so it is out of `PREVIEW_VISIBLE_COLUMNS` and the settings dialog. For this
  change: stored hidden sets still carry `sectionName`, and the sanitizer drops keys outside the
  ceiling on read and write, so the backfill needs no special case for it; the new single code
  default doesn't list it. Build on `CLIENT_DOCUMENT_COLUMNS` (same diff) as the column order, not on
  the old group order.
- `context/changes/2026-09-28-kosztorys-worker-view/` (implementing) — `plan.md:684-687`
  parametrises `client-view-settings-form.tsx` with the mode toggle as props; removing the toggle
  hits that seam. Worker keeps empty etapy visible.
- `context/changes/2026-09-28-investor-change-history/` (planned) — edits `preview-kosztorys.ts`,
  both share routes and `kosztorys-editor-body.tsx`; its design #7 applies CURRENT settings to past
  days. Under (b) past days' pomiar/etap columns would appear/disappear by that day's data —
  unaddressed there.

## Open Questions

All resolved with the owner, 2026-09-28 (recorded in `change.md`):

1. **Backfill** — SETTLEMENT-mode rows keep `variants.SETTLEMENT`; OFFER-mode rows keep
   `variants.OFFER` minus the netto settlement keys (`stageQtySum`, `stages`, `stageValueNet`,
   `net`, `donePercent`), so the data rule decides. The brutto pair (`gross`, `stageValueGross`) stays
   as stored — brutto is opt-in. A stored „Pozostało" choice is kept; only the code default hides it.
   Same for the firm default.
2. **Column list** — brutto follows netto (`gross` with `net`, `stageValueGross_<id>` with its
   etap). „Pozostało" hidden by default, not data-conditional.
3. **Etapy tab + progress counter** — drop empty etapy too, in the investor view.
4. **Instant visibility of an etap entry** — accepted.
5. **Safari clipboard** — technical call, left to the plan (Promise-valued `ClipboardItem` or the
   failure-toast fallback).
