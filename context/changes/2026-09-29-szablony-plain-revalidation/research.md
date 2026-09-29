---
date: 2026-09-29T12:25:21+02:00
researcher: Claude
git_commit: b6b1dd1b5cc1e07ae197785e660dd6e791c306e5
branch: catalogue-filters-and-usage
repository: wykonczymy
topic: "Szablony onto the investments' cache/revalidation path — drop the after-response expiry, with a before/after baseline (EX-909)"
tags: [research, codebase, cache, revalidation, szablony, presets, performance]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude
---

# Research: szablony onto plain revalidation (EX-909)

**Date**: 2026-09-29T12:25:21+02:00
**Researcher**: Claude
**Git Commit**: b6b1dd1b
**Branch**: catalogue-filters-and-usage
**Repository**: wykonczymy

## Research Question

Spun off EX-895. Since EX-893 opening a szablon is a plain read-only page. Is the separate
revalidation pattern for szablony (tags expired in `after()`, uncached name reads) still justified,
or can szablony use the same path as investments? Needs a baseline before and after, proving
performance did not get worse. Do after EX-908 and reuse its measurement method.

## Summary

- **Navigation is already identical.** Szablony list → page uses the same `DataTable` row with hover
  `router.prefetch` + `router.push` as investments (`presets-data-table.tsx:19`,
  `investment-data-table.tsx:50`, `data-table-row.tsx`). EX-893 deleted the whole EX-876 fast-open
  machinery (`template-workshop.tsx`, `open-preset-in-workshop.ts`, `preset-open-href.ts`). What is
  left of the special pattern: **two `expireCollectionsAfterResponse` call sites** and **two uncached
  name reads** that exist only because of them.
- **The autosave `after()` saves nothing.** Its comment (`investment-action.ts:86-88`) claims an
  inline expiry would make every autosave re-render the calling route. It already does: the editor
  actions carry their own tags (`KOSZTORYS_TREE_TAGS` / `kosztorysItems`) and the item hooks force the
  POST render (EX-850), or `deferRefresh` does the follow-up GET. An inline `presets` tag lands in the
  same render — **0 extra renders per autosave.** Carrying the handler's `opts` (so `deferRefresh`
  stays `deferRefresh`) is the only detail to get right. The one exception is the snapshot autosave
  (`snapshotAction`, ≤1 per 10 min), which renders nothing today and would render once.
- **Create costs +1 cheap render.** `createEmptyPresetAction` expires `presets` after the response
  because the dialog then `router.push`es away. Inline, the POST also renders `/szablony` (a list, not
  the editor) — one small render the user does not see. In exchange the page title and crumb can read
  the **cached** library, and a browser Back to `/szablony` cannot show a list without the new szablon
  (hypothesis — the EX-893 manual check recorded a stale `/szablony`; see Historical Context).
- **If both call sites go, `expireCollectionsAfterResponse` has no caller** and is deleted with its
  test, stub export and the `lessons.md` paragraph that presents it as a „second exit".
- **No after-EX-893 baseline exists.** Every earlier szablon timing measured the workshop that EX-893
  deleted.

## Detailed Findings

### 1. Inventory — where szablony differ from investments today

