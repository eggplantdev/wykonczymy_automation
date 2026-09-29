---
change_id: kosz-inwestycji-manager
title: Investment trash — open to the manager
status: archived
created: 2026-09-29
updated: 2026-09-29
archived_at: 2026-09-29T08:27:49Z
branch: staging
worktree: null
---

## Notes

Reverses the role line of `kosz-inwestycji` (`context/archive/2026-09-24-kosz-inwestycji/change.md:22`,
„Owner and admin only. A manager neither deletes nor restores.").

## Decisions (2026-09-29)

- **Variant B — full parity.** A manager moves an investment to the trash, restores it, deletes it
  forever and sees `/kosz` exactly as the owner does. Every other rule of the trash is unchanged
  (transactions block, never a szablon, typed name for a used kosztorys, 30-day purge).
- **Accepted risk: a manager can hard-delete a used kosztorys.** Recovery in the worst case is the
  hourly prod dump, restored by hand. Considered and rejected: variant A (manager trashes only) —
  the manager could not undo their own mistake, and the purge would still delete it after 30 days.
- **REST `PATCH trashedAt` left open** (`collections/investments.ts`) — dismissed at the original
  gate, and under full parity it grants a manager nothing the app withholds.
- **No manager E2E** — the harness has no MANAGER user; EX-874 stays the trash's E2E backlog. The
  role rule is pinned at the action layer instead: the DB spec mocks the session, not `requireAuth`,
  so the real gate runs for MANAGER and EMPLOYEE.
