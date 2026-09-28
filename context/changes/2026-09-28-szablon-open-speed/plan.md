# Instant szablon open — Implementation Plan

## Overview

A click on a szablon navigates to `/szablony/[id]` at once, and „Otwórz" runs **on that page** as a
single atomic, idempotent call that returns the tree. It revalidates nothing the client can see, so
the router neither re-renders the page nor wipes its prefetch cache. Three existing defects on the
same path are fixed along the way:

- the pointer race;
- the `updated_at` bump on a mere open;
- the orphaned „Przed wczytaniem" snapshot.

## Current State Analysis

Full evidence is in `research.md`. In short:

- **The server is not the bottleneck.** Its work is ~100 ms. The multi-second freeze is the client
  chain in `src/hooks/use-open-preset.ts:16-24`: an awaited action with only `opacity-50` as
  feedback, then an `updateTag` re-render of `/szablony` inside the POST plus a router-cache wipe,
  then a push to a never-prefetched route, then `router.refresh()`.
- **`openPresetInWorkshopAction` runs as four separate commits** (`kosztorys-presets.ts:159-202`):
  1. forced eviction mirror;
  2. null pointer;
  3. replace tree;
  4. set pointer.

  Two concurrent opens can interleave as A-replace, B-replace, B-set, A-set. That leaves B's tree
  under pointer A, and the next mirror writes B's content into szablon A.

