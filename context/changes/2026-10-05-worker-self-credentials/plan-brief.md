# Plan Brief: worker-self-credentials (EX-989)

**Goal.** The owner of an account changes their own e-mail and/or password on their own
`/pracownicy/[id]`, confirming with the current password.

**Decided.**

- Current password required for both changes, verified with `payload.login`, which gives Payload's
  lockout: 5 wrong attempts lock the account for 10 minutes.
- No e-mail confirmation. A taken address gets „Ten adres e-mail jest już zajęty."
- The action works for any role and only on the user's own account: `requireAuth(ROLES)`, with the id
  taken from the session and never from an argument. It is not a `protectedAction`.
- REST self-update (`canUpdateUser`'s self branch, EMPLOYEE only) is closed in this change.
- The button appears for every account owner on their own page and never on someone else's.
- Other sessions are not revoked, and the JWT is not re-issued.

**Phases.**

1. **Close REST:** `canUpdateUser` gives EMPLOYEE `false`. Covered by its first access spec.
2. **Action:** `changeOwnCredentialsAction`. It reads the stored row, refuses a no-op, then
   `payload.login`, then the e-mail clash check, then `payload.update`. Shared pieces extracted
   alongside it: `findEmailHolder`, `passwordSchema`, `LOCKED_ACCOUNT_MESSAGE`. A DB spec asserts
   persisted state, and a schema spec covers the form rules.
3. **UI and docs:** the dialog (`persistDraft: false`, so passwords never reach `sessionStorage`) and
   its trigger on the user's own page, which must work at 390px. The reset form moves onto
   `passwordSchema`. AGENTS.md (Auth) and a new test-plan risk row are updated.

**Not doing.** E-mail confirmation, session revocation, JWT re-issue, a `selfAction` wrapper, or the
`updateWorkerAction` privilege finding.

**Gate.** `pnpm typecheck`, `pnpm lint` and `pnpm test:integration`. The full suite runs only on request.

Plan: `context/changes/2026-10-05-worker-self-credentials/plan.md`