| #   | Site                                                                 | Today                                                                                                                                                                             | Investments equivalent                                       | Proposal                                                                                                                                            |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `lib/actions/kosztorys-presets.ts:111-129` `createEmptyPresetAction` | `SKIP_HOOK_REVALIDATION` + `expireCollectionsAfterResponse(['presets'])`, then client `router.push('/szablony/<id>')` (`components/presets/create-empty-preset-dialog.tsx:22-31`) | `protectedAction(…, ['investments'])` inline                 | `protectedAction(…, ['presets'])`; keep `SKIP_HOOK_REVALIDATION` (the hook would expire `investments`, which the szablony list never reads — check) |
| 2   | `lib/actions/investment-action.ts:85-92` template tail               | `markPresetEdited` + `expireCollectionsAfterResponse(['presets'])` after every successful tree write on a szablon                                                                 | nothing — an investment tree write touches only its own tags | `revalidateCollections(['presets'], opts)` inline, **carrying `opts`** (`deferRefresh`)                                                             |
| 3   | `lib/queries/presets.ts:70-75` `getTemplateView`                     | uncached `getPresetName`                                                                                                                                                          | page reads the cached investment                             | read the cached `getPresets()` list, `React.cache()` wrapped, only together with #1                                                                 |
| 4   | `lib/queries/presets.ts:77-87` `getPresetNameForCrumb`               | uncached, own `requireAuth`                                                                                                                                                       | `@investmentCrumb` reads cached data                         | same as #3 — one cached read shared by page + crumb in one request                                                                                  |
| 5   | `lib/actions/kosztorys-presets.ts:60-107` `savePresetAction`         | inline `['presets']`, `SKIP_HOOK_REVALIDATION` on `new`                                                                                                                           | —                                                            | already plain. Opposite-direction candidate (render of the source kosztorys for a list nobody sees) — **out of scope**                              |
| 6   | `deletePresetAction` / `renamePresetAction` (`:140`, `:165`)         | inline                                                                                                                                                                            | —                                                            | already plain                                                                                                                                       |
| 7   | `lib/kosztorys/create-template.ts:28`                                | `markPresetEdited` on create                                                                                                                                                      | —                                                            | unchanged                                                                                                                                           |
| 8   | `src/app/(frontend)/szablony/[id]/page.tsx`                          | `KosztorysEditorV2` with `isTemplate`, zeroed financials, `getKosztorysTree` + `getWorkCatalogue`                                                                                 | same editor                                                  | unchanged                                                                                                                                           |
| 9   | `szablony/[id]/loading.tsx`                                          | bare `PageLoading`                                                                                                                                                                | editor routes use bare `PageLoading` (AGENTS.md, EX-877)     | correct, unchanged                                                                                                                                  |
| 10  | `lib/cache/revalidate.ts:29-30,55-66`                                | `expireCollectionsAfterResponse` + its doc paragraph                                                                                                                              | —                                                            | delete if #1 and #2 both go                                                                                                                         |
| 11  | `src/__tests__/lib/actions/investment-action.test.ts:131,136`        | asserts the after-response expiry                                                                                                                                                 | —                                                            | re-point to `revalidateCollections` with opts                                                                                                       |
| 12  | `src/__tests__/lib/cache/revalidate.test.ts:91-99`                   | tests `expireCollectionsAfterResponse`                                                                                                                                            | —                                                            | delete with #10                                                                                                                                     |
| 13  | `src/__tests__/stubs/cache-revalidate.ts:14`                         | stub export                                                                                                                                                                       | —                                                            | delete with #10 (the shared stub is mandatory for specs, AGENTS.md)                                                                                 |
| 14  | `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:39-41`     | stale comment referencing the workshop / after-response expiry                                                                                                                    | —                                                            | reword or delete (STRIP TEST)                                                                                                                       |

### 2. Render accounting per flow

| Flow                                                                       | Today                                                 | After                                                       | Delta                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| Szablon cell autosave (`updateItemFieldAction`, `deferRefresh`, item hook) | POST with render (hook) + `presets` after response    | POST with render, `presets` expired inside it               | 0                                                      |
| Stage progress autosave (raw SQL, `deferRefresh`)                          | POST `f=''` + follow-up GET                           | same; `presets` rides on `EXPIRE_NEXT` if `opts` is carried | 0 — becomes +1 inline render only if `opts` is dropped |
| Structure ops (add/remove section, reorder)                                | updateTag `KOSZTORYS_TREE_TAGS` → POST render         | same                                                        | 0                                                      |
| `snapshotAction` (≤1 per 10 min)                                           | no header, no render                                  | `presets` inline → one render                               | +1 per 10 min at most                                  |
| „Nowy szablon” (create)                                                    | POST no render, then GET `/szablony/<id>`             | POST renders `/szablony` (list), then GET `/szablony/<id>`  | +1 list render                                         |
| `/szablony` list after create, via Back                                    | may be served from the router cache / stale `presets` | fresh                                                       | fix (hypothesis)                                       |

