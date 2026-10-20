---
date: 2026-10-20T09:12:50+0200
researcher: Claude
git_commit: ae2ab8208
branch: staging
repository: wykonczymy
topic: "One shared investment overview + reference data in a layout provider, without a perf regression"
tags: [research, codebase, reference-data, layout, rsc-payload, investments, kosztorys, orders]
status: complete
last_updated: 2026-10-20
last_updated_by: Claude
---

# Research: shared investment overview + reference data provider

## Research Question

Can the investment page block and the kosztorys „Inwestycja" tab become one `InvestmentOverview` client
component, with Zamów in both, by moving `fetchReferenceData()` (the heaviest fetch, run in the layout on every
management page) into a client context provider — without making any page slower or heavier? Includes a
before baseline.

## Summary

- **The reference data already reaches the browser once on every management page** — `Navigation` awaits it in
  the layout and hands it to `TopNav`. Measured: it is ~70 KB of RSC (72 KB `header` row on `/kasy`, 111 KB
  total).
- **React Flight already dedupes it.** On `/inwestycje/26` it is passed to TopNav, Zamów, the edit dialog and
  the Kierownik select, yet every worker is serialized exactly once (`canAddExpensesWithoutInvestment×64` =
  63 live + 1 trashed users, same on every page). `cache()` hands every caller in a request the same object, and
  Flight writes an object it has seen as a reference. So a provider carrying the **same object** adds no bytes —
  the after-measurement must show `×64` still.
- **The one real perf risk is ordering, not size.** `children` renders beside `Navigation` today; awaiting the
  data in `AuthenticatedShell` above `children` would start every page's fetches only after it resolves (cold
  entry: ~12 SQL). Pass the **promise** into the provider (the `UnreadCountsProvider` pattern) and never await
  it in the shell.
- **PII gate:** create the promise only for management roles (`null` otherwise). An unawaited promise handed to
  a client component is still serialized when it resolves — an EMPLOYEE would get every user's e-mail and phone.
- **The shared component is buildable client-side.** Only blocker: `InvestmentAssetsSection` is an async
  server component — the shared component takes `assets` and renders `InvestmentAssetsControl`; each page
  fetches them (both already do).
- **Order settings** (`fetchOrderSettings`) are fetched by the investment page and the list, not by
  `kosztorys_v2`. Open: provider vs the kosztorys page.

## Baseline (before)

Production build (`next start` on :3100), preview DB, `scripts/perf/lib.mjs` login, worktree
`../wykonczymy-worktrees/perf-investment-overview` off `staging` at `a5b463e75`, SQL instrument on.
Script: `baseline.mjs` (fetch-based, no browser) — per page and mode, first request + median of the warm rest.
Per `context/reference/perf-measurement.md`, read SQL counts and KB; local ms are noisy (two passes below
disagree by 2×).

| page (OWNER) | RSC KB | HTML KB | first-ever SQL | warm SQL | refData copies |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 245–253 | 992 | 16 | 4 | 1 |
| `/kasy` | 111 | 279 | 1 | 1 | 1 |
| `/inwestycje` | 294 | 1354 | 12 | 1 | 1 |
| `/inwestycje/26` | 228 | 753 | 10 | 3 | 1 |
| `/inwestycje/26/kosztorys_v2` | 534 | 675 | 7 | 3 | 1 |
| `/pracownicy/77` (EMPLOYEE) | 91 | 135 | 12 | 6 | **0** |

Warm RSC medians (ms, two passes): `/` 80/105, `/kasy` 43/94, `/inwestycje` 53/80, `/inwestycje/26` 56/50,
`kosztorys_v2` 64/56, EMPLOYEE 112/114. Raw output and the script: `dumps/perf/{baseline.mjs,before-1.txt,before-2.txt}` in the perf worktree
(gitignored; delete with the worktree).

"First-ever SQL" is the first request after `next start` (cold in-memory cache, warm `.next/cache/fetch-cache`
apart from what the build left). The after-run repeats the same sequence on a fresh `next start`.

**Pass criteria for the after-run:** refData copies stay 1 on every OWNER page and 0 for EMPLOYEE; RSC KB on
`/kasy` / `/` / `/inwestycje` within ±2 KB; warm SQL unchanged; `kosztorys_v2` RSC grows only by the overview's
own props (investment already ships; expect < 5 KB).

### Load timings (before)

