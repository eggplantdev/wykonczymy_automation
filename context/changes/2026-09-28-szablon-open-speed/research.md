---
date: 2026-09-28T11:38:21+02:00
researcher: Claude (Opus 5.5)
git_commit: 177fc894
branch: staging
repository: wykonczymy
topic: "Why opening a szablon from the listing freezes for seconds, and how to make the click navigate instantly with „Otwórz" running on the target page"
tags: [research, codebase, szablony, workshop, server-actions, router-cache, prefetch, kosztorys-editor]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: instant szablon open — navigate first, „Otwórz" on the target page

**Date**: 2026-09-28T11:38:21+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 177fc894
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Clicking a szablon on `/szablony` freezes for several seconds with no feedback, and the loader shows
only at the very end; opening an investment feels far faster despite far more data. Owner's target
(reframe, 2026-09-28): a click on a row navigates to `/szablony/[id]` **immediately** (name + loader),
and „Otwórz" (loading the szablon into the warsztat) runs **on that page**, in one round trip instead
of three. App-wide "title in the shell, loader below" is split into `instant-page-shell`.

## Summary

- **The server is not slow.** Measured on the local DB with a 310-item szablon, the whole server side
  of „Otwórz" is ~100 ms (mirror 13–29 ms, tree replace 64–86 ms, tree read 4–6 ms, catalogue 3–7 ms).
