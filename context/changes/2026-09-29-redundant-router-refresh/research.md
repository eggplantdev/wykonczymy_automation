---
date: 2026-09-29T12:25:21+02:00
researcher: Claude
git_commit: b6b1dd1b5cc1e07ae197785e660dd6e791c306e5
branch: catalogue-filters-and-usage
repository: wykonczymy
topic: 'router.refresh() after Server Actions that already re-render the route — audit, removal, before/after render count (EX-908)'
tags: [research, codebase, cache, revalidation, server-actions, router-refresh, performance]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude
---

# Research: redundant `router.refresh()` after Server Actions (EX-908)

**Date**: 2026-09-29T12:25:21+02:00
**Researcher**: Claude
**Git Commit**: b6b1dd1b
**Branch**: catalogue-filters-and-usage
**Repository**: wykonczymy

## Research Question

Spun off EX-895. Every `akcja → router.refresh()` site in `src/`: is the refresh still needed, or is
it a second full server render of the route that the action already re-rendered? Measure render counts
before/after in a real browser (Playwright is justified here), add manual checks for every touched
site, and make sure nothing regresses.

## Summary

- **Mechanism confirmed from Next 16.1.7 source.** An action that expires a tag with `updateTag` (or
  `revalidateTag(tag, { expire: 0 })`) renders the current route inside its own POST and the client
  applies it — also when the action was fired from a Zustand store after the calling dialog unmounted.
  A `router.refresh()` afterwards is one more GET and one more full server render with no new data.
  EX-597 already measured this once (`dd148c15`, render count halved) but only fixed the editor
  settings path.
- **16 call sites, none needs the refresh on the success path.** Two stay UNCLEAR until measured: the
  form submits (`use-form-submit.ts`, the widest and most-used path) and the 700 ms debounced refresh
  in the kosztorys grid. Three editor dialogs genuinely need a refresh on their **failure** (`catch`)
  branch, where no fresh tree comes back.
