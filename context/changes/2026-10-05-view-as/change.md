---
change_id: view-as
title: Read-only "view as" for ADMIN/OWNER to see the app as any manager or worker
status: new
created: 2026-10-05
updated: 2026-10-05
archived_at: null
branch: null
worktree: null
---

## Notes

Linear: EX-986

ADMIN/OWNER can view the app as any MANAGER or EMPLOYEE (read-only impersonation via signed view-as cookie resolved in getCurrentUserJwt; protectedAction refuses writes while active; banner + switcher)

Decisions (2026-10-05, owner):

- **Read-only.** Every write is refused while viewing as someone — no audit/`createdBy` rework, nothing can be booked in the target's name.
- **Targets: MANAGER and EMPLOYEE only.** ADMIN/OWNER see the same app, so viewing as them adds nothing.
- **Mechanism: a second signed cookie on top of the real session**, not a minted Payload token for the target — the real login stays intact, so leaving is deleting one cookie, and the actor is always known.

Pitfalls to cover in the plan: the cookie is re-verified every request against the REAL token's role (a leftover cookie under a MANAGER login must do nothing); a trashed/inactive target is refused; switching must refresh the router cache; check no `unstable_cache` entry is keyed by role while its content is per-user.