`scripts/perf/measure.mjs` (headless Chromium full page load, 1440 px; EMPLOYEE at 390 px), page list
extended with `/sprzet`, `/zgloszenia-wydatkow`, `/zgloszenia`, `/kosztorysy` — the pages that drop their own
reference-data prop. Copy at `dumps/perf/measure-overview.mjs`, results `dumps/perf/results/before-timing-{1,2}.json`
in the perf worktree. 6 runs per page, warm = median of runs 2–6. Pass 1 started right after `next start` with
`.next/cache/fetch-cache` cleared; pass 2 followed immediately.

| page | warm SQL | depth | TTFB ms (p1 / p2) | LCP ms (p1 / p2) | doc KB |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 5 | 2 | 91 / 33 | 688 / 444 | 996 |
| `/inwestycje` | 2 | 2 | 413 / 158 | 920 / 564 | 1359 |
| `/inwestycje/26` | 4 | 2 | 256 / 44 | 684 / 108 | 756 |
| `kosztorys_v2` | 4 | 2 | 214 / 33 | 628 / 416 | 727 |
| `/pracownicy` | 2 | 2 | 264 / 48 | 340 / 108 | 337 |
| `/pracownicy/77` (OWNER) | 7 | 2–3 | 350 / 27 | 744 / 368 | 259 |
| `/kasy` | 2 | 2 | 51 / 37 | 192 / 156 | 279 |
| `/sprzet` | 3 | 2 | 23 / 24 | 372 / 380 | 207 |
| `/zgloszenia-wydatkow` | 7 | 2 | 26 / 20 | 708 / 408 | 706 |
| `/zgloszenia` | 3 | 2 | 31 / 29 | 388 / 424 | 493 |
| `/kosztorysy` | 2 | 2 | 100 / 80 | 468 / 176 | 648 |
| EMPLOYEE own page | 7 | 2 | 19 / 18 | 364 / 360 | 136 |

Pass-to-pass swing is up to 6× on the same build (pass 1 still warming the in-memory cache), so a single
after-pass against this table proves nothing. **The after-run interleaves:** before build on :3100 (this
worktree), after build on :3101 (`start.mjs 3101`, its own worktree), passes alternating
before → after → before → after, each preceded by the same warm-up pass. Compare the per-page median across
the two passes of each side. **Pass criteria:** warm SQL and depth identical; doc KB within ±2 KB
(`kosztorys_v2` and `/inwestycje/26` may grow < 5 KB); warm TTFB and LCP medians no worse than before by more
than max(15 %, 20 ms) on any page — a page outside that is re-measured, and a repeat is a regression to fix
before merge.

### Production timings (before)

Vercel Observability, `POST /v2/observability/query` via `vercel api` (team `team_BWfyTqJnjIqZBkHwBL0elgS4`,
project `prj_09PFFbZUvkE195j5oftkKaWVbPTG`), `environment eq 'production' and request_method eq 'GET' and
http_status eq '200'`, `groupBy: ['route']`, `summaryOnly: true`, 2026-10-06 → 2026-10-20. Function invocations
only — a CDN hit never reaches the function.

| Route | n | TTFB p50 | TTFB p75 | TTFB p95 | duration p50 | duration p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 780 | 103 | 250 | 2560 | 513 | 3948 |
| `/inwestycje` | 16531 | 15 | 19 | 45 | 7 | 85 |
| `/inwestycje/[id]` | 37565 | 16 | 20 | 73 | 8 | 74 |
| `/inwestycje/[id]/kosztorys_v2` | 35938 | 16 | 19 | 55 | 8 | 94 |
| `/kasy` | 15638 | 15 | 19 | 36 | 8 | 26 |
| `/kasa/[id]` | 7566 | 18 | 22 | 88 | 9 | 166 |
| `/pracownicy` | 16880 | 15 | 18 | 40 | 7 | 32 |
| `/pracownicy/[id]` | 27204 | 16 | 20 | 92 | 8 | 163 |
| `/sprzet` | 16450 | 15 | 19 | 40 | 8 | 28 |
| `/sprzet/[id]` | 63 | 19 | 32 | 43 | 10 | 32 |
| `/zgloszenia` | 15224 | 16 | 20 | 75 | 8 | 59 |
| `/zgloszenia-wydatkow` | 16603 | 15 | 19 | 53 | 8 | 46 |
| `/kosztorysy` | 15810 | 15 | 18 | 38 | 7 | 27 |

How to read it:

