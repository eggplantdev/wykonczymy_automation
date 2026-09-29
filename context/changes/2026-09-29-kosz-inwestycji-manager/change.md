---
change_id: kosz-inwestycji-manager
title: Investment trash — open to the manager
status: implementing
created: 2026-09-29
updated: 2026-09-29
archived_at: null
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
