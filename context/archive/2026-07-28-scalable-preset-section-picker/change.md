---
change_id: scalable-preset-section-picker
title: „Dodaj sekcję z szablonu" scales past a dozen szablony — two panes, not one long list
status: archived
created: 2026-07-28
updated: 2026-07-28
archived_at: 2026-07-28T14:37:02Z
branch: staging
worktree: null
---

## Notes

The picker was one flat cmdk list: every szablon's sections rendered inline, one `CommandGroup` per
szablon. Readable at two or three szablony; unreadable well before the library reaches the size the
owner expects ("I can easily imagine this going beyond 10 szablony", 2026-07-28). Folding the groups
only delays the wall — with 10+ collapsed groups you are still scrolling a list to find one name.

Target shape, two panes:

- **Left** — the szablony, with their own search. Row = name, section count, and (when some are taken)
  a `3/10` progress figure. That count also answers the partial-selection problem a single tick can't
  express: a half-selected szablon reads honestly as a number, so no tri-state control is needed.
- **Right** — the sections of the highlighted szablon, each tickable, with the per-szablon „Zaznacz
  wszystkie" row (shipped in `7ff77041`) moving here from the flat list.
- **Selection stays cumulative across szablony** — take three from one szablon and two from another,
  confirm once.

**Reversed during planning (owner, 2026-07-28):** the original plan kept a cross-szablon section
search (typing switches the right pane to flat results across every szablon), so as not to lose the
flat list's one strength — finding a section when you don't remember which szablon holds it. It was
dropped: section names repeat across szablony, so the flat results would be a list of identical names,
and a szablon's contents are predictable from its name (owner: „these sections would almost never
change", „the names would be repeated"). The shipped picker searches szablon names only. **If that
assumption proves wrong, the cheap fix is a szablon row that lights up when one of its sections
matches the query** — right pane unchanged, no second search mode. Don't rebuild a cross-szablon flat
results view.

## Kept from the plan (deleted 2026-08-08)

- **cmdk was dropped, not worked around.** It only filters over _mounted_ items; that earned its place
  on one flat list, but with a name-only search and no right-pane search it is pure constraint.
- **Left-pane order stays `created_at DESC`** — the just-saved szablon stays on top, and reordering
  solves nothing a name search doesn't.
- **Both panes always render; below the breakpoint Tailwind classes gated on a `pane` state hide one.**
  Chosen over a `useMediaQuery` hook to match the repo's pure-Tailwind responsive style, and so the
  narrow-screen layout adds classes rather than restructuring the desktop markup.
- Diacritic folding landed in the shared `useSearchFilter`, which six tables use — the fold must only
  ever widen what matches.
