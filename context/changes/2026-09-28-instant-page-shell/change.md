---
change_id: instant-page-shell
title: Instant navigation — page title in the prefetched shell, loader only below it
status: new
created: 2026-09-28
updated: 2026-09-28
archived_at: null
branch: null
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
