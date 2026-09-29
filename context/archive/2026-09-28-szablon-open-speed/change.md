---
change_id: szablon-open-speed
title: Klik w szablon nawiguje natychmiast — „Otwórz" dzieje się na stronie docelowej
status: archived
created: 2026-09-28
updated: 2026-09-28
archived_at: 2026-09-28T18:18:49Z
branch: szablon-open-speed
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/szablon-open-speed
---

## Notes

Linear: **EX-876** (E2E → EX-847).

**Reframed 2026-09-28 (owner):** navigation must be instant, so the order flips — click on a listing
row → immediate navigation to `/szablony/[id]` (name + loader) → „Otwórz" runs ON that page, not
before navigating. Keep `e93977f3`'s guard: auto-open only when arriving from the listing (e.g. a URL
flag stripped after opening); a stale tab / typed URL still gets `OpenWorkshopPrompt`. Target: one
round trip instead of three. Constraint (lessons.md, EX-597): a server action that invalidates ANY
tag forces a route render — dropping `KOSZTORYS_TREE_TAGS` alone doesn't remove it, the mirror's
`presets` revalidation still fires. App-wide „title in the shell, loader below" is a separate change:
`instant-page-shell`.

Original intent — szybsze otwieranie szablonu z listingu: usunąć zbędny updateTag (KOSZTORYS_TREE_TAGS) z openPresetInWorkshopAction, loader od razu po kliknięciu, prefetch /szablony/[id] na hoverze wiersza, router.refresh tylko w OpenWorkshopPrompt.

Evidence (2026-09-28, local DB, 310-item szablon): the whole server-side work of „Otwórz" is
~100 ms — mirror 13–29 ms, tree replace 64–86 ms, tree read 4–6 ms, catalogue 3–7 ms, listing
queries ~6 ms. The multi-second freeze is the client sequence in `src/hooks/use-open-preset.ts`:
awaited action (only feedback: `opacity-50` on the row) → `updateTag` on 5 tags re-renders
`/szablony` inside the action response and clears the client router cache → `router.push` to a
never-prefetched `/szablony/[id]` (loader shows only once the server streams) → `router.refresh()`
= a third full render of the editor.

No cached reader of `KOSZTORYS_TREE_TAGS` shows the workshop tree: listing aggregates
(`balances.ts`), client preview (`preview-kosztorys.ts`), `reference-data.ts` (filters
`status <> 'szablon'`), `leads.ts`; `getKosztorysTree` itself is uncached. The mirror's deferred
`presets` revalidation stays — the pickers read it.

Catch: on the `OpenWorkshopPrompt` entry the URL doesn't change, and today it's the incidental
`updateTag` re-render that swaps the prompt for the editor — without tags that entry needs its own
`router.refresh()`. The row prefetch is safe since `e93977f3`: `/szablony/[id]` no longer writes on
render.

Out of scope unless measured: `/szablony` listing slowness — nothing slow server-side; confirm in
the browser before touching it.
