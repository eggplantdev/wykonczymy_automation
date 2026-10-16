---
change_id: filters-tick-to-show
title: Filters tick what you want to see — faceted „Filtry" across the app
status: implementing
created: 2026-10-16
updated: 2026-10-16
archived_at: null
branch: filters-tick-to-show
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/filters-tick-to-show
---

## Notes

— flip every „Filtry" menu (kosztorys editor, szablon, work catalogue, users, and the option-list filters) from "untick to hide" to faceted "tick what you want to see": nothing ticked = everything, OR within a group, AND across groups. Split „Przedmiar i wykonana praca" into separate facets. Must keep every filter combination that works today reachable.

Reverses the EX-665 grammar (`c6c32570d`, 2026-08-14: „ptaszek znaczy widoczne", untick hides) — owner
ruling 2026-10-16: unticking to narrow is misleading.

Equivalence condition for "no filter lost": every group must be an exhaustive, mutually exclusive
partition of the rows it applies to. Then "untick S in a group" today == "tick the rest of the group"
tomorrow, and AND across groups is unchanged. Only the useless "untick both halves → empty grid" state
disappears. Groups that mix two crew planes (rate source, rate ceiling) must split per plane, or the
OR inside the group would widen today's AND across planes.