- **The counts are prefetches.** ~16 k per nav route in two weeks for ~40 accounts is the router prefetching
  every nav link, mostly from one desktop Safari client. With PPR off a prefetch renders layouts +
  `loading.tsx`, so p50 is close to **the layout's own cost** — the exact figure the provider change touches.
  Real navigations sit in the tail; no dimension separates them (`path_type` is `streaming_func` for both,
  `request_path` carries no `_rsc`).
- **p95 is cold starts.** Across all GET 200s: hot 370 194 calls, p50 16 / p95 70 ms; cold 1 831 calls,
  p50 1616 / p95 3586 ms; prewarmed 687 calls, p50 805 ms. `/`'s p95 is cold starts on low traffic, not this change.

**After:** rerun the same query (`dumps/perf/obs.mjs <start> <end> <env>` in the perf worktree) filtered
to the after-build's `deployment_id` — the staging preview while it's the only deploy carrying the change, then
production for the first full week after release — against the same filter on the deployment before it. Pass:
hot-start TTFB p50 within ±3 ms and p75 within max(15 %, 5 ms) per route. Low-n routes (`/`, `/sprzet/[id]`)
are read, not gated. This is the field check after release; **the local interleaved A/B above stays the gate
before merge**.

## Detailed Findings

### How the layout loads it today

- `src/app/(frontend)/layout.tsx:67-110` — `AuthenticatedShell`: `CurrentUserProvider` → `UnreadCountsProvider`
  → shell with `<Navigation>` (`:95`) beside `<main>{children}</main>` (`:99-101`).
- `src/components/nav/navigation.tsx:17-27` — awaits `fetchReferenceData()` for management roles only, merges
  `currentUserId` / `currentUserRole`, passes to `TopNav`; EMPLOYEE gets `undefined`.
- `Navigation` has no Suspense of its own; the nearest boundary is `layout.tsx:54` (`<Loader>`), so the header
  and sidebar already wait for this fetch. `children` sits under `(frontend)/loading.tsx` and renders in
  parallel.
- `src/lib/queries/reference-data.ts:55-192` — `cache(cached(...))`, 5 SQL in parallel; tags cashRegisters,
  investments, users, otherCategories, expenseCategories, kosztoryses.
- Promise pattern to copy: `layout.tsx:74` (`fetchUnreadCounts()` unawaited) → `hooks/use-unread-counts.tsx`
  (context holds the promise; `use(context)` then `use(promise)`) → `nav/unread-badge.tsx:17-31` wraps itself in
  `<Suspense fallback={null}>`.

### Who passes reference data to client components (all deduped by Flight today)

- Whole `ReferenceDataT`: TopNav dialogs (`top-nav.tsx:31-33`), `/` dashboard → `PendingExpenseDrafts`,
  `/inwestycje` → `InvestmentDataTable` → `OrderDialog`, `/inwestycje/[id]` → `OrderButton` (`page.tsx:99`),
  `/zgloszenia-wydatkow` → `PendingExpenseDrafts` / `ExpenseDraftsDataTable`.
- Slices: `workers` (edit dialog, Kierownik select, `KosztorysEditorV2`, `CashRegistersTable`, equipment),
  `cashRegisters` (`UserDataTable`, `EditWorkerDialog`), base data → `TransferDataTable` via
  `transfer-table-server.tsx:56,107`.
- Need the merged user fields: `DepositForm`, `ExpenseForm`, `InternalTransferForm`, `OrderDialog` (role at
  `order-dialog.tsx:48`). `TransferDataTable` and `TelmakCheckDialog` already read the user from
  `useCurrentUser()`.

### Scope of the provider

- Under `AuthenticatedShell`: all of `(frontend)`, including `kosztorys_v2` and `/pracownicy/[id]`.
- Outside: `(share)`, `(auth)`, `(legal)`, `(payload)` — own root layouts. `SummaryPanelContent` also mounts
  under `(share)` and deliberately reads no session (`summary-panel-content.tsx:154`); the Inwestycja tab never
  renders there (no `investment` in preview, view `clientVisible: false`), but a hook reading the provider must
  not be called on that path.
- A server action re-renders the route, layout included (`updateTag`), so the provider's data is re-serialized
  on every such write — exactly as TopNav's is today. No change.

### The two views today (drift)

Investment page (`inwestycje/[id]/page.tsx:71-134`):
trash banner; buttons Edit (with workers), Contract, RequestReview (lock `completed`), Sheet (`hasSheet`),
Kosztorys v2, Zamów (`!trashed && isOfferedForBooking`); InfoList via
`buildInvestmentInfoFields(investment, { isReadOnly: trashed, hideStatus: !trashed })` + Kierownik select;
standalone status select; notes (`readOnly={trashed}`); AI notes; `InvestmentAssetsSection` („Zdjęcia i pliki"
h2 + control).