- **The July re-add in `use-form-submit` has no measured root cause.** It was a speculative fix from a
  backlog note („Root cause: … never calls router.refresh()”), stated as a diagnosis, never reproduced.
  The source refutes three of the four hypotheses; the one plausible real mechanism (hook
  `revalidateTag(…, 'default')` racing `updateTag` on Vercel's remote cache handler) was removed on
  2026-09-20 by `62a0590a` regardless.
- **One site triple-renders**: the catalogue-compare dialog (K) — the action's POST, its own `onSaved`
  refresh and `useFormSubmit`'s refresh.
- **E2E guards exist only for about half of the sites**; the trash flows, sheet dialogs and default
  register have none, so they need manual checks (or `e2e-backlog` issues).

## Detailed Findings

### 1. Framework mechanics (Next 16.1.7 — unchanged at `54f8210a`, `097eb8c8` and HEAD)

| Path                                                              | What happens                                                                                                                                                                                                                                     | Source                                                                                                                                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateTag` / `expire: 0` in an action                            | `pathWasRevalidated` set; `x-action-revalidated: 1`; route rendered from the root into the POST body `f`; client applies it as a seeded `RefreshAll` navigation and wipes the prefetch cache                                                     | `server/web/spec-extension/revalidate.js:174-203`; `server/app-render/action-handler.js:95-117,830,850`; `client/components/router-reducer/reducers/server-action-reducer.js:96-105,174-185,245-268`; `ppr-navigations.js:201-213` |
| Action fired from a store after unmount                           | Applied anyway: `callServer` wraps its own `startTransition`, the action queue is a module-level singleton bound to the root router; a navigation that discards a revalidating action triggers `ACTION_REFRESH` via `needsRefresh`               | `client/app-call-server.js:14-26`; `use-action-queue.js:26-61`; `app-router-instance.js:45-99,161-187`                                                                                                                             |
| `router.refresh()` right after                                    | `ACTION_REFRESH` → `revalidateEntireCache` + `navigateToSeededRoute(data: null, RefreshAll)`: every segment fetched again. The action's render already refilled `unstable_cache`, so it reads warm data — a duplicate render, no new information | `app-router-instance.js:285-291`; `refresh-reducer.js:28-60`                                                                                                                                                                       |
| `deferRefresh` (`EXPIRE_NEXT`, `expire: 1`)                       | Header still 1, but render skipped (`f = ''`); client falls back to a follow-up GET. The render moves, it is not removed                                                                                                                         | `revalidate.js:199-203`; `server-action-reducer.js:270-273`; `file-system-cache.js:43-73`                                                                                                                                          |
| `expireCollectionsAfterResponse` (`after()`)                      | Tags expire in phase `after`, after headers — no header, no render                                                                                                                                                                               | `after-context.js:97,107`                                                                                                                                                                                                          |
| Payload hook `revalidateTag(…, EXPIRE_NOW)` in the action request | Forces the POST render too (EX-850), unless the write passes `skipRevalidation`                                                                                                                                                                  | `src/lib/cache/revalidate.ts:32-34`                                                                                                                                                                                                |

Timing detail that matters for two sites: `resolve(actionResult)` (`server-action-reducer.js:212`)
runs **before** the new tree commits, so code after `await action()` runs before the action's own
render lands (relevant to E and L below).

`context/foundation/lessons.md:653-680` (EX-597 + „Second exit (EX-876)”) agrees with the source on
every point checked.

`protectedAction` (`src/lib/actions/run-action.ts:41-72`) revalidates only on success, so a failed
action returns no render.

### 2. Site audit

| #   | Site                                                                                                                                                                    | Trigger / route                                                                      | Action → revalidation                                                                                                                                                       | Verdict                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `components/sheets/linked-sheet-actions.tsx:39,49`                                                                                                                      | unlink / delete, `/kosztorysy`                                                       | `unlinkSheetFromInvestmentAction` (`lib/actions/sheets.ts:175`), `deleteSheetAction` (`:272`); updateTag `kosztoryses, investments` + hook                                  | REDUNDANT                                                                                                                                                                                                                           |
| B   | `components/dialogs/link-sheet-to-investment-dialog.tsx:49`                                                                                                             | link dialog, `/kosztorysy`                                                           | `linkSheetToInvestmentAction` (`sheets.ts:93`); same tags + hook. Commit `13ddffbd` credits the tags, not the refresh                                                       | REDUNDANT                                                                                                                                                                                                                           |
| C   | `components/dialogs/add-sheet-dialog.tsx:55`                                                                                                                            | „Nowy kosztorys”, `/kosztorysy`                                                      | `addUnlinkedSheetAction` (`sheets.ts:29`); `kosztoryses` + hook                                                                                                             | REDUNDANT                                                                                                                                                                                                                           |
| D   | `components/dialogs/sheet-setup-dialog.tsx:43`                                                                                                                          | SheetButton on `/inwestycje/[id]`, listing, `/inwestycje/[id]/kosztorys`             | `linkSheetAction` (`lib/actions/investments.ts:78`); `kosztoryses, investments` + hook                                                                                      | REDUNDANT                                                                                                                                                                                                                           |
| E   | `components/forms/form-fields/save-default-register-button.tsx:42`                                                                                                      | „Zapisz jako domyślną kasę” in ExpenseForm (top-nav dialog, any route)               | `setDefaultCashRegisterAction` (`lib/actions/user-preferences.ts:12`); `users` + hook; `fetchReferenceData` is tagged `users`                                               | REDUNDANT. The comment at `:22-24` names the refresh as what re-fetches — must be reworded to the action's render                                                                                                                   |
| F   | `components/trash/trashed-investment-actions.tsx:23`                                                                                                                    | „Przywróć”, `/kosz`                                                                  | `restoreInvestmentAction` (`lib/actions/investment-trash.ts:74`); hooks skipped, `investments` + `investment:<id>`                                                          | REDUNDANT                                                                                                                                                                                                                           |
| G   | `components/trash/delete-forever-dialog.tsx:35`                                                                                                                         | „Usuń na zawsze”, `/kosz`                                                            | `deleteInvestmentForeverAction` (`investment-trash.ts:96`); `INVESTMENT_DELETE_TAGS` + entity tag                                                                           | REDUNDANT                                                                                                                                                                                                                           |
| H   | `components/investments/trash-investment-button.tsx:24`                                                                                                                 | trash row action, investments listing                                                | `trashInvestmentAction` (`investment-trash.ts:26`); `investments` + entity tag                                                                                              | REDUNDANT                                                                                                                                                                                                                           |
| I   | `components/transfers/cancel-transfer-button.tsx:46`                                                                                                                    | cancel row action, transfer tables (many routes)                                     | `cancelTransferAction` (`lib/actions/transfers.ts:196`); `transfers` + recalc hooks                                                                                         | REDUNDANT                                                                                                                                                                                                                           |
| J   | `components/forms/hooks/use-form-submit.ts:49` (keepOpen), `:61` (optimistic, runs in the store's `onSuccess` after unmount — `stores/optimistic-form-store.ts:59-104`) | every FormDialog form                                                                | every consumer updateTags on success (§3)                                                                                                                                   | REDUNDANT by mechanism, **UNCLEAR by history** — measure first                                                                                                                                                                      |
| K   | `components/kosztorys/editor/dialogs/catalogue/catalogue-compare-dialog.tsx:167`                                                                                        | „Porównaj z katalogiem” → Dodaj/Edytuj w katalogu                                    | `create/updateCatalogueItemAction`; `workCatalogue` + hook; submitted through `useManagedForm` → `useFormSubmit`, which refreshes too                                       | REDUNDANT twice — **three renders per save today**                                                                                                                                                                                  |
| L   | `components/kosztorys/editor/kosztorys-editor-v2.tsx:44` (`handleTreeReplaced`)                                                                                         | import, reload from szablon, clear, clean texts, compare with sheet, restore version | all updateTag (`KOSZTORYS_TREE_TAGS` / `kosztorysItems`)                                                                                                                    | REDUNDANT on success; **NEEDED on the `catch` paths** of `sheet-import-dialog.tsx:80-97` (via `use-sheet-import.ts:55-57`), `reload-from-preset-dialog.tsx:80-97`, `clear-kosztorys-dialog.tsx:25-38`, where no flight data arrives |
| M   | `components/kosztorys/editor/use-kosztorys-editor.ts:773` (`runGridReversal`, undo/redo)                                                                                | undo/redo                                                                            | `updateItemFieldAction` (`kosztorys.ts:94`, deferRefresh but the item hook forces a POST render — EX-850) + `setStageProgressAction` (`:683`, raw SQL + deferRefresh → GET) | REDUNDANT — the action queue serializes, so the last render follows the last write                                                                                                                                                  |
| N   | `use-kosztorys-editor.ts:1033` (`handleAppendedSections`)                                                                                                               | „Dodaj sekcje z szablonu”                                                            | `appendPresetSectionsAction` (`kosztorys-presets.ts:192`); updateTag sections + items                                                                                       | REDUNDANT (rows patched locally, `:1028`)                                                                                                                                                                                           |
| O   | `use-kosztorys-editor.ts:1059` (`handleAppendedCatalogueItems`)                                                                                                         | „Dodaj → Praca z katalogu…”                                                          | `insertCatalogueItemsAction` / `createSectionWithCatalogueItemsAction` (`catalogue-to-kosztorys.ts:61`)                                                                     | REDUNDANT                                                                                                                                                                                                                           |
| P   | `use-kosztorys-editor.ts:1279` (700 ms debounce, timer at `:157`)                                                                                                       | any grid cell edit                                                                   | autosaves via `useDebouncedSave(500)` already render (POST via item hook, GET via stage progress)                                                                           | REDUNDANT by mechanism, **UNCLEAR on timing**: fires ~200 ms after the save is sent and may render pre-commit totals. EX-597 archive already flagged it as giving back part of the `deferRefresh` win                               |

Not call sites (comments only): `hooks/use-media-upload.ts:25` (EX-850 already removed it),
`lib/kosztorys/optimistic-setting-save.ts:6` (EX-597), `editor/hooks/use-kosztorys-settings.ts:55`,
`editor/hooks/use-restore-remount.ts:11`.

`refreshDataAction` (`lib/actions/refresh.ts`, `revalidatePath('/', 'layout')`) — both callers
(`nav/refresh-data-button.tsx:26`, `kosztorys-editor-v2.tsx:64` `handleStaleTree`) already rely on the
action's own render. Correct as is.

Navigation after an action: only `components/presets/create-empty-preset-dialog.tsx:30` — belongs to
EX-909, not here.

### 3. `use-form-submit` (site J) — the history and today's tag coverage

- `54f8210a` (2026-03-25) removed the refresh: „updateTag inside the server action is sufficient”.
- `264395e3` (2026-06-12) wrote into the then-backlog: „HIGH — Optimistic form submits don't refresh
  the page… Root cause: … never calls router.refresh()” — a diagnosis, no reproduction.
- `097eb8c8` (2026-07-08, a backlog-burndown batch; the backlog was deleted right after in `d1ddd583`)
  re-added it. `revalidateCollections` was already `updateTag` then, Next was the same 16.1.7.

Hypotheses, ranked against the code of that time:

1. **Speculative fix, symptom never real** — most likely.
2. **Server-cache race on Vercel**: the hooks then called `revalidateTag(tag, 'default')` (stale, never
   expired) on the same tags; locally the profile groups run in insertion order and `updateTag` wins,
   but a remote cache handler could apply them in the other order and serve the old row in the action
   render; a refresh a moment later would read the background-recomputed value. Unverifiable locally.
   `62a0590a` (2026-09-20) moved the hooks to `EXPIRE_NOW`, which removes this path either way.
3. Re-render not applied because the caller unmounted — **refuted** (§1).
4. Mount-frozen list state — **refuted**: `DataTable` fed `data` straight to `useReactTable` then and
   now; no list surface keeps rows in `useState`.
5. Client-side cache/store — **refuted**: no react-query/SWR, `staleTimes` off, header 1 wipes the
   prefetch cache.
6. Tag mismatch — **refuted** then and today.

Consumers today (all `updateTag`, none `deferRefresh`):

| Form                                                                | Action                                                                       | Tags                              | Reads on its pages                                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| ExpenseForm / EditTransferForm / DepositForm / InternalTransferForm | `createBulkTransferAction` / `updateTransferAction` / `createTransferAction` | `transfers`                       | balances, transfers, investment-transactions, transfer-totals (`transfers`; `balances.ts:72` also `investments`) |
| InvestmentForm                                                      | create/update investment                                                     | `investments`                     | `investments.ts:87`, `reference-data.ts:158`, leads                                                              |
| Promote-lead dialog                                                 | `promoteLeadAction`                                                          | `investments, leads`              | leads                                                                                                            |
| WorkerForm                                                          | worker create/update                                                         | `users`                           | `reference-data.ts:158`                                                                                          |
| CashRegisterForm                                                    | register create/update                                                       | `cashRegisters`                   | `reference-data.ts:158`                                                                                          |
| Equipment forms (add/update/transfer)                               | equipment actions                                                            | `equipment` / `equipmentEvents`   | equipment                                                                                                        |
| VehicleForm / InspectionForm                                        | fleet actions                                                                | `vehicles` / `vehicleInspections` | fleet                                                                                                            |
| WorkCatalogueItemForm (+ editor dialog with `onSaved`)              | catalogue item                                                               | `workCatalogue`                   | work-catalogue                                                                                                   |
| RecipientListForm                                                   | `revalidateNotificationRecipients()`                                         | `NOTIFICATION_RECIPIENTS_TAG`     | notification-recipients                                                                                          |

Gap: coverage was mapped per cache function and tag, not per route file. The action POSTs to the
current route (`state.canonicalUrl`) and renders it from the root — the same coverage `router.refresh()`
gives — so a global dialog opened on any page is covered.

## Measurement protocol

Reuses what EX-597 / EX-849 / EX-876 did (see Historical Context).

- **Server**: prod-like, `NEXT_DIST_DIR=.next-e2e pnpm build` then `pnpm test:e2e:warm:server`
  (`next start` on 3100, fetch cache wiped, 5435 test DB). `next dev` only to read `[PERF]` lines, never
  for timings. Don't touch the user's dev server on 3000/3001; check the machine-wide test lock /
  `.next-e2e` usage by other agents before building.
- **Login**: OWNER from `DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm seed:e2e`
  (`src/scripts/e2e-user-credentials.ts`); assert a string only the target page shows (the EX-597
  login-page trap).
- **Per flow record**:
  - action POSTs (`next-action` header): count, response bytes, `x-action-revalidated`;
  - refresh GETs: `RSC: 1`, **no** `next-router-prefetch`, same pathname (the `countRouteRefreshes` logic,
    `e2e/kosztorys-grid-writes.spec.ts:61-74`), with bytes;
  - prefetch GETs (`next-router-prefetch: 1`) counted separately, never as renders;
  - server `[PERF]` lines per request (`run-action.ts:52-67`; page lines e.g. `kasa/[id]/page.tsx:46`,
    `transfer-table-server.tsx:42,55,63`, `lib/queries/kosztorys.ts:75` `buildKosztorysTree` = exactly
    one per editor render). `/kosz` and `/szablony` log nothing — Network only;
  - time-to-visible from click to the element that proves the write (new row, balance, restored item),
    `performance.now()` in page.
- **Warm vs cold**: discard the first 1–2 runs after server start, ~5 warm runs, median + range, cold
  reported apart (`lessons.md:682-701`). Local numbers prove render counts; latency against Neon needs
  a staging confirmation (`vercel logs … -q PERF`), and **only staging/preview can surface hypothesis 2
  of §3**.
- **Data**: a ~40-item kosztorys and inv 7 after `seed:kosztorys:test` (~1000 items) for editor flows.
  Check with a `SELECT` on 5435 before measuring whether trashed investments and linked sheets exist;
  sheet flows: link/unlink only (writes to Google 403 locally, and every sheet id is live).
- **Site J decisive reading**: with the refresh removed, submit one expense on `/kasa/[id]` and one
  investment edit. POST has header 1 **and** the new row in `f`, no follow-up `?_rsc=` GET → delete it.
  Header 1 but old row in `f` → server-cache problem the refresh only masks. `f` empty → an
  `EXPIRE_NEXT`/`after()` path on that action.
- **Expected delta**: each removed refresh drops one non-prefetch RSC GET and one server render; the
  POST still carries the render; UI still updates without reload.

## Test coverage (regression guards if the refresh goes)

| Site           | Guard                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J              | `e2e/transfer-create.spec.ts:10-22` (row + balance on `/kasa/<id>`, no reload). `investment-lock.spec.ts` reloads, so it does not guard                                                           |
| I              | `e2e/transfer-cancel.spec.ts:13-44`                                                                                                                                                               |
| M              | `e2e/kosztorys-undo-redo.spec.ts:82,107,147,169`                                                                                                                                                  |
| N              | `e2e/kosztorys-structure.spec.ts:372`                                                                                                                                                             |
| O              | `e2e/work-catalogue.spec.ts:190`                                                                                                                                                                  |
| P              | `e2e/kosztorys-grid-writes.spec.ts:105-149` — the only refresh-count assertion (`:136-137`, `≥1 && ≤ typed.length*2`); still passes after removal but is then loose — tighten it to the new count |
| L              | `e2e/kosztorys-presets.spec.ts:193-249`, `kosztorys-versions.spec.ts:44,97`                                                                                                                       |
| A–D, E, F–H, K | **none** → manual checks, or an `e2e-backlog` issue per the Testing rules in AGENTS.md                                                                                                            |

No unit/DOM spec asserts `refresh` was called; 19 specs under `src/__tests__/` mock
`useRouter: () => ({ refresh: vi.fn(), … })` and stay green — cleanup optional.
`use-restore-remount.test.tsx:36` tests the latch, not the refresh.

## Manual checks

Format per `context/foundation/manual-checks.md:1-24,386-393`: before `/10x-implement` the checklist
lives in this change folder (`manual-checks.md`), moves to the registry once the code exists; one box
per check, evidence indented under it. Existing sections touching these flows:
`kosz-inwestycji-manager` (`:2019-2027`, 4 checks still unticked — trash/restore/delete-forever),
EX-849/850 (`:723-773`, the `buildKosztorysTree` counting method), EX-597 index entry.

Per touched site, the check is the same shape: **after the click, the change is visible without a
reload, and the Network panel shows the action POST and no non-prefetch RSC GET for that path.**

## Code References

- `src/lib/cache/revalidate.ts:17-66` — `expire`, `revalidateCollections`, `revalidateEntities`, `expireCollectionsAfterResponse`
- `src/lib/actions/run-action.ts:41-72` — `protectedAction`, revalidates on success only
- `src/components/forms/hooks/use-form-submit.ts:49,61` — site J
- `src/stores/optimistic-form-store.ts:59-104` — detached action + `onSuccess`
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:157,773,1033,1059,1279` — sites M, N, O, P
- `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:44` — site L
- `src/components/kosztorys/editor/dialogs/catalogue/catalogue-compare-dialog.tsx:164-167` — site K
- `e2e/kosztorys-grid-writes.spec.ts:61-74,136-137` — `countRouteRefreshes` and the only count assertion
- `e2e/support/wait.ts:123-183` — `isServerAction`, `settleWrite(s)`, `refreshData`

## Architecture Insights

- The render a user sees after a write has exactly one owner: the action's own response. A client-side
  `router.refresh()` is only right when the write did **not** go through a revalidating action — a
  route handler, an upload API, a failed/thrown action (site L's `catch`), or a deliberately render-free
  action (`after()`-expiry).
- The rule is the same one EX-597 wrote for the editor („a per-write saving is only real if nothing
  downstream re-adds per-write work”), now applied app-wide. Site K is the textbook case: two layers
  (dialog `onSaved` and `useFormSubmit`) each added „their” refresh without knowing about the other.
- Pattern note: this is the Post/Redirect/Get habit (write, then ask for the page again) carried into a
  framework whose write response already _is_ the page.

## Historical Context (from prior changes)

- `context/archive/2026-07-27-decouple-panel-write-refresh/change.md:50-69` — EX-597: `dd148c15`
  „router.refresh() deleted — render count halved”, and the 700 ms timer caveat (site P).
- EX-597 research (deleted; `git show 732d7a88^:context/archive/2026-07-27-decouple-panel-write-refresh/research.md`)
  — „Baseline: NOT captured” (~l.470-495), „Corrected baseline protocol” (~l.731-743, staging +
  `vercel logs -q PERF`), „Q1 ANSWERED” (~l.753-765: one click = POST with render + GET 566 ms later).
- `context/foundation/manual-checks.md:723-773` — EX-849/850: count renders by `[PERF] buildKosztorysTree`.
- `context/foundation/manual-checks.md:1627-1706` — EX-876: „one action POST and no later GET RSC”;
  prefetch GETs with a metadata-only tree are not re-renders.
- Commits: `54f8210a` (removed), `264395e3` (backlog diagnosis), `097eb8c8` (re-added), `62a0590a`
  (hooks → `EXPIRE_NOW`), `dd148c15` (EX-597 removal).

## Related Research

- `context/changes/2026-09-29-szablony-plain-revalidation/research.md` (EX-909) — same mechanism, the
  opposite direction; reuses this protocol.

## Open Questions

1. Site J: does the POST `f` carry the new row locally **and** on preview? (Decides J; preview is the
   only place hypothesis 2 can show.)
2. Site P: after removal, does the summary total still update, and does the per-edit RSC count drop to
   ~1? Then tighten `kosztorys-grid-writes.spec.ts:136-137`.
3. Site L: does the restore latch (armed after `await`, before the tree commits) fire on the action's
   own render? One manual version restore, checking the body remounts. Keep the refresh on the `catch`
   branches.
4. Site E: `savedId` local state stays; only its comment changes. Confirm the button stops offering to
   save immediately after success without the refresh.
5. test-plan.md has no named risk for „write not visible after save” (§7 excludes cache correctness
   „until a stale-data incident surfaces” — the EX-893 stale `/szablony` finding arguably is one). Add
   it via `/10x-test-plan` before the plan anchors tests on it.