- **The „Przed wczytaniem" snapshot is orphaned.** It is inserted while the pointer is null, so
  `HELD_PRESET` stamps `template_preset_id = NULL` (`src/lib/db/snapshots.ts:45,65`). The drawer
  filters on the held szablon (`:101`), so the row is invisible everywhere and unrestorable. That is
  the root cause of the open manual check at `context/foundation/manual-checks.md` („Wersje" nie
  pokazuje wpisu „Przed wczytaniem").
- **`updatePresetPayload` always sets `updated_at = now()`** (`src/lib/db/presets.ts:85-99`), so the
  forced eviction mirror reorders the library even when nothing changed.

## Desired End State

Clicking a row on `/szablony` shows the `loading.tsx` shell immediately (the row is a prefetched
link). The page then renders the szablon name with a loader, and the editor appears after one POST
that triggers no route re-render. Re-opening the szablon the warsztat already holds writes nothing.

After an open:

- the warsztat tree, the pointer, and the outgoing szablon's library copy are always consistent;
- the outgoing szablon's `updated_at` moves only if its content changed;
- no snapshot is written.

A stale tab or a typed URL (no `?open=1`) still gets the „Otwórz szablon" prompt, and it opens in
place without navigating or refreshing. A failed open shows a toast and that same prompt.

### Key Discoveries:

- `buildKosztorysTree(investmentId, req)` accepts a transaction `req` (`src/lib/queries/kosztorys.ts:33`),
  so the tree can be read inside the swap transaction.
- `restoreKosztorys(payload, req, investmentId, tree, { clearGlobalDiscount })` re-takes the
  investment lock itself (`src/lib/kosztorys/restore-kosztorys.ts:14-24`).
- `replaceTreeWithSnapshot` owns the `repeatable read` + bounded retry-on-`isConcurrentWrite` loop
  (`replace-tree-with-snapshot.ts:58-107`). The open transaction needs the same loop.
- The mirror's transaction body (`mirror-workshop-preset.ts:39-59`) runs lock → pointer re-check →
  `serializeKosztorysAsPreset(id, req)` → `updatePresetPayload`, and can run inside another
  transaction.
- `after()` from `next/server` inside a server action already has a precedent at
  `src/lib/actions/transfers.ts:149`.
- Payload hooks honour `context.skipRevalidation` (`src/hooks/revalidate-collection.ts:26,39`).
- `onRowClick` on DataTable has exactly one consumer, `presets-data-table.tsx:22`, and becomes dead
  once rows are links.
- `KosztorysEditorV2` reseeds only through `useRestoreRemount(treeToken)`, driven by a new `tree` prop
  (`kosztorys-editor-v2.tsx:27-31`). `handleTreeReplaced` calls `router.refresh()`, and
  `handleStaleTree` calls `refreshDataAction` (`revalidatePath('/', 'layout')`). Both deliver a fresh
  server tree as a prop.
- `DynamicPagePropsT` already carries `searchParams` (`src/types/page.ts`).

## What We're NOT Doing

- App-wide "title in the prefetched shell" — that's `instant-page-shell`. The szablon name shows
  once the page's first render arrives, which involves no write and is fast. The instant part is the
  `loading.tsx` shell.
- `/szablony` listing speed — nothing slow server-side; out of scope unless measured in the browser.
- `reloadFromPresetAction` (a real investment's „Wczytaj szablon") keeps its snapshot and its
  `KOSZTORYS_TREE_TAGS` revalidation. The investment editor reads those.
- The empty szablon missing from the in-warsztat „Przełącz" picker (a separate manual-checks
  finding, `use-preset-sections.ts`).
- Stale-tab writes addressed by `{investmentId}` landing in whichever szablon the warsztat now holds.
  That is pre-existing, not made worse here, and covered by the mirror's pointer re-check.
- E2E — stays in **EX-847** (`e2e-backlog`).

## Implementation Approach

1. **Server first.** Make the open a single transaction that the page can call and trust.
2. **Client host.** Put one client component on the page that owns prompt, auto-open and editor,
   rendering the tree the call returns.
3. **Entry points.** Switch every entry point to "navigate with `?open=1`", then delete the old hook
   and the dead DataTable prop.

The command returns the state it produced, so nothing re-queries through the router. That is the
whole performance fix.

Rejected alternative: have `page.tsx` perform the open when `?open=1` is present. That brings back
write-on-render, which `e93977f3` removed: every `router.refresh()` and stale-tree recovery would
re-run a write.

## Critical Implementation Details

**No inline revalidation in the open action.** Any tag touched synchronously inside the action —
including through a Payload hook — sets `x-action-revalidated`. That re-renders the calling route
(`EXPIRE_NEXT` only moves the render into a second GET) and wipes the client prefetch cache.

- The `presets` expiry therefore runs in `after()`.
- First-time provisioning passes `context: { skipRevalidation: true }`.
- `protectedAction` gets no tag list.

**Lock ordering inside the open transaction.** Order: lock the warsztat investment row → read the
pointer → mirror the outgoing szablon → restore → set the pointer → read the tree.

This is the same lock-first order as the mirror and the tree replace, so a concurrent throttled
mirror either runs entirely before (old tree, old pointer) or entirely after (new tree, new pointer).
That makes the "null the pointer first" step (`kosztorys-presets.ts:178-184`) unnecessary. Remove it
along with its comment.

**Host state across server renders.** The host renders `serverTree ?? actionTree`, and the editor
must keep the same element position when the source switches. Otherwise the restore latch and
stale-tree recovery silently stop reseeding.

The host must also drop `actionTree` when a **new** server render arrives with no tree, meaning
someone else took the warsztat. Use React's "adjust state when a prop changes" pattern, keyed on the
server prop's identity. Without this a stale editor keeps showing, where today the prompt would.

**Auto-open fires once.** In dev, StrictMode runs the mount effect twice. Guard with a ref latch; the
server's idempotent short-circuit makes a second call harmless anyway.

Strip the flag with `window.history.replaceState` after the call resolves, never with
`router.replace`, which re-renders `page.tsx`.

**„Przełącz" and the mirror flush.** Navigating `/szablony/A` → `/szablony/B?open=1` unmounts A's
editor, and `useWorkshopMirrorFlush` dispatches its unmount flush first. Server actions are serialized
in the client action queue, so B's open runs after it. The open transaction's own eviction mirror
covers the case where it doesn't.

## Phase 1: Atomic, idempotent open on the server

### Overview

Rewrite the open as one `repeatable read` transaction that returns `{ investmentId, tree }` and
revalidates nothing inline. Stop the mirror from bumping `updated_at` when content is unchanged.

### Changes Required:

#### 1. Retry loop shared with the tree replace

**File**: `src/lib/kosztorys/replace-tree-with-snapshot.ts` (+ a new sibling if extracted)

**Intent**: Both the tree replace and the new open need "retry a `repeatable read` transaction on
`isConcurrentWrite`, bounded, then throw the readable message". Extract the loop so the open reuses
it rather than copying it.

**Contract**: `retryOnConcurrentWrite<T>(attempt: () => Promise<T>): Promise<T>` — `MAX_ATTEMPTS`,
the `REPLACE_FAILED` message and the `TODO(EX-449)` log move with it. `replaceTreeWithSnapshot`'s
behaviour is unchanged.

#### 2. Mirror body usable inside a caller's transaction

**File**: `src/lib/actions/mirror-workshop-preset.ts`

**Intent**: Split the transaction body (lock → pointer re-check → serialize → write) into a function
that takes an existing `req`/`db`. `mirrorWorkshopPreset` keeps its public behaviour (own
transaction, never throws, deferred `presets` expiry when written); the open calls the inner function
inside its own transaction.

**Contract**: the inner function returns whether it wrote. It does **not** swallow errors — only the
outer `mirrorWorkshopPreset` does — so a failed eviction mirror rolls the whole open back instead of
destroying the outgoing szablon's last edits.

#### 3. No `updated_at` bump on unchanged content

**File**: `src/lib/db/presets.ts` (`updatePresetPayload`)

**Intent**: Only a content change moves `updated_at`. `mirrored_at` still always moves, because it
is the throttle's clock.

**Contract**: `updated_at` becomes conditional on `payload IS DISTINCT FROM <new>::jsonb` (jsonb
equality ignores key order). The return value means "content changed", so callers expire `presets`
only on a real change.

#### 4. The open transaction

**File**: new `src/lib/kosztorys/open-preset-in-workshop.ts`

**Intent**: The whole of „Otwórz" as one unit, testable without the action wrapper.

**Contract**:
`openPresetInWorkshop(payload, { presetId, takenBy? }): Promise<{ investmentId: number; tree: KosztorysTreeT; wrote: boolean } | null>`
(`null` = szablon not found; nothing written). Steps:

1. Resolve the warsztat investment, provisioning it on first use with
   `context: { skipRevalidation: true }`.
2. Inside `retryOnConcurrentWrite` → `withPayloadTransaction(..., { skipRevalidation: true }, { isolationLevel: 'repeatable read' })`,
   do the following in order:
   1. lock the warsztat row;
   2. read the pointer;
   3. **if it already names `presetId`, return the tree unchanged** (`wrote: false`);
   4. otherwise, if it names another szablon, run the inner mirror for that one;
   5. `getPreset`, returning `null` if it is missing;
   6. `restoreKosztorys(..., { clearGlobalDiscount: true })` — **no snapshot**;
   7. `setWorkshopPreset`;
   8. `buildKosztorysTree(investmentId, req)`.

`resolveWorkshopInvestment` (`src/lib/actions/provision-workshop.ts`) gains the `skipRevalidation`
context on its `payload.create`.

#### 5. The action

**File**: `src/lib/actions/kosztorys-presets.ts` (`openPresetInWorkshopAction`)

**Intent**: A thin wrapper — validate, call `openPresetInWorkshop`, and on a write or a mirrored
eviction schedule the `presets` expiry after the response.

**Contract**: returns `ActionResultT<{ investmentId: number; tree: KosztorysTreeT }>`. Passes **no**
tags to `protectedAction`. The failure message for a missing szablon stays „Nie znaleziono szablonu".
`reloadInvestmentFromPreset` and `reloadFromPresetAction` are untouched.

#### 6. After-response expiry helper

**File**: `src/lib/cache/revalidate.ts` (+ `src/__tests__/stubs/cache-revalidate.ts`)

**Intent**: One named way to expire collection tags without the calling route learning of it.
Correct the `deferRefresh` comment (`:24-28`), which claims `EXPIRE_NEXT` leaves the current route
alone. It only moves the render into a second request.

**Contract**: `expireCollectionsAfterResponse(slugs)` = `after(() => revalidateTag(tag, EXPIRE_NOW))`
per slug. The shared test stub gains the same export (AGENTS.md: the shared stub, not a hand-rolled
factory).

#### 7. Integration tests

**File**: `src/__tests__/lib/actions/kosztorys-presets.test.ts`

**Intent**: Assert persisted state for every rule above, and replace the two tests that encode the
old behaviour: „przełączenie … zostawia punkt ochronny" and „opuszcza wskaźnik, zanim drzewo ruszy".
`next/server`'s `after` is mocked to run its callback, because it throws outside a request scope.

**Contract**, one case each:

- the returned tree equals a fresh read and the pointer names the szablon;
- a re-open of the held szablon writes nothing: no tree rows replaced, no snapshot, the preset's
  `updated_at` unchanged;
- a switch mirrors the outgoing szablon's last edit into the library;
- a switch whose outgoing content is unchanged leaves that szablon's `updated_at` alone;
- a switch writes no snapshot row;
- two concurrent opens of different szablony end with the pointer's szablon content equal to the
  warsztat tree;
- a failed restore (the existing broken-preset fixture) leaves the pointer, the tree and the outgoing
  szablon exactly as they were — the rollback is now whole;
- the action returns `{ investmentId, tree }` and calls no synchronous revalidation (the shared stub's
  spies stay untouched until `after` runs).

### Success Criteria:

#### Automated Verification:

- Preset action integration spec passes: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-presets.test.ts`
- Mirror specs still pass: `pnpm exec vitest run src/__tests__/lib/actions/mirror-workshop-preset.test.ts`
- Tree-replace specs still pass after the retry extraction: `pnpm exec vitest run src/__tests__/lib/kosztorys/replace-tree-concurrent.test.ts src/__tests__/lib/kosztorys/replace-tree-lost-write.test.ts`

#### Manual Verification:

- Opening another szablon and coming back to the first shows its last edits (the eviction mirror still lands)
- The szablon list order doesn't change after merely opening and leaving a szablon without editing it

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Warsztat host on `/szablony/[id]`

### Overview

The page always renders one client component that owns all three states (prompt, auto-opening,
editor) and renders the editor from whichever tree it has.

### Changes Required:

#### 1. Host component

**File**: new `src/components/presets/template-workshop.tsx`

**Intent**: Replace the page's prompt/editor fork and `useOpenPreset` with one component.

**Contract**: props `presetId`, `presetName`, `workCatalogue`, `server: { investmentId; tree } | undefined`,
`autoOpen: boolean`. Behaviour:

- Tree available (`server?.tree ?? opened?.tree`) → `KosztorysEditorV2` with the same zeroed
  financial props the page passes today, `templatePresetId`, and `investmentName = presetName`.
- `autoOpen` and no tree → `PageWrapper title={presetName}` + loader. A ref-latched effect calls
  `openPresetInWorkshopAction` once, stores the result, and strips `?open=1` via
  `history.replaceState`.
- No tree and not opening, or an open that failed → `OpenWorkshopPrompt`, whose button calls the same
  in-place open. A failure also toasts.

`opened` resets when a new `server` prop arrives (see Critical Implementation Details). If a tree is
present on first render and the URL still carries `?open=1`, the flag is stripped too.

#### 2. Prompt becomes presentational

**File**: `src/components/presets/open-workshop-prompt.tsx`

**Intent**: It no longer owns the open; it takes `onOpen` and `pending` from the host.

**Contract**: props `{ name, pending, onOpen }`; copy unchanged.

#### 3. Page

**File**: `src/app/(frontend)/szablony/[id]/page.tsx`

**Intent**: Read-only as before. Read `searchParams.open`, fetch `getWorkCatalogue()` on both
branches (cached), fetch `getKosztorysTree` only when the warsztat holds this szablon, and render
the host in every case.

**Contract**: the `open` flag name is a shared constant with the href builder from Phase 3. The page
still writes nothing.

#### 4. DOM spec

**File**: new `src/__tests__/components/presets/template-workshop.test.tsx`

**Intent**: Lock the lifecycle risks a node spec can't see. `KosztorysEditorV2` is `vi.mock`ed to a
stub that renders its `tree` prop's token; the action is `vi.mock`ed explicitly.

**Contract**, one case each:

- auto-open calls the action exactly once under `<StrictMode>`, then renders the editor with the
  returned tree;
- `replaceState` strips `open`;
- a failed open shows the prompt, and its button retries;
- the prompt without `autoOpen` doesn't call the action until clicked;
- a server tree arriving after an action tree wins;
- a new server render with no tree after an open returns to the prompt.

### Success Criteria:

#### Automated Verification:

- Host DOM spec passes: `pnpm exec vitest run src/__tests__/components/presets/template-workshop.test.tsx`

#### Manual Verification:

- `/szablony/<id>` typed in the address bar while the warsztat holds another szablon shows the prompt; „Otwórz szablon" swaps in the editor without the URL changing or the page reloading
- Restoring a version in „Wersje" inside the warsztat reseeds the grid (the restore latch still works after an auto-open)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Entry points and cleanup

### Overview

Every way into a szablon becomes "navigate with `?open=1`". The old hook and the dead DataTable prop
go.

### Changes Required:

#### 1. Href builder

**File**: new `src/components/presets/preset-open-href.ts` (beside its consumers)

**Intent**: One place that knows the URL and the flag name.

**Contract**: `presetOpenHref(presetId): string` → `/szablony/<id>?open=1`, plus the flag-name
constant the page and the host read.

#### 2. Listing rows are links

**File**: `src/components/presets/presets-data-table.tsx`

**Intent**: `getRowHref={(row) => presetOpenHref(row.id)}` instead of `onRowClick`. DataTable then
prefetches the shell on hover (`data-table-row.tsx:57`). That is safe because the page writes nothing
and prefetch mounts no client component. The `opacity-50` pending state goes away.

#### 3. Other entries

**Files**: `src/components/presets/create-empty-preset-dialog.tsx`,
`src/components/kosztorys/editor/dialogs/reload-from-preset-dialog.tsx`

**Intent**:

- „Nowy szablon" → after create, `router.push(presetOpenHref(id))`. `createEmptyPresetAction`'s
  `presets` expiry moves to `expireCollectionsAfterResponse`, so the create no longer re-renders
  `/szablony` inside the POST it is about to leave.
- „Przełącz" (workshop branch) → `router.push(presetOpenHref(selected.presetId))`. Update the comment
  at `:90`, which points at `useOpenPreset`.

#### 4. Delete dead code

**Files**: `src/hooks/use-open-preset.ts` (delete); `src/components/tables/data-table/data-table.tsx`,
`data-table-row.tsx`, `virtualized-table-body.tsx` (drop `onRowClick` and the `:4` comment that
justifies it).

**Intent**: Nothing else uses them once the entry points switch. Removal is gated on typecheck, not
grep.

#### 5. Test updates

**File**: `src/__tests__/components/presets/create-empty-preset-dialog.test.tsx`

**Intent**: It mocks the router and the action. Assert a push to `presetOpenHref(id)` instead of the
hook's call sequence.

#### 6. Docs

**Files**: `context/foundation/manual-checks.md`, `context/foundation/lessons.md`

**Intent**:

- manual-checks: close the szablon-autosave item „Po przełączeniu w „Wersje" jest wpis „Przed
  wczytaniem…"" and its 2026-09-23 finding as **obsolete** — the snapshot was orphaned (null pointer
  at insert) and is removed by this change, with the library copy as the restore point. The new
  checks are added by `/10x-implement` from the phase bullets.
- lessons: add one entry — "a command returns the state it produced; revalidating to make the page
  re-query is a forced render plus a prefetch-cache wipe" — only if the existing EX-597 entry doesn't
  already say it; otherwise extend that entry.

### Success Criteria:

#### Automated Verification:

- Create-empty dialog spec passes: `pnpm exec vitest run src/__tests__/components/presets/create-empty-preset-dialog.test.tsx`
- No remaining references: `grep -rn "useOpenPreset\|onRowClick" src` returns nothing

#### Manual Verification:

- Hovering then clicking a szablon row shows the loading shell immediately, then the name + loader, then the editor — no multi-second freeze with the list still on screen
- „Nowy szablon" lands in the empty szablon's editor
- „Przełącz na inny szablon…" inside the warsztat lands in the chosen szablon, and the previous one kept its last edit
- Browser back from a szablon to `/szablony` and clicking the same row again opens without a write (instant editor)

**Implementation Note**: Final phase — `/10x-implement` aggregates the manual bullets into the registry.

---

## Testing Strategy

### Unit / integration:

- Phase 1 DB integration cases: consistency, idempotency, no `updated_at` bump, no snapshot,
  whole rollback, concurrent opens, no inline revalidation.
- Existing mirror and tree-replace specs guard the extractions.

### DOM:

- Phase 2 host spec: StrictMode single call, flag strip, failure → prompt, server tree wins, server
  losing the warsztat → prompt.

### E2E:

- Deferred to **EX-847** (`e2e-backlog`, project „Wykonczymy") — the full click → editor path.

### Manual Testing Steps:

1. `/szablony` → hover a row → click: shell at once, editor after one request (DevTools Network: one
   action POST, no RSC GET for `/szablony/<id>` after it).
2. Open szablon B, edit a cell, open A from the list, come back to B: the edit is there.
3. Open A twice in a row from the list: the second time no POST writes (the list order is unchanged).
4. Typed URL for a szablon not in the warsztat → prompt → „Otwórz szablon" → editor, URL unchanged.

## Performance Considerations

- The click → editor path goes from three server renders plus a cold navigation to one prefetched
  shell, one light page render (warsztat pointer read + cached catalogue) and one ~100 ms action.
- The eviction mirror now serializes the outgoing szablon inside the swap transaction: a few tens of
  ms on a 310-item szablon, held under the warsztat lock.

## Migration Notes

None — no schema change. Existing orphaned „Przed wczytaniem" snapshots (`template_preset_id IS NULL`
on the warsztat investment) are left to the snapshot GC's age ceiling.

## Whole-tree Gate

Run once, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit + DOM suite passes: `pnpm test`
- DB integration suite passes: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-09-28-szablon-open-speed/research.md`
- Sibling change: `context/changes/2026-09-28-instant-page-shell/change.md`
- `src/lib/actions/kosztorys-presets.ts:159-202`, `src/lib/actions/mirror-workshop-preset.ts`,
  `src/lib/kosztorys/replace-tree-with-snapshot.ts`, `src/lib/db/presets.ts:85-119`,
  `src/lib/db/snapshots.ts:45-101`, `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:27-80`
- History: `e93977f3` (read-only page + prompt + hook), `5d5145b0` (`onRowClick`), `7e9714ec` (autosave/mirror)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Atomic, idempotent open on the server

#### Automated

- [x] 1.1 Preset action integration spec passes — db6cf1f8
- [x] 1.2 Mirror specs still pass — db6cf1f8
- [x] 1.3 Tree-replace specs still pass after the retry extraction — db6cf1f8

### Phase 2: Warsztat host on `/szablony/[id]`

#### Automated

- [ ] 2.1 Host DOM spec passes

### Phase 3: Entry points and cleanup

#### Automated

- [ ] 3.1 Create-empty dialog spec passes
- [ ] 3.2 No remaining references to `useOpenPreset` / `onRowClick`
