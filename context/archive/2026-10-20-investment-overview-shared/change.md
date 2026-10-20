---
change_id: investment-overview-shared
title: One shared investment overview for the investment page and the kosztorys tab
status: archived
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20T15:30:48Z
branch: investment-overview-shared
worktree: ../wykonczymy-worktrees/investment-overview-shared
---

## Notes

One `InvestmentOverview` client component rendered by both `/inwestycje/[id]` and the kosztorys
„Inwestycja" tab: buttons, info list with editable Status / Etap AI / Kierownik budowy, notes, AI notes,
files. The Kosztorys_v2 button is page-only. Read-only for a trashed investment.

Zamów in both views. The reference data is already fetched in the `(frontend)` layout by `Navigation`
(`fetchReferenceData`, the heaviest fetch in the app, run on every management page) and handed only to
`TopNav`. Hoist it into a client context provider in `AuthenticatedShell` so `OrderButton` / `TopNav`
read it through a hook.

Must not slow anything down, and the layout runs on every page: research + a before/after baseline of
the layout, investment page and `kosztorys_v2` page timings and RSC payload size. Key risk: awaiting it
in `AuthenticatedShell` above `children` would serialize the page fetches behind it, so pass the
promise (like `unreadCounts`) instead. Order settings: provider or the `kosztorys_v2` page (decided: same provider).

Open, owner's call pending: layout-provided reference data and order settings don't re-render on soft
navigation, so another manager's new investment / worker / kasa / supplier reaches the AddSheet and
„Zamów” pickers only after a reload or the viewer's own revalidating action. Accept, or refetch on
dialog open.

Open, owner's call pending: „Zdjęcia i pliki” stays writable for an investment in the Kosz
(`addInvestmentAssetsAction` has no trashed check) — predates the slice, contradicts the overview's
read-only contract.
