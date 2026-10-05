---
change_id: worker-self-credentials
title: A worker changes their own e-mail and password from their page
status: implementing
created: 2026-10-05
updated: 2026-10-05
archived_at: null
branch: worker-self-credentials
worktree: ../wykonczymy-worktrees/worker-self-credentials
---

## Notes

worker-self-credentials — EX-989: on `/pracownicy/[id]`, the account's owner changes their own e-mail and password. Follow-up to EX-985 (worker account).

Linear: **EX-989**.

### Decided with the owner (2026-10-05)

1. **The current password is required** for both an e-mail and a password change.
2. **No e-mail confirmation.** The e-mail is a login, not necessarily a mailbox (about half the workers' addresses are placeholders). A taken address returns a readable error.
3. **The gate sits outside `protectedAction`.** `requireAuth(ROLES)`, with the account id taken from the session, never from an argument. `MANAGEMENT_ROLES` is unchanged.

4. **The REST self-update path is closed in this change.** `canUpdateUser` stops returning `true` for an EMPLOYEE on their own id.
5. **Other sessions are not revoked** on a password change, because `getCurrentUserJwt` reads no DB. Same stance as EX-918.
6. **`payload.login` verifies the current password**, so Payload's lockout applies. The button is offered to every account owner on their own page.