The uncached name reads (#3, #4) cost two small queries per szablon page render today; the cached
version costs zero on warm cache. That is the counterweight to the +1 create render.

### 3. Why the original reasons no longer hold

- `createEmptyPresetAction`'s comment: „an inline expiry would first re-render /szablony inside this
  POST for a list nobody is looking at (lessons.md, EX-597)”. True, but EX-597 was about the editor
  (a ~325 KB render on every keystroke); `/szablony` is a small list rendered once per szablon
  created. The cost is real but small — the baseline decides.
- The template tail comment: „or every autosave would re-render the calling route”. False today: the
  tree write itself already re-renders it (see §2). The after-response trick was designed when
  opening a szablon wrote to the DB (EX-876 workshop); EX-893 made opening read-only.

## Baseline protocol

Reuses the EX-908 protocol (`context/changes/2026-09-29-redundant-router-refresh/research.md`,
„Measurement protocol”): prod-like `.next-e2e` build on 3100 against 5435, OWNER from `seed:e2e`,
discard cold runs, ~5 warm runs, median + range. Record per flow: action POSTs (bytes,
`x-action-revalidated`, `f` empty or not), non-prefetch RSC GETs, `[PERF]` lines (`buildKosztorysTree`
= one editor render), time-to-visible.

Flows, measured before and after the change:

1. `/szablony` list render (cold nav + hover-prefetch nav).
2. „Nowy szablon” → szablon page visible, title + crumb correct, no flash of „Nie znaleziono”.
3. Szablon cell edit autosave (small szablon and a ~1000-item one — reuse `perf-seed-kosztorys.ts`
   against a szablon id if possible, check first).
4. Stage progress edit on a szablon.
5. „Zapisz jako szablon” (`savePresetAction`, `new` and `overwrite`) — control, should not change.
6. Back from a new szablon to `/szablony` — the new row is listed without a reload.

Pass criteria: flows 3–5 identical render counts and within noise on time; flow 2 exactly +1 POST
render of `/szablony` and time-to-visible within noise; flow 6 correct.

## Code References

- `src/lib/cache/revalidate.ts:55-66` — `expireCollectionsAfterResponse`
- `src/lib/actions/kosztorys-presets.ts:111-129` — `createEmptyPresetAction`
- `src/lib/actions/investment-action.ts:85-92` — template tail
- `src/lib/queries/presets.ts:70-87` — uncached `getTemplateView`, `getPresetNameForCrumb`
- `src/components/nav/template-crumb.tsx:13` — crumb read
- `src/app/(frontend)/szablony/[id]/page.tsx:19` — page read
- `src/components/presets/create-empty-preset-dialog.tsx:22-31` — create → `router.push`
- `src/components/tables/data-table/data-table-row.tsx` — shared hover-prefetch row

## Architecture Insights

- The after-response expiry is a legitimate tool only when a write must stay render-free **and**
  nothing else in the same action already renders. The template tail fails the second condition
  everywhere except `snapshotAction`. Trading one cheap render for two uncached reads per page and a
  freshness gap is a bad trade.
- Pattern note: `after()`-expiry is „eventual consistency on purpose” — the write is acknowledged
  before its read side is invalidated. It forces every reader that must see the write immediately to
  bypass the cache (#3, #4), which is the classic cost of that pattern: the bypass spreads.

## Historical Context (from prior changes)

- `context/foundation/lessons.md:653-680` — EX-597 and „Second exit (EX-876)”, the paragraph that
  introduces `expireCollectionsAfterResponse`. Update or delete with #10 (lines ~672 onwards).
- `context/foundation/manual-checks.md:1627-1706` (`szablon-open-speed`, EX-876) and `:1929-1976`
  (`warsztat-per-szablon`, EX-893) — the latter records a stale `/szablony` after create; this change
  should close it.
- EX-876 / EX-893 docs deleted on archive — recoverable with `git show 91c92537^:…` and
  `git show f5218672^:…`.
- The EX-876 workshop files (for reference) — `git show 5b08f6ec:src/components/presets/preset-open-href.ts`
  and `e3c59ed7`.

## Related Research

- `context/changes/2026-09-29-redundant-router-refresh/research.md` (EX-908) — the measurement
  protocol and the Server Action re-render mechanics this change relies on.

## Open Questions

1. Does the szablony page ever stay on `/szablony` after create (e.g. create failure, name taken)? If
   yes the inline render is visible there — fine, but check the dialog's error path.
2. `SKIP_HOOK_REVALIDATION` on create: confirm the investments afterChange hook adds nothing the
   szablony list reads, so dropping it is not needed.
3. `snapshotAction` on a szablon: accept +1 render per 10 min, or pass it `deferRefresh`? Decide from
   the baseline.
4. Stale `/szablony` on Back: reproduce in the baseline before claiming the fix.
