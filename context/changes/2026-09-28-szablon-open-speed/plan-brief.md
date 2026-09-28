# Instant szablon open — Plan Brief

> Full plan: `context/changes/2026-09-28-szablon-open-speed/plan.md`
> Research: `context/changes/2026-09-28-szablon-open-speed/research.md`

## What & Why

Opening a szablon from the list freezes for seconds and shows the loader only at the end. The server
work takes ~100 ms. The freeze is three serialized server renders plus a cold navigation, caused by
the open action revalidating tags and the client refreshing afterwards.

The owner wants the click to navigate at once, with „Otwórz" happening on the target page.

## Starting Point

`useOpenPreset` awaits `openPresetInWorkshopAction`, then pushes and refreshes. The action spans four
commits: mirror, null pointer, replace, set pointer. That creates a race which can write one
szablon's content into another. It also bumps the outgoing szablon's `updated_at` even with no edits,
and leaves an orphaned, invisible „Przed wczytaniem" snapshot.

## Desired End State

A row click shows the prefetched shell immediately, then the name and a loader, then the editor after
one action call that triggers no route re-render. Re-opening the held szablon writes nothing. The
warsztat tree, the pointer and the library copy are always consistent.

A stale tab or a typed URL gets the „Otwórz szablon" prompt, which opens in place.

## Key Decisions Made

| Decision            | Choice                                                                                            | Why                                                                                  | Source          |
| ------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------- |
| Where „Otwórz" runs | On `/szablony/[id]`, after navigating                                                             | Navigation must be instant                                                           | Owner (reframe) |
| Transport           | Server action, no inline revalidation, `presets` expired in `after()`                             | Keeps `protectedAction`; any inline tag forces a render and wipes the prefetch cache | Plan            |
| Auto-open trigger   | `?open=1`, stripped via `history.replaceState`; idempotent server                                 | Survives reload; StrictMode / re-click are harmless                                  | Plan            |
| Result delivery     | Action returns `{ investmentId, tree }`; the host renders it, and a server tree wins when present | One round trip, restore latch intact                                                 | Research        |
| Pointer race        | Mirror + replace + pointer + tree read in one `repeatable read` transaction                       | Can't reach an inconsistent committed state                                          | Plan            |
| `updated_at` bump   | Only on real content change (`IS DISTINCT FROM`)                                                  | Opening shouldn't reorder the library                                                | Plan            |
| Snapshot on switch  | Removed; the library copy is the restore point                                                    | It was orphaned and invisible anyway                                                 | Plan            |
| Failure UX          | Toast + prompt with retry                                                                         | One click to retry, existing component                                               | Plan            |
| Tests               | DB integration + DOM spec; E2E stays in EX-847                                                    | Cheapest layer per risk                                                              | Plan            |

## Scope

**In scope:**

- atomic, idempotent open;
- `updatePresetPayload` no-op bump;
- after-response expiry helper;
- warsztat host component;
- page rewrite;
- listing rows as prefetched links;
- „Nowy szablon" and „Przełącz" navigate with the flag;
- delete `useOpenPreset` and DataTable `onRowClick`;
- manual-checks / lessons updates.

**Out of scope:** app-wide title-in-shell (`instant-page-shell`), `/szablony` listing speed,
`reloadFromPresetAction` for real investments, the empty szablon missing from the „Przełącz" picker,
E2E (EX-847).

## Architecture / Approach

The row is a `Link` to `/szablony/<id>?open=1`, prefetched on hover, so the `loading.tsx` shell is
instant. `page.tsx` (read-only) renders the `TemplateWorkshop` client host with the name, the
catalogue, the server tree (if the warsztat holds this szablon) and `autoOpen`. The host then:

1. calls `openPresetInWorkshopAction` once;
2. renders `KosztorysEditorV2` from `serverTree ?? actionTree`;
3. strips the flag.

The action wraps `openPresetInWorkshop`, one transaction:

1. lock;
2. pointer check (short-circuit if already held);
3. mirror the outgoing szablon;
4. restore;
5. set pointer;
6. read tree.

## Phases at a Glance

| Phase            | What it delivers                                                            | Key risk                                                                    |
| ---------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Atomic open   | One-transaction, idempotent open returning the tree; no inline revalidation | Mirror errors must roll the open back, not be swallowed                     |
| 2. Warsztat host | Prompt / auto-open / editor in one client component                         | Losing the restore latch or showing a stale editor after the warsztat moves |
| 3. Entry points  | Links + prefetch, flag navigation everywhere, dead code gone                | A missed entry still awaiting the action before navigating                  |

**Prerequisites:** local docker DB + `db-test` for the integration spec.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- `after()` + `revalidateTag` inside a server action expires the server cache without setting
  `x-action-revalidated`. This comes from reading the Next 16.1.7 source during research; the Phase 1
  test and the manual Network check confirm it.
- Orphaned historical „Przed wczytaniem" snapshots stay until the GC age ceiling (harmless, invisible).

## Success Criteria (Summary)

- Click → shell at once → editor after one POST, with no freeze on the list.
- Re-opening the held szablon writes nothing, and the list order is untouched by mere opens.
- Switching szablony never mixes their content.
