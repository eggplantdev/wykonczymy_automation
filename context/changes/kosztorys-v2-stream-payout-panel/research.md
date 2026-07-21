---
date: 2026-07-21T19:39:17+0200
researcher: ex-Plant
git_commit: 5b75fb7ab404b90905ca8956fd20980f83db7c90
branch: konradantonik/ex-554-podsumowanie-dodac-figure-kwota-do-zaplaty-podwykonawcy
repository: wykonczymy
topic: "Stream the „Podsumowanie podwykonawców" footer panel via <Suspense> out of the blocking Promise.all"
tags: [research, codebase, kosztorys-v2, suspense, streaming, rsc, performance]
status: complete
last_updated: 2026-07-21
last_updated_by: ex-Plant
---

# Research: Stream the „Podsumowanie podwykonawców" footer panel via `<Suspense>`

**Date**: 2026-07-21T19:39:17+0200
**Researcher**: ex-Plant
**Git Commit**: 5b75fb7a
**Branch**: konradantonik/ex-554-podsumowanie-dodac-figure-kwota-do-zaplaty-podwykonawcy
**Repository**: wykonczymy

## Research Question

Can `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx` render faster by pulling the two
PAYOUT fetches out of the blocking `Promise.all` and streaming the subcontractor summary footer
behind `<Suspense>`? Leaning toward **path A** (render `SubcontractorSummary` as a suspended sibling
outside `KosztorysEditorV2`, passing payout promises down and unwrapping with `use()`). Key unknown:
the panel only shows in the „Z narzędziami" / „Bez narzędzi" views — is a server-level Suspense
sibling even feasible given the view is chosen by client state, or is **path B** (promise props
threaded into the client editor + inner Suspense) forced?

## Summary

**Recommendation: do not build the proposed change.** Four independent findings each undercut it,
and together they're decisive:

1. **The active view is client-side localStorage state, invisible to the server.** `usePriceView`
   → `useSyncExternalStore` over `localStorage`, keyed per investment; the SSR snapshot always
   returns the `'client'` fallback. So `page.tsx` cannot know whether the subcontractor panel should
   render. **Path A (a server-level Suspense sibling gated per view) is infeasible** without first
   lifting the view into the URL (`searchParams`).

2. **The payout fetches are not the bottleneck — `getKosztorysTree` is.** The tree is 5 uncached
   Payload ORM queries that scale with row count (items × stage-progress) and re-run on _every_
   request; the two payout fetches are single indexed GROUP-BY/SELECT queries, cached under the
   `transfers` tag. Streaming the payouts out of the `Promise.all` leaves first paint still blocked
   on the tree, which sits **above** the panel. The optimization targets the wrong `await`.

3. **`<Suspense>`-behind-an-async-server-component is an established repo pattern; `use(promise)`
   is not.** Five real streaming sites exist — including a near-perfect analogue at
   `inwestycje/[id]/page.tsx:103` that streams the recon block (the only consumer of the long-pole
   kosztorys tree) as a slot prop so the rest paints immediately. But passing an un-awaited promise
   into a client component and unwrapping with `use()` has **zero precedent** — path B's mechanism
   would be a first-of-its-kind convention deviation.

4. **Only the payout _data_ is separable; the _component_ is welded to the editor.** The panel's
   headline figure `dueNet` is derived from **live client `rows` state** (`subtotals` `useMemo`),
   its visibility is gated by client `priceView`, and it's absolutely positioned inside a Radix
   `Collapsible` overlay tuned to the editor's viewport. You cannot relocate the component to a
   page-level sibling without a store/context bridge back into the editor for `dueNet` and a
   re-implementation of the view gating and layout.

Net: path A is blocked by client view state, path B is possible only for the _data_ (not the
component) and buys ~nothing because the tree dominates. The honest next step is **measure first**
(there is no PERF marker on `getKosztorysTree` — the one fetch you'd most want timed is the only
unmeasured one), not build streaming for the payout panel.

## Detailed Findings

### 1. The view-switch state (path-A feasibility)

- Active view is client-only, localStorage-backed: `usePriceView` returns
  `usePersistedEnum(\`kosztorys-view:${investmentId}\`, VALID_VIEWS, DEFAULT_VIEW)`—`src/components/kosztorys/use-price-view.ts:11-13`, default `'client'`at`use-price-view.ts:8`.
- Backing store is `useSyncExternalStore` over `window.localStorage` with an **SSR snapshot of the
  fallback** (`() => fallback`) — `src/hooks/use-persisted-enum.ts`. The server render always sees
  `'client'` regardless of the user's persisted choice.