Kosztorys tab (`summary-investment-tab.tsx:21-27`):
`InvestmentAssetsControl` + Edit (workers) in one row; InfoList with defaults (status badge read-only, Etap AI
select); notes; AI notes. No Contract / Review / Sheet / Zamów / Kierownik / status select; no trashed handling.

Data reaching the tab (`kosztorys_v2/page.tsx` → `KosztorysEditorV2` → `KosztorysEditorBody:516-547` →
`KosztorysTotalsPanel` → `SummaryPanelContent:283-285`): `investment` (with details), `assets`, `workers`.
`lock` and `hasSheet` exist on the page/body but are not forwarded to the panel — the shared component needs them
(trashed → read-only, completed → review button, Sheet button).

Client/server: everything in both views is a client component or safe inside one (`SheetButton`,
`OpenKosztorysV2Button`, `InvestmentAiNotes`, `InfoList`); `ContractDialog` calls a `'use server'` read. The only
server component is `InvestmentAssetsSection`.

### Zamów

- `OrderButton` props (`order-button.tsx:10-14`): `investment` (address + `siteManagerId`), `referenceData:
  ReferenceDataT`, `orderSettings`. Gate `isOfferedForBooking` (planowana / active) + not trashed.
- `fetchOrderSettings` (`lib/queries/order-settings.ts`): cached global read; called by
  `inwestycje/[id]/page.tsx:62` and `inwestycje/page.tsx:19` only.

## Code References

- `src/app/(frontend)/layout.tsx:67-110` — shell, providers, Navigation beside children
- `src/components/nav/navigation.tsx:17-27` — current fetch + role gate
- `src/hooks/use-unread-counts.tsx` — promise-in-context pattern
- `src/hooks/use-current-user.tsx` — plain-value provider pattern
- `src/lib/queries/reference-data.ts:55-192` — the fetch
- `src/app/(frontend)/inwestycje/[id]/page.tsx:59-134` — investment page block
- `src/components/kosztorys/summary/tabs/summary-investment-tab.tsx` — kosztorys tab
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:221,516-547` — panel gate and props
- `src/components/orders/order-button.tsx:10-14`, `src/components/orders/order-dialog.tsx:48`
- `src/components/investments/investment-info-fields.tsx` — `isReadOnly` / `hideStatus`
- `scripts/perf/` + `context/reference/perf-measurement.md` — measurement kit

## Architecture Insights

- Flight dedupe by identity is what keeps prop-drilling cheap here; it holds only while every consumer gets
  objects from the same `cache()` result. A consumer that maps/filters (`workers.filter(...)`) on the server
  creates a new array and pays again.
- Provider + promise = the Context-as-dependency-injection pattern React uses for server data (`use(promise)`),
  the same shape as `UnreadCountsProvider`. Consumers must sit under a Suspense boundary, or the nearest one
  shows its fallback while it resolves.

## Historical Context (from prior changes)

- `context/archive/2026-10-15-roundtrip-audit/audit.md:20-21,62-97` — P4 moved notes off the reference data
  (−107 KB RSC per management page); P3 removed refData from the EMPLOYEE phone page (~155 KB). RSC after:
  `/` 241, `/kasy` 112, `/inwestycje` 317, `/inwestycje/26` 227, `kosztorys_v2` 533 KB — matches today's
  baseline within noise.
- `context/archive/2026-07-27-decouple-panel-write-refresh/change.md:55,109` — deduped from 3× to 1× per
  render; safe only because no action reads it before a mutation in the same request.
- `context/foundation/lessons.md:188-199` — `cache(cached(fn))`; root layout renders twice per request.

## Related Research

- `context/archive/2026-10-15-roundtrip-audit/audit.md`

## Open Questions

1. Order settings: in the same provider (one more tiny cached read on every management page) or fetched by the
   `kosztorys_v2` page and drilled through editor → body → panel → tab?
2. Does Flight still dedupe when the provider carries a **promise** of the object rather than the object? Expected
   yes (the writtenObjects map is per request), verified only by the after-run's `×64`.
3. Should TopNav's dialogs and the pages' existing `referenceData` props also switch to the hook in this change,
   or only the new consumers (OrderButton / overview)? Switching all removes prop plumbing but widens the diff.
