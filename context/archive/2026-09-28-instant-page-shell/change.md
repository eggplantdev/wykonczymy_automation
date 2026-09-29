---
change_id: instant-page-shell
title: Instant navigation — page title in the prefetched shell, loader only below it
status: archived
created: 2026-09-28
updated: 2026-09-29
archived_at: 2026-09-29T05:21:18Z
branch: instant-page-shell
worktree: null
---

## Notes

Linear: **EX-877**.

Owner (2026-09-28): navigation should be instant — the page name visible right away, the loader only
in the suspended part below it. App-wide pattern, split out of `szablon-open-speed`.

Starting point: every `(frontend)/**/loading.tsx` re-exports `PageLoading` (a bare centred 🚧), so
nothing of the page shows until the server answers; `<Suspense>` appears only in
`(frontend)/layout.tsx` and `inwestycje/[id]/page.tsx`.

Constraint that shapes it: `cacheComponents`/PPR is off (Vercel bug), so a dynamic route's prefetch
carries only layouts + `loading.tsx`. What is instant is exactly what lives in `loading.tsx` — not
whatever a page renders before its own `<Suspense>`. Hence:

- static titles („Szablony kosztorysów", „Inwestycje", …) → `loading.tsx` renders
  `PageWrapper title=…` + a loader in the content slot;
- dynamic titles on `[id]` routes (investment / szablon name) can't be in the prefetched shell —
  open question: the existing `@investmentCrumb` top-bar name, a name handed over from the clicked
  row on the client, or showing it a beat later.

Also check (lessons.md „Link w kontenerze bez pudełka układu…"): a `loading.tsx` only helps when the
link you came from could prefetch — mobile nav links never do.

## Decisions (spike → implemented)

Measured before building it: `spike/results.md` (baseline vs spike, production builds, interleaved,
local + Slow 4G). The title lands 21–73 ms after the click on every list route against 73–743 ms
before; time to the full page is unchanged.

- **List routes** — `loading.tsx` renders `TitledPageLoading` (the page's `PageWrapper` title, the
  🚧 centred over the content area). The title is one constant, `PAGE_TITLES` in
  `lib/constants/sections.ts`, read by the nav link, the page heading and the `loading.tsx`: the
  fallback's title is replaced by the heading when the page lands, so two spellings would flicker.
  `katalog-prac` and `kosz` gained a `loading.tsx`. The dashboard sits in a `(dashboard)` route
  group with its own titled `loading.tsx`, so `(frontend)/loading.tsx` — the fallback every segment
  without one inherits — stays untitled, so a new route never flashes „Transakcje".
- **Detail routes** (`inwestycje/[id]`, `kasa/[id]`, `pracownicy/[id]`, `sprzet/[id]`, `flota/[id]`)
  — `DetailPageLoading`: a bar the heading's height, no name. The name only arrives with the page;
  the open question from Notes is closed as „show it a beat later".
- **Editor routes** (`szablony/[id]`, `inwestycje/[id]/kosztorys`, `…/kosztorys_v2`) keep the bare
  `PageLoading`: they render the editor, not a `PageWrapper`, so there is no title to show early.
- **Mobile nav** — no change. The „never prefetches" premise was wrong for the drawer (lessons.md
  entry corrected); a mount-time `router.prefetch` was measured as redundant and dropped.
- **Not done:** moving page fetches into `<Suspense>` below the title. With PPR off it gains earlier
  page chrome, not an earlier title — the title comes from `loading.tsx` either way.