- Consumed at `src/components/kosztorys/use-kosztorys-editor.ts:123`; the read-only client page pins
  the view to `'client'` as a disclosure lock (`use-kosztorys-editor.ts:~128`).
- `page.tsx` awaits only `params` (`{ id }`), never `searchParams`
  (`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:19-23`); it fetches payout data
  (`page.tsx:36-38`) and renders `<KosztorysEditorV2>` unconditionally (`page.tsx:84-100`).
- View values: `type PriceViewT = 'client' | 'w_tools' | 'own_tools'` — `src/lib/kosztorys/calc.ts:36`;
  labels „Z narzędziami" / „Bez narzędzi" at `src/components/kosztorys/kosztorys-toolbar-options.tsx:24-27`.
- The view also drives grid columns/prices/totals (`kosztorys-v2-columns.tsx:213-231`, `calc.ts:53-119`,
  `kosztorys-view-menu.tsx:102`) — a pervasive client-only concern that never round-trips.

**Consequence:** a server component cannot conditionally render the footer per view today. Path A
requires promoting the view to the URL first.

### 2. Fetch latency ranking (is the payout the bottleneck?)

Ranked cold-cache latency for the 8 `Promise.all` fetches:

1. **`getKosztorysTree`** — `src/lib/queries/kosztorys.ts:39-74` — 5 Payload ORM queries (items limit
   5000, stage-progress limit 100000 via relationship-join), row-count-scaling, **no `unstable_cache`
   → always cold**. Dominates.
2. `fetchReferenceData` — `src/lib/queries/reference-data.ts:59-193` — 6 full-table scans of small
   reference tables; cached warm.
3. `fetchCategoryBreakdowns` / `fetchFilteredByType` — 1 indexed GROUP BY each.
4. `fetchPayoutTransactionsForInvestment` — `sum-transfers.ts:318` — 1 indexed SELECT + ORDER BY.
5. `fetchPayoutsByWorkerForInvestment` — `sum-transfers.ts:285` — 1 indexed GROUP BY.
6. `fetchZaliczkiByStage` — 1 indexed SELECT.
7. `requireInvestmentOr404` — cached `findByID` + React-cached auth.

`transactions.investment_id` is indexed (`src/migrations/20260211_213603.ts:34`), so all
investment-scoped transfer queries are index scans. PERF markers exist on the payout legs
(`sum-transfers.ts:307,343`) and reference-data (`reference-data.ts:109`) but **not** on
`getKosztorysTree` — the long pole is the only unmeasured fetch.

**Consequence:** streaming the payout fetches out of the blocking `Promise.all` buys effectively
nothing for first paint; the grid data (tree) still blocks and is above the panel.

### 3. Suspense / `use(promise)` precedents (which mechanism the repo sanctions)

