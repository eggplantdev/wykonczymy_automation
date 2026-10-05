---
date: 2026-10-05T14:11:29+02:00
researcher: Claude (Opus 5.5)
git_commit: 49d1916e0b129548635be1a56e227a53730a8d4c
branch: staging
repository: wykonczymy
topic: "EX-989 — a worker changes their own e-mail and password from their page"
tags: [research, codebase, auth, users, access, payload-auth, worker-page]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (Opus 5.5)
---

# Research: EX-989 — a worker changes their own e-mail and password

## Research Question

What does it take for the logged-in owner of an account to change their own e-mail and password on
`/pracownicy/[id]`, with the current password required, no e-mail confirmation, and a gate outside
`protectedAction` (owner decisions, `change.md`)? What already exists, what Payload does under the
hood, and what is unsafe today?

## Summary

- **The capability already exists, unguarded, over REST.** `canUpdateUser` returns `user.id === id`
  for an EMPLOYEE (`src/access/index.ts:50`), and `email`/`password` carry no field access, so a
  worker can `PATCH /api/users/<own id>` and change both **without the old password**. Nobody
  intended it: the self branch was copied from `isAdminOrOwnerOrSelf` in `5ed25d5d` ("allow managers
  to edit users") with no rationale, and nothing in `src` relies on it. EX-985's change.md claims
  "REST Payloada już zamknięte" but only checked `read`.
- **The self branch is reachable only by EMPLOYEE** — MANAGER returns `{ role: EMPLOYEE }` before it,
  ADMIN/OWNER return `true`. Dropping it closes the hole and touches no other role.
- **Payload never asks for the old password** on `update` (Local or REST). Verifying it is ours.
  `authenticateLocalStrategy` is not importable; the two options are `payload.login` (Local API:
  lockout after 5 misses, writes one orphan session row) or a hand-rolled pbkdf2 compare (no side
  effects, no lockout, copies Payload's hashing parameters).
- **A password change via `payload.update` keeps every session** (the merged doc re-saves the
  sessions array). That matches the EX-985/EX-918 stance: auth reads no DB, a changed password stops
  new logins only.
- **Duplicate e-mail** is enforced by the DB only and surfaces as `ValidationError` 400,
  `path: 'email'`. The app already pre-checks with `emailClash` (`src/lib/actions/workers.ts:9-28`),
  but its wording is management-speak (it points at the Kosz) and it is not exported.
- **UI template**: `RequestReviewDialog` + `FormDialog` + `useManagedForm({ persistDraft: false })`.
  `persistDraft: false` is mandatory here — form stores otherwise write to `sessionStorage`, and a
  password must never land there.

## Detailed Findings

### Access and the REST hole

- `canUpdateUser` (`src/access/index.ts:47-51`): ADMIN/OWNER → `true`; MANAGER →
  `{ role: { equals: 'EMPLOYEE' } }`; anyone else → `user?.id === id`. REST parses the id to a number
  (`payload/dist/utilities/getRequestEntity.js:33-40`), so the comparison matches for the owner.
- Field access on `users` covers only `role`, `active` (`isAdminOrOwnerField`) and `trashedAt`
  (closed) — `src/collections/users.ts:79-82, 98-101, 108-115`. Open to a self-PATCH today: `email`,
  `password`, `name`, `language`, `defaultCashRegister` (the last still passes `guardDefaultRegister`).
- `password` cannot be closed with field access — it is not a field; Payload captures
  `data.password` at `collections/operations/utilities/update.js:26` before hooks. `email` could be
  (a same-named field deep-merges over the built-in one, `fields/mergeBaseFields.js:10-27`), but the
  collection-level fix is simpler and covers both.
- EMPLOYEE has no `/admin` (`users.ts:55`, `isAdminOrOwnerOrManagerBoolean`), so closing the self
  branch cannot break a "my account" flow. No spec or e2e PATCHes `/api/users`; every app write is
  Local API with `overrideAccess` defaulting to `true` (`collections/operations/local/update.js:7`).
- Precedent for closing REST on the same reasoning: `trashedAt` is closed because "a REST PATCH would
  skip the use check, the kasy and the session purge" (`users.ts:108-109`); `guardAccountRemoval`
  sits in a hook "because /admin and REST delete users too".

### Payload auth mechanics (3.73.0, `node_modules/payload/dist/`)

- **Hashing on update**: `update.js:230-239` → `generatePasswordSaltHash` (pbkdf2, sha256, 25000
  iterations, 512 bytes, 32-byte salt — `auth/strategies/local/generatePasswordSaltHash.js:8,38-41`).
  Only validation: min 3 chars (`fields/validations.js:57-79`).
- **Sessions**: `useSessions` on by default (`collections/config/defaults.js:142`). A password update
  neither adds nor removes sessions; `loginAttempts`, `lockUntil`, `resetPasswordToken` survive too.
- **E-mail**: built-in field is `unique`, validated, and lowercased + trimmed in a `beforeChange` hook
  (`auth/baseFields/email.js:10-22`); login normalises the same way (`auth/operations/login.js:48`).
  Duplicate → Postgres 23505 → `ValidationError` 400, `errors: [{ path: 'email' }]`
  (`@payloadcms/drizzle/dist/upsertRow/handleUpsertError.js:12-58`).
- **`payload.login` (Local API)** as a verifier: wrong password increments `loginAttempts`
  (`login.js:167-181`), 5 misses lock for 10 min (`defaults.js:24,26`), a locked account is refused
  even with the right password (`login.js:25`), success writes a session row (`login.js:221`) and
  resets attempts, runs `beforeLogin` (`refuseDisabledLogin`), skips trashed users (`login.js:144`).
- **pbkdf2 compare** as a verifier: read with `showHiddenFields: true` (`hash`/`salt` are hidden,
  `auth/baseFields/auth.js:13-20`), `crypto.pbkdf2(pw, salt, 25000, 512, 'sha256')` +
  `timingSafeEqual`. No side effects; no lockout.
- **JWT after an e-mail change**: the token holds `id`, `collection`, `email`, `sid` + `saveToJWT`
  `name`/`role` (`auth/getFieldsToSign.js:102-109`). Nothing re-issues the cookie on update.
  `getCurrentUserJwt` returns the stale `email` (`src/lib/auth/get-current-user-jwt.ts:42`), but
  nothing in `src` reads `session.user.email` (only a commented line, `sidebar.tsx:30`). REST/`/admin`
  reload the user by id and are unaffected.

### Action layer

- No wrapper for "any logged-in role". `protectedAction` hard-wires `requireAuth(MANAGEMENT_ROLES)`
  (`src/lib/actions/run-action.ts:84`). In-flight precedent `sendExpenseDraftAction`
  (`src/lib/actions/worker-expense-drafts.ts:31-64`, uncommitted, EX worker-expenses): `validateAction`
  → `requireAuth(ROLES)` → `workerId = session.user.id` → `runAuthorizedHandler(label, handler)`.
- `setDefaultCashRegisterAction` (`src/lib/actions/user-preferences.ts:12-28`) takes the id from the
  session but sits behind `protectedAction`, so it is management-only despite its comment.
- `emailClash` (`src/lib/actions/workers.ts:9-28`) — trash-aware sentence for managers ("…jest w
  Koszu — przywróć go stamtąd"). For a worker that wording is wrong (and tells them a trashed account
  holds the address); the query is reusable, the message is not.
- E-mail normalisation already exists: `workerSchema.email` = `trim().toLowerCase()` piped into
  `z.email('Nieprawidłowy adres email')` (`src/components/forms/worker-form/worker-schema.ts:23-28`).
- No Zod password schema. The reset form checks by hand (`src/app/(auth)/…/reset-password-form.tsx:25-35`):
  „Hasła nie są takie same." / „Hasło musi mieć co najmniej 6 znaków."
- Manager-side form sets no password; `createWorkerAction` writes a random UUID (`workers.ts:44`).

### Worker page and UI

- `src/app/(frontend)/pracownicy/[id]/page.tsx`: `isManager` (`:30`), `canViewWorkerPage` (`:33`),
  `EditWorkerDialog` only for managers (`:76`). The in-flight self gate is
  `canSend={currentUser.id === userId}` (`:84`). E-mail shown comes from `refData` (`:65`).
- Dialog template: `src/components/dialogs/request-review-dialog.tsx:13-35` +
  `request-review-form.tsx:19-57` — `FormDialog showKeepOpen={false}`, `useManagedForm` with
  `persistDraft: false` (skips the `sessionStorage` write, `use-managed-form.ts:132`, and forces
  `awaitBeforeClose`, `:155`, so the result is awaited; both outcomes go through `toastMessage`,
  `use-form-submit.ts:33-43`). Needs a store entry in `src/stores/form-stores.ts`.
- Phone scope: an EMPLOYEE's own `/pracownicy/[id]` is checked at 390px (EX-985).

### Cache

- `fetchReferenceData` (workers incl. e-mail) is tagged `CACHE_TAGS.users` (`reference-data.ts:186-193`).
  The users `afterChange` hook already fires `revalidateTag('collection:users', EXPIRE_NOW)` on any
  `payload.update` (`users.ts:38`, `hooks/revalidate-collection.ts:25-31`); precedents still pass
  `['users']` to the action wrapper. No `user` entity tag exists (`tags.ts:31`).

### Tests

- No spec covers `canUpdateUser` (`src/__tests__/access-control.test.ts` covers the other helpers).
- DB action spec pattern: `src/__tests__/lib/actions/worker-duplicate-email.db.test.ts` (mocked
  `requireAuth`, shared `cache-revalidate` stub, `skipIf(!ENV_READY)`, prefix cleanup).
  `toggle-active.db.test.ts` covers session rows.
- `test-plan.md` row 22 (`:73`, spec #22 `:98`) — a worker reaching beyond his own scope — is the
  nearest anchor; nothing names account takeover via a credential change.

## Code References

- `src/access/index.ts:47-51` — `canUpdateUser`, the self branch is the REST hole
- `src/collections/users.ts:20-116` — auth config, hooks, field access
- `src/lib/actions/run-action.ts:36-66, 75-94` — `runAuthorizedHandler`, `protectedAction`
- `src/lib/actions/worker-expense-drafts.ts:31-64` — EMPLOYEE write precedent (in flight)
- `src/lib/actions/workers.ts:9-28` — `emailClash`
- `src/lib/actions/auth.ts:13-43` — `loginAction`, `LockedAuth` message to reuse
- `src/components/forms/worker-form/worker-schema.ts:23-28` — normalised e-mail schema
- `src/app/(frontend)/pracownicy/[id]/page.tsx:26-84` — page gating and trigger placement
- `src/components/dialogs/request-review-dialog.tsx`, `src/components/forms/request-review-form/` — dialog template
- `src/lib/db/user-sessions.ts:4-13` — `deleteUserSessions` (ordering rule: after any `payload.update`)

## Architecture Insights

- Three gates, three wrappers: `protectedAction` (management), `ownerOnlyAction` (narrower),
  `tokenAction` (URL token). An "any logged-in, self only" write is now the second hand-rolled
  instance (`sendExpenseDraftAction` is the first). Two instances is the point to consider a
  `selfAction` wrapper — but the expense one is uncommitted, so extracting now couples this change
  to another agent's in-flight file.
- Authorization-by-construction: taking the id from the session (never an argument) makes "someone
  else's account" unrepresentable — no `id === user.id` check to get wrong.

## Historical Context (from prior changes)

- `context/archive/2026-10-05-worker-account/change.md` (EX-985) — login is the e-mail; 24 of 49
  are placeholders; the worker sets a password via „Zapomniane hasło"; a password change does not log
  out an open phone (auth reads no DB); immediate cut-off is „Aktywny" / Kosz. Wrongly states REST is
  closed (checked `read` only).
- EX-918 plan (`git show c8da93ab:context/changes/2026-10-01-kosz-pracownikow/plan.md`) — owner chose
  no per-request DB read; only REST/`/admin` check `sid`.
- `context/changes/2026-10-05-worker-expenses/research.md:66-67` — "inna bramka, ten sam rdzeń" for an
  EMPLOYEE write outside `protectedAction`.

## Related Research

- `context/changes/2026-10-05-worker-expenses/research.md`

## Open Questions

1. **Close the REST self branch inside this change?** Without it, „obecne hasło wymagane" is a polite
   front door beside an open window. Recommended: yes, here — one line plus a spec, EMPLOYEE-only blast
   radius.
2. **Verifier: `payload.login` vs pbkdf2.** `payload.login` reuses Payload's lockout (5 × wrong → 10 min)
   and its own hashing, at the cost of one orphan session row (never handed out, expires in 7 days).
   pbkdf2 has no side effects but no lockout, so a held phone could brute-force the password through
   the action. Recommended: `payload.login`.
3. **Out of scope, surfaced:** `updateWorkerAction` (`workers.ts:54-73`) runs no `canManageAccount`
   check and writes `role` through the Local API (field access bypassed). The manager's worker form
   offers every role (`worker-form.tsx:79-84`). Looks like a MANAGER can edit an OWNER's e-mail or
   promote an account (incl. their own) to OWNER — intent not yet checked in git; not this change.
