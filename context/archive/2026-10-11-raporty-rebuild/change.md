---
change_id: raporty-rebuild
title: Rebuild the company-wide reports page (/raporty) on the current financial model
status: archived
created: 2026-10-11
updated: 2026-10-12
archived_at: 2026-10-12T18:28:01Z
branch: null
worktree: null
---

## Notes

`/raporty` has been switched off („W budowie”, no menu entry) since 2026-08-19. The plan
recorded there was to restore the old version from git and add the materials-net discount. Since then
the model has moved on: robocizna and rabat come from the kosztorys (v1/v2), and strata and premia
were added. This change decides whether to restore and patch the page or rebuild it from scratch.

**Decision (user, 2026-10-11): remove, don't rebuild — for now.** Route, loading shell and
`PAGE_TITLES.reports` deleted. The 8 blocked manual checks were moved to the Pulpit (`/`). The
two `/raporty`-only boxes were dropped. The page's tracking issues were canceled, and `/raporty` is no
longer counted as a v1 surface. If a company report comes back, it is Option A or B in
`research.md`: Σ over the investments-listing rows, never one pooled `deriveFinancials`.
