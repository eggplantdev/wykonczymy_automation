---
change_id: kosztorys-sort-scope-and-bake
title: Sort scope in the column menu + persisting the order of the whole kosztorys
status: archived
created: 2026-08-13
updated: 2026-08-13
archived_at: 2026-08-13T18:10:00Z
branch: konradantonik/ex-682-sort-within-sections
worktree: null
---

## Notes

Builds on EX-682/EX-683, which had made sorting within-section only; this change restores global
sorting as a deliberate, named mode next to it (EX-688).

### Decisions (2026-08-13)

- **Column menu: four sort items + „Wyczyść sortowanie".** Scope is in the label (today „Sortuj
  rosnąco zachowując sekcje" / „Sortuj rosnąco"). No submenu and no separate mode toggle — direction
  and scope are picked in one gesture.
- **Nothing about the sort itself is persisted** — not in localStorage, not in the DB. Sorting stays
  a lens; the only durable order is `display_order`.
- **Why not store the sort rule:** a stored rule is live and overrides positions — after a ▲/▼ move
  and a reload the row snaps back because the rule re-sorts it. Two sources of truth for order. We
  save the result (`display_order`), not the rule.
- ▲▼ and insert stay disabled under any sort.

### Correction 1 — persisting moved to the column header

„Zapisz kolejność" (save order) moved **from the row menu to the column header menu** — where the
sorting happens — as one command covering all sections at once. Owner's reason: a single section
can't be sorted in isolation. The within-section mode orders **every** section and the global mode
mixes them all, so a save hooked to one section saved a slice of something that could never be
invoked alone; the row menu also implied the row had something to do with it. This dropped the
single-section server action (EX-683) and its spec. The validation schema rejects repeated ids but
**not** repeated indexes, because each section numbers from zero.

### Correction 2 — save always enabled

„Zapisz kolejność" is **enabled under every sort, including global** (earlier: greyed out). The
greying rested on a wrong assumption: the save plan renumbers **each section separately by the same
sort key**, so a global sort saves byte-for-byte the same as a within-section one. Scope changes what
is on screen, never what reaches the DB. Only cost: after clearing a global sort the interleaving
doesn't come back — rows return under their sections (owner: "we can always sort by sections
again"). The lock-explaining tooltips (`sort-lock-hints`) went with it.