- `<Suspense>` streaming is established (5 app sites):
  - `src/app/(frontend)/layout.tsx:34` — streams `AuthenticatedShell` (async server component).
  - **`src/app/(frontend)/inwestycje/[id]/page.tsx:103`** — `<Suspense fallback={null}>` around
    `InvestmentReconBlock` passed as a **slot prop** into `FinancialStats`; comment: "Streamed off the
    critical path: only this block awaits the kosztorys tree (the page's long-pole fetch); the rest
    renders immediately." The canonical template for this idea.
  - `src/components/transfers/transfers-section.tsx:16`, `src/components/nav/top-nav.tsx:25` — same
    async-server-component-behind-Suspense shape.
- **`use(promise)` into a client component: zero precedents.** The only `use(...)` calls are context
  reads (`use-kosztorys-editor-context.tsx:30`, `use-current-user.tsx:19`); no prop is typed
  `Promise<...>`. Path B's mechanism would be the first of its kind.
- `loading.tsx` route-level streaming is active (`src/app/loading.tsx`, `src/app/(frontend)/loading.tsx`);
  no per-segment `loading.tsx` under `inwestycje/[id]`.
- The `reference-data.ts` fetchers use `unstable_cache` only — **no React `cache()`**, so two
  un-awaited calls in one render are not request-deduped on a miss. Passing a single promise down
  (or wrapping in `cache()`) is what dedupes.
- Stack constraint: `cacheComponents` and `'use cache'` are disabled (`AGENTS.md:188`,
  `next.config.ts:9`); nothing prohibits `<Suspense>` streaming.

### 4. Editor coupling (component vs data separability)

- Payout props are **pure pass-through**, 4 levels deep: `page.tsx:36-38,75-82,97-98` →
  `KosztorysEditorV2` (`kosztorys-editor-v2.tsx:28-29,73-74`, zero reads) → `KosztorysEditorBody`
  (`kosztorys-editor-body.tsx:51-52,212-213`, zero reads) → `KosztorysTotalsPanel`
  (`kosztorys-totals-panel.tsx:93-96,175-180`, first real consumer) → `SubcontractorSummary`
  (`subcontractor-summary.tsx:96-106`).
- **The component is NOT cleanly separable:**
  - `dueNet` (`subcontractorDueNet`) is a `useMemo` over `subtotals` derived from **live `rows`
    state** — `use-kosztorys-editor.ts:394`. A lifted panel loses live-updating `dueNet` as the user
    edits the grid.
  - `rows` is a mount-time-snapshot `useState(() => treeToRows(tree))` (`use-kosztorys-editor.ts:114`,
    EX-441 lesson) — payouts don't touch seeding, but `dueNet` rides on it.
  - The collapsed headline of `KosztorysTotalsPanel` also reads `payoutsByWorker`
    (`kosztorys-totals-panel.tsx:93-96,133-140`) — payout data feeds both the expanded content and the
    collapsed headline, so you can't lift only `SubcontractorSummary`.
  - Visibility gated by client `priceView !== 'client'` (`kosztorys-totals-panel.tsx:87,143,174`).
  - Layout: absolutely positioned inside a Radix `Collapsible.Content` overlay
    (`kosztorys-totals-panel.tsx:102` `absolute inset-x-0 bottom-0 z-20`) over the grid's bottom edge,
    with its own `max-h-[calc(100vh_-_11rem)]` scroll (`subcontractor-summary.tsx:115`). A page-level
    sibling can't absolutely position over the grid, live in the Collapsible, or see the view.
- `SubcontractorSummary` is `'use client'` (`subcontractor-summary.tsx:1`) with a `useState` toggle
  and a virtualized TanStack `DataTable`.

## Code References

- `src/components/kosztorys/use-price-view.ts:8-13` — client localStorage view state (path-A blocker)
- `src/hooks/use-persisted-enum.ts` — `useSyncExternalStore`, SSR snapshot = fallback
- `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:36-60` — the blocking 8-fetch `Promise.all`
- `src/lib/queries/kosztorys.ts:39-74` — `getKosztorysTree`, the uncached long pole
- `src/lib/db/sum-transfers.ts:285,318` — the two payout fetches (indexed, cached)
- `src/app/(frontend)/inwestycje/[id]/page.tsx:99-106` — the canonical Suspense-slot streaming template
- `src/components/kosztorys/kosztorys-totals-panel.tsx:87,93-96,102,143,174-180` — panel gating, headline, overlay layout
- `src/components/kosztorys/use-kosztorys-editor.ts:114,394` — mount-snapshot `rows`; `dueNet` from live subtotals
- `src/components/kosztorys/subcontractor-summary.tsx:1,96-106,115` — client component, consumer, tuned scroll

## Architecture Insights

- The existing recon-block streaming (`inwestycje/[id]/page.tsx:103`) is the _correct_ application of
  this idea: it streams off the critical path the component that awaits the **long pole** (the tree),
  so the rest paints immediately. The kosztorys_v2 page is the inverse situation — the editor's whole
  reason to exist _is_ the tree, so there is no fast shell to paint before it. Streaming the payout
  panel (a fast, below-the-fold consumer) while the tree still blocks above it optimizes the wrong await.
- Convention signal: prefer async-server-component-behind-`<Suspense>` over `use(promise)`; the latter
  is unprecedented here and only justified when a streamed subtree genuinely needs client interactivity
  over the streamed data.

## Historical Context (from prior changes)

- `context/changes/podsumowanie-podwykonawcow/` — the slice that added `SubcontractorSummary` + the two
  payout fetches (PR #31); its `review-gate.md` ledger covers the shipped shape.
- `context/foundation/lessons.md` — the mount-time-snapshot `rows` lesson (EX-441) and the
  `DynamicDataSheetGrid` reactive-view lesson both bear on why the panel is welded to client state.

## Open Questions

- If page latency is a real complaint, the measurable lever is **`getKosztorysTree`**, not the payouts:
  add a `perfStart` marker to confirm it's the long pole, then consider caching it (it's the only
  uncached fetch) or streaming the _tree-dependent_ summary block — a separate investigation.
- Would promoting `priceView` to a URL `searchParam` be worth it on its own merits (shareable/deep-link
  views, server-aware rendering)? That would unblock path A, but it's a larger change with its own
  trade-offs (localStorage persistence vs URL, the read-only client-view lock) — out of scope here.