- **The freeze is the client sequence in `use-open-preset.ts`**: an awaited server action with only
  `opacity-50` as feedback → the action's `updateTag` on 5 tags re-renders `/szablony` inside the POST
  and wipes the client router/prefetch cache → `router.push` to a never-prefetched `/szablony/[id]`
  (the `loading.tsx` shell can't show until the server streams it) → `router.refresh()`, a third full
  render of the editor. Three serialized server renders plus a cold navigation.
- **Dropping `KOSZTORYS_TREE_TAGS` alone does not remove the forced render.** Any tag invalidated
  inside a server action — including the mirror's deferred `presets` and Payload hooks firing inside
  the action — sets `x-action-revalidated`, which makes Next re-render (or, with `EXPIRE_NEXT`,
  re-fetch) the calling route and clears the client prefetch cache.
- **The reframed flow is feasible with one round trip and no forced render**: navigate instantly to a
  prefetched `/szablony/[id]`, then run an open call that revalidates nothing visible to the client
  and **returns the tree**, rendered by a client host in place of the prompt. `presets` invalidation
  moves to `after()` (server cache only), or the call becomes a route handler.
- Several **existing defects** on the open path surfaced (pointer race across 4 commits, `updated_at`
  bump on a mere open, a "Przed wczytaniem" snapshot on every open). Whether they're in scope is an
  owner decision — see Open Questions.

## Detailed Findings

### 1. Today's open path (the three round trips)

- `src/hooks/use-open-preset.ts:16-24` — `startTransition(async () => { await openPresetInWorkshopAction; router.push; router.refresh })`.
  The comment at `:8-10` gives the reasons: opening is a WRITE, so it's click-only, and "only the
  page's own render proves the write landed" (the reason for the refresh).
- `src/components/presets/presets-data-table.tsx:22-23` — `onRowClick={(row) => open(row.id)}`,
  `opacity-50` while pending. It is the only `onRowClick` table. Rows with an href prefetch on hover
  (`src/components/tables/data-table/data-table-row.tsx:57`), so investments get a warm
  `loading.tsx` shell and szablony don't.
- `src/lib/actions/kosztorys-presets.ts:159-202` — `openPresetInWorkshopAction`:
  1. `getWorkshop`;
  2. if the warsztat holds another szablon: `mirrorWorkshopPreset({ force: true })` (:173), then null
     the pointer (:184);
  3. `resolveWorkshopInvestment` on first use (:187);
  4. `reloadInvestmentFromPreset` (:188) — snapshot + wipe + bulk insert, repeatable read, lock,
     retries;
  5. set the pointer (:197);
  6. `protectedAction` revalidates `[...KOSZTORYS_TREE_TAGS]` (:200) via `updateTag`.
- `src/app/(frontend)/szablony/[id]/page.tsx` — read-only since `e93977f3`. `getWorkshopView` (:21);
  when the warsztat doesn't hold this szablon it renders `OpenWorkshopPrompt` (:27); otherwise
  `getKosztorysTree` (uncached, :33) + `getWorkCatalogue` (cached, :34) → `KosztorysEditorV2` (:38)
  with zero/empty financial props and `templatePresetId`.
- Both `szablony/loading.tsx` and `szablony/[id]/loading.tsx` re-export the bare `PageLoading` (🚧).

### 2. Next.js router mechanics that constrain the design (16.1.7, PPR off)

- **Any revalidation inside a server action is visible to the client.** `updateTag` / `EXPIRE_NOW`
  renders the calling route inside the POST response. `EXPIRE_NEXT` sets the same
  `x-action-revalidated` header, so the client does a RefreshAll navigate — the render is **moved to
  a second GET, not removed**. Either way `revalidateEntireCache` wipes the client prefetch cache.
  Consistent with lessons.md (EX-597 entry).
  - The comment at `src/lib/cache/revalidate.ts:24-28` ("`EXPIRE_NEXT` leaves the current route
    alone") is inaccurate in this respect. Worth correcting when the plan touches it.
- **Payload hooks running inside a server action** push into the same `pendingRevalidatedTags` — they
  count as the action's revalidation. `withPayloadTransaction(..., { skipRevalidation: true })`
  suppresses them via `req.context`. First-time provisioning (`payload.create` of the warsztat
  investment) currently fires `EXPIRE_NOW` through hooks.
- **An action that revalidates nothing leaves the router state untouched** — no re-render, no cache
  wipe. `after(() => revalidateTag(tag, EXPIRE_NOW))` inside the action expires the server cache
  after the response has been sent, and the client never learns of it.
- **A route handler never sets `x-action-revalidated`**, and `updateTag` throws there. That's the
  alternative transport: a POST returning JSON.
- **Prefetch and search params:** the prefetch cache key includes the search string, but navigating
  to `/szablony/5?open=1` builds optimistically from the empty-search `/szablony/5` entry. So
  prefetching `/szablony/<id>` (without the flag) gives an instant shell for the flagged URL too.
  `staleTimes.static` = 300 s; dynamic = 0.
- **Stripping a URL flag:** `router.replace` re-renders `page.tsx` on the server;
  `window.history.replaceState` does a restore without a fetch.
- **Client action queue:** server actions run serialized. A navigation or restore discards a pending
  action's router update, but not its fetch — the write still lands.
- **StrictMode** (default on in the App Router) runs a mount effect twice in dev, so an auto-open
  effect needs a guard (ref latch) or a server-side idempotency check.

### 3. Write path and editor constraints

- **`KOSZTORYS_TREE_TAGS` are dead weight for the warsztat** (`src/lib/cache/tags.ts:52-58`). No
  cached reader shows the warsztat tree: listing aggregates (`balances.ts`), client preview
  (`preview-kosztorys.ts`), `reference-data.ts` (filters `status <> 'szablon'`), `leads.ts`;
  `getKosztorysTree` is uncached. The client-totals SQL computes a row for the warsztat investment
  that is never displayed.
  - `reloadFromPresetAction` (`kosztorys-presets.ts:284-303`) shares the tags and **must keep them**
    — it writes a real investment's kosztorys.
- **`presets` invalidation is needed** — the pickers and the listing read `getPresets` /
  `getPresetSections` (`unstable_cache`, tag `presets`). Today the eviction mirror fires it
  (`mirror-workshop-preset.ts`, `revalidateCollections(['presets'], { deferRefresh: true })`); the
  comment at `:65` already rules out `updateTag` on that path.
- **`KosztorysTreeT` is serializable**, so the open call can return it (built with `buildKosztorysTree`)
  and the client can render the editor without a second fetch. `getWorkCatalogue` stays server-side
  (cached, `src/lib/queries/work-catalogue.ts:20`) and can be passed from the page regardless of
  which branch renders.
- **Editor reseed latch — the main trap.** The editor tree is a mount-time `useState` snapshot.
  Reseeding happens only through `useRestoreRemount`
  (`src/components/kosztorys/editor/kosztorys-editor-v2.tsx:27-31`), keyed on
  `${tree.revision}:${itemCount}` and triggered by a **new `tree` prop** (`router.refresh` after
  restore/import; `refreshDataAction` for stale-tree recovery). A client host that renders the
  editor from the action's tree must:
  - render the same component at the same tree position;
  - prefer the server prop once one arrives (`serverTree ?? actionTree`), or restore and stale-tree
    recovery silently stop reseeding.
- **Idempotency:** if `held.presetId === presetId`, open should return the current tree without
  mirror, replace or snapshot. That covers StrictMode double-fire, a re-click and a reload of the
  flagged URL.
- **Stale-tab writes:** writes addressed by `{investmentId}` from a tab whose szablon has since been
  evicted land in whichever szablon now holds the warsztat. This is already true today and not made
  worse by the reframe; the mirror flush (`use-workshop-mirror-flush.ts`, 15 s interval +
  visibilitychange + unmount) is the existing tail-closer.

### 4. Existing defects found on the open path (not caused by this change)

1. **Pointer race.** Open spans 4 separate commits (null pointer → replace → set pointer, with the
   mirror before them). A concurrent open or mirror in between can observe a null or a stale pointer.
   Fix shape: set the pointer and read the tree **inside** the replace transaction, under the same
   lock.
2. **`updated_at` bump on a mere open.** The forced eviction mirror rewrites the evicted szablon's
   payload even when nothing changed, which reorders the library listing.
3. **Snapshot pile-up.** `reloadInvestmentFromPreset` writes a "Przed wczytaniem" snapshot on every
   open. Related open manual check: `context/foundation/manual-checks.md:658-669` (the snapshot does
   not appear in „Wersje" after a switch; an empty szablon is invisible in the „Przełącz" picker).

### 5. Entry points into „Otwórz"

| Entry                           | File                                              | URL changes?           | Today's "proof" of the write                               |
| ------------------------------- | ------------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| Listing row                     | `presets-data-table.tsx:22`                       | yes → `/szablony/[id]` | push + refresh                                             |
| Prompt on a stale/typed URL     | `open-workshop-prompt.tsx`                        | **no** (same URL)      | the incidental `updateTag` re-render swaps prompt → editor |
| After creating an empty szablon | `create-empty-preset-dialog.tsx`                  | yes                    | push + refresh (via hook)                                  |
| „Przełącz" in the warsztat      | `reload-from-preset-dialog.tsx` (workshop branch) | yes                    | push + refresh (via hook)                                  |
| Top-bar crumb                   | `src/components/nav/template-crumb.tsx`           | —                      | plain `Link`, not a write                                  |

If the prompt stops relying on tags, it needs its own way to show the editor. The natural fit is the
same client host that renders the returned tree, so the prompt and the auto-open share one component.

### 6. Tests that the redesign touches

None of them assert tags, `router.push` or `router.refresh` — the redesign breaks no assertion by
changing the transport.

- `src/__tests__/components/presets/create-empty-preset-dialog.test.tsx` — mocks the router + action.
- `src/__tests__/lib/actions/kosztorys-presets.test.ts` — DB integration: eviction flush, pointer,
  snapshot label, a failed open leaves the pointer null, empty szablon.
- `mirror-workshop-preset.test.ts`, `use-workshop-mirror-flush.test.tsx`, `workshop-investment.test.ts`.
- No E2E spec covers `/szablony`; **EX-847** is filed for it. `test-plan.md` names no szablon risk.

## Code References

- `src/hooks/use-open-preset.ts:8-24` — the three-round-trip client sequence and its rationale comment
- `src/lib/actions/kosztorys-presets.ts:159-202` — `openPresetInWorkshopAction`
- `src/lib/actions/kosztorys-presets.ts:284-303` — `reloadFromPresetAction` (real investments; keeps tags)
- `src/lib/actions/mirror-workshop-preset.ts:35-36,65` — throttle claim, deferred `presets` revalidation
- `src/lib/cache/tags.ts:52-58` — `KOSZTORYS_TREE_TAGS`
- `src/lib/cache/revalidate.ts:24-28` — inaccurate `deferRefresh` comment
- `src/app/(frontend)/szablony/[id]/page.tsx:21-38` — read-only page: prompt vs editor
- `src/components/presets/presets-data-table.tsx:22-23` — `onRowClick` + `opacity-50`
- `src/components/tables/data-table/data-table-row.tsx:4,57` — href rows prefetch on hover; `onRowClick` rows by design don't
- `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:27-42` — restore latch token, mirror flush wiring
- `src/components/kosztorys/editor/hooks/use-workshop-mirror-flush.ts` — interval/visibility/unmount flush
- `src/lib/queries/presets.ts` — `getPresets`, `getPresetSections`, `getPresetRows`, `getWorkshopView`, `getPresetNameForCrumb`
- `src/lib/queries/work-catalogue.ts:20-27` — cached catalogue
- `src/lib/kosztorys/replace-tree-with-snapshot.ts`, `reload-from-preset.ts` — snapshot + wipe + bulk insert

## Architecture Insights

- **"The render proves the write" is the pattern to retire here.** The refresh existed because the
  page, not the action, was the source of truth for what the warsztat holds. Returning the tree from
  the open call makes the call itself the proof, which is what allows the page to stop re-rendering.
  This is the command–query split applied to the transport: the command returns exactly the state it
  produced, instead of asking the router to re-query.
- **Revalidation is a client-visible side effect of a server action**, not just a server-cache
  concern. In this codebase the choice between `updateTag`, `EXPIRE_NEXT` and `after()` is really a
  choice about whether the calling route re-renders — the cache-tag vocabulary hides that.
- **Only `loading.tsx` is instant while PPR is off.** The instant shell for the reframe comes from
  prefetching `/szablony/<id>` on row hover. That's safe now that the page is read-only (`e93977f3`),
  which removes the original reason `5d5145b0` switched the row to `onRowClick`.

## Historical Context (from prior changes)

- `5d5145b0` — added `onRowClick` to the szablony table because opening was then a write-on-render,
  so a hover prefetch would have loaded the szablon.
- `e93977f3` — made `/szablony/[id]` read-only, introduced `OpenWorkshopPrompt` and `useOpenPreset`,
  and added `router.refresh()` as "proof" the write landed. The guard "a stale tab or typed URL gets
  a prompt, not an auto-open" comes from here and stays.
- `7e9714ec` — added autosave / the warsztat mirror. Its pruned plan/research docs are recoverable:
  `git show 7e9714ec:context/changes/2026-09-22-szablon-autosave/{plan,research,plan-brief}.md`.
- Archives: `context/archive/2026-09-14-szablony-crud/`, `context/archive/2026-09-22-szablon-autosave/`,
  `context/archive/2026-09-22-empty-preset-create/`.
- `context/foundation/lessons.md` — EX-597 entry (any tag in an action forces a render); the entry on
  links without a layout box (mobile links never prefetch), relevant to `instant-page-shell`.

## Related Research

- `context/changes/2026-09-28-instant-page-shell/change.md` — sibling change: title in `loading.tsx`, loader below.

## Open Questions (owner decisions for `/10x-plan`)

1. **Transport** for the open call:
   - (a) keep a server action that revalidates nothing, returns the tree, and moves the `presets`
     invalidation (and first-use provisioning's hooks, via `skipRevalidation`) into `after()`;
   - (b) a POST route handler returning JSON.
     (a) keeps `protectedAction` / auth / perf logging for free; (b) makes "no forced render"
     structural rather than a discipline. **Recommendation: (a)**, with a unit guard that the action
     revalidates nothing inline.
2. **Auto-open trigger:**
   - a URL flag (`/szablony/5?open=1`) stripped with `history.replaceState` after the call resolves
     (survives a hard reload, but a reload before the strip re-opens — harmless if open is
     idempotent);
   - or an in-memory intent handed from the row click (no URL trace, lost on reload).
     **Recommendation:** the URL flag + server idempotency.
3. **Scope of the existing defects** (§4): pointer race, `updated_at` bump on open, snapshot per
   open. The pointer race fix lands naturally if the tree is read inside the replace transaction; the
   other two are separable.
4. **`OpenWorkshopPrompt`** — confirm it becomes the same client host (a button instead of the
   auto-trigger), so no entry point relies on an incidental re-render.
5. **„Przełącz" and create-empty entries** — confirm they switch to "navigate with the flag" rather
   than awaiting the action first, for consistency with the listing.
6. **Listing (`/szablony`) slowness** stays out of scope unless measured in the browser — nothing is
   slow server-side (~6 ms of queries).
