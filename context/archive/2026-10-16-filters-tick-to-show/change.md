---
change_id: filters-tick-to-show
title: Filters tick what you want to see — faceted „Filtry" across the app
status: archived
created: 2026-10-16
updated: 2026-10-18
archived_at: 2026-10-18T09:20:00Z
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

Owner feedback 2026-10-16/17 after the four phases: „Komentarz" left „Filtry"; „Puste pozycje" was
dropped, then restored 2026-10-17. It stays its own group on purpose: `isEmptyOnBothAxes` checks both
przedmiary and the executed work, so it is not "bez przedmiaru" AND "bez wykonanej pracy", and its
„z przedmiarem lub wykonaną pracą" is the only way to the union of the Przedmiar and Wykonana praca
groups (ticks across groups AND). Don't delete it as redundant.

Rejected: a „Zaznacz wszystkie" row (ticking everything equals ticking nothing, so option lists get
„Wyczyść"), and migrating saved picks (the old ids mean the opposite, so the storage prefixes were
renamed to `kosztorys-show:` / `szablon-show:` / `work-catalogue-show` and each user resets once).

`FilterMultiSelect.flush` must emit the ticked ids, never `[]`, when every option is ticked — `[]`
means "no filter". „Sekcje" is the one non-filter consumer (tick = rozwinięta); it always passes an
explicit list, and `[]` means „zwiń wszystkie".

Untested: `e2e/equipment-registry.spec.ts` was rewritten to the options-mode flow (tick „Magazyn",
Escape to flush) but never run — run it with the next `/10x-e2e` pass.
