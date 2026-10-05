# Worker Self-Credentials Implementation Plan

## Overview

The logged-in owner of an account changes their own e-mail and/or password from their own
`/pracownicy/[id]` page, confirming with the current password (EX-989). The same change closes the
unguarded REST path through which an EMPLOYEE can already do this today without the old password.

## Current State Analysis

- `canUpdateUser` (`src/access/index.ts:47-51`) returns `user?.id === id` for every role below
  MANAGER, i.e. EMPLOYEE only. `email` / `password` have no field access, so
  `PATCH /api/users/<own id>` changes both with no old password. Unintended (copied from
  `isAdminOrOwnerOrSelf` in `5ed25d5d`), unused by the app (every write is Local API), uncovered by
  any spec.
- No action lets a non-management user write their own account. `protectedAction` is
  management-only (`src/lib/actions/run-action.ts:84`); the in-flight `sendExpenseDraftAction`
  (`src/lib/actions/worker-expense-drafts.ts:31-64`) hand-rolls `requireAuth(ROLES)` +
  `runAuthorizedHandler` — the shape to follow.
- Payload never asks for the current password on `update`; verifying it is ours. A password update
  keeps all sessions (merged doc re-save) — consistent with the EX-985 / EX-918 stance.
- The worker page (`src/app/(frontend)/pracownicy/[id]/page.tsx`) shows `EditWorkerDialog` to
  managers only (`:76`); the self gate idiom is `currentUser.id === userId` (`:84`).

## Desired End State

- An EMPLOYEE's REST `update` on their own `users` row is refused (403); ADMIN / OWNER / MANAGER
  access is unchanged.
- Every logged-in user sees „Zmień e-mail lub hasło" on **their own** `/pracownicy/[id]` page (never
  on someone else's). The dialog takes e-mail (prefilled), new password + repeat (optional — empty
  means unchanged), and the current password (required).
- Wrong current password → „Nieprawidłowe obecne hasło." and nothing is written; 5 wrong attempts
  lock the account for 10 minutes with the same sentence the login page shows. A taken e-mail →
  readable refusal, nothing written. Success → the new e-mail shows on the page; the next login uses
  the new credentials; the current session stays logged in.

### Key Discoveries:

- `payload.login` (Local API) applies Payload's own hashing, lockout (`maxLoginAttempts` 5,
  `lockTime` 10 min), `beforeLogin` (`refuseDisabledLogin`) and skips trashed users — at the cost of
  one orphan session row per check (token never handed out, expires in 7 days).
- Payload lowercases + trims e-mail on write and on login (`auth/baseFields/email.js:10-22`,
  `auth/operations/login.js:48`); `workerSchema.email` already normalises the same way
  (`src/components/forms/worker-form/worker-schema.ts:23-28`) so the clash check and the write read
  one value.
- `emailClash` (`src/lib/actions/workers.ts:9-28`) holds the holder query, but its sentences are
  management-speak (they point at the Kosz) — reuse the query, not the wording.
- `useManagedForm({ persistDraft: false })` skips the `sessionStorage` draft and awaits the action
  before closing (`use-managed-form.ts:132,155`) — template `src/components/dialogs/request-review-dialog.tsx`.
- The users `afterChange` hook already expires `collection:users` (`src/collections/users.ts:38`), which
  is what `fetchReferenceData` (the page's e-mail) reads.

## What We're NOT Doing

- No e-mail confirmation / verification mail (owner decision: e-mail is a login, not a mailbox).
- No session revocation on password change (owner decision; `getCurrentUserJwt` reads no DB, so
  deleting `users_sessions` would only *look* like a logout).
- No re-issuing of the JWT cookie after an e-mail change — the token's stale `email` is read by
  nothing in `src`.
- No `selfAction` wrapper: the only other instance (`sendExpenseDraftAction`) is uncommitted
  in-flight work of another session; extracting now would couple the two.
- Not touching `updateWorkerAction`'s missing `canManageAccount` check (surfaced separately, see
  research Open Question 3).
- No change to the manager's „Edytuj pracownika" form or to `name` / `language` self-editing.

## Implementation Approach

Close the window first (Phase 1), so the door built in Phase 2 is the only way in. The action takes
the account id from the session, never from its arguments — "someone else's account" is
unrepresentable rather than checked. Verification happens before any lookup that could reveal
whether an address is taken.

## Critical Implementation Details

**State sequencing.** In the action: (1) read the stored row (its e-mail is the login, the JWT's may
be stale after an earlier change), (2) refuse a no-op, (3) verify with `payload.login` against the
**stored** e-mail, (4) only then run the e-mail clash check, (5) `payload.update`. Verifying before the
clash check keeps the lockout meaningful and stops a held phone from probing which addresses exist.

**`payload.login` failures are told apart by `error.name`** — the same discrimination `loginAction`
already does (`src/lib/actions/auth.ts:30-40`): `LockedAuth` → the lockout sentence,
`DISABLED_ACCOUNT_ERROR` → `DISABLED_ACCOUNT_MESSAGE`, anything else → „Nieprawidłowe obecne hasło.".

**The password must never reach `sessionStorage`** — the form uses `persistDraft: false`; do not copy a
template that persists drafts.

## Phase 1: Close the REST self-update path

### Overview

An EMPLOYEE can no longer update their own `users` row through access-checked writes (REST /
`overrideAccess: false`). The Local API — every app write — is unaffected.

### Changes Required:

#### 1. Access rule

**File**: `src/access/index.ts`

**Intent**: Drop the self branch of `canUpdateUser`; any role below MANAGER gets no update access.
Replace the line comment so it says why self-update is closed (REST would change e-mail/password
without the old one; the app's own path is `changeOwnCredentialsAction`).

**Contract**: `canUpdateUser`: ADMIN/OWNER → `true`; MANAGER → `{ role: { equals: 'EMPLOYEE' } }`;
otherwise `false`.

#### 2. Access spec

**File**: `src/__tests__/access-control.test.ts`

**Intent**: First coverage of `canUpdateUser`, mirroring how that file calls the other helpers with a
fake `req`.

**Contract**: cases — EMPLOYEE on own id → `false`; EMPLOYEE on another id → `false`; MANAGER → the
EMPLOYEE `Where`; ADMIN / OWNER → `true`; no user → `false`.

### Success Criteria:

#### Automated Verification:

- Access spec passes: `pnpm exec vitest run src/__tests__/access-control.test.ts`

#### Manual Verification:

- Logged in as an EMPLOYEE, `PATCH /api/users/<own id>` with a new `password` (cookie from the
  browser) returns 403 and the old password still logs in.

---

## Phase 2: The self-credentials action

### Overview

`changeOwnCredentialsAction` plus the shared pieces it needs, extracted rather than copied.

### Changes Required:

#### 1. E-mail holder lookup (dedup)

**File**: `src/lib/workers/find-email-holder.ts` (new), `src/lib/actions/workers.ts`

**Intent**: Move the holder query out of `emailClash` so both the manager actions and the self action
use it; `emailClash` keeps its management wording on top of it.

**Contract**: `findEmailHolder(payload, email, ownId?) → Promise<{ id: number; trashedAt?: string | null } | undefined>`;
`emailClash` behaviour unchanged (its spec `worker-duplicate-email.db.test.ts` stays green).

#### 2. Password rules (dedup)

**File**: `src/lib/schemas/password.ts` (new)

**Intent**: One home for the rule the reset form hand-checks today — minimum 6 characters and the
two Polish sentences („Hasło musi mieć co najmniej 6 znaków." / „Hasła nie są takie same.").

**Contract**: exports `passwordSchema` (Zod string, min 6, that message) and the mismatch message
constant.

#### 3. Lockout sentence (dedup)

**File**: `src/lib/constants/worker-lock.ts` (beside `DISABLED_ACCOUNT_MESSAGE`), `src/lib/actions/auth.ts`

**Intent**: The „Konto zostało tymczasowo zablokowane…" sentence becomes a constant read by
`loginAction` and the new action, so a locked account reads the same in both places.

**Contract**: `LOCKED_ACCOUNT_MESSAGE` exported; `loginAction` output unchanged.

#### 4. Form + domain schema

**File**: `src/components/forms/account-credentials-form/account-credentials-schema.ts` (new)

**Intent**: Form layer (all strings) and the domain layer the action validates, derived from it as
`worker-schema.ts` does.

**Contract**: fields `email` (trim + lowercase + `z.email`, required — an empty login is not
allowed), `newPassword` (empty or `passwordSchema`), `confirmPassword` (must equal `newPassword`,
refined on the form layer only), `currentPassword` (non-empty, „Podaj obecne hasło."). Domain type
`AccountCredentialsInputT = { email: string; newPassword?: string; currentPassword: string }`
(empty `newPassword` → `undefined`).

#### 5. The action

**File**: `src/lib/actions/account-credentials.ts` (new, `'use server'`)

**Intent**: The only path for a user to change their own credentials. Doc comment says why it is not
a `protectedAction` (any role, self only) and why the id is never an argument.

**Contract**: `changeOwnCredentialsAction(input: AccountCredentialsInputT): Promise<ActionResultT>`.
`validateAction` → `requireAuth(ROLES)` → `id = session.user.id` → `runAuthorizedHandler(label, handler, ['users'])`.
Handler per **State sequencing** above. Refusals (all `{ success: false, error }`, nothing written):
no change → „Nie wprowadzono żadnej zmiany."; wrong password / locked / disabled → per
**`payload.login` failures**; taken e-mail (`findEmailHolder` with `ownId`, any holder incl. a
trashed one) → „Ten adres e-mail jest już zajęty.". Write: `payload.update({ collection: 'users', id, data })`
with only the changed keys (`email` and/or `password`).

#### 6. Specs

**Files**: `src/__tests__/lib/actions/account-credentials.db.test.ts` (new),
`src/__tests__/components/forms/account-credentials-form/account-credentials-schema.test.ts` (new)

**Intent**: DB spec runs the real `payload.login` / `payload.update` against `db-test`, mirroring
`worker-duplicate-email.db.test.ts` (mocked `requireAuth`, shared `cache-revalidate` stub,
`skipIf(!ENV_READY)`, prefix cleanup on entry). Assert **persisted state**, never the return value
alone. Schema spec pins the form rules.

**Contract**: DB cases —
- wrong current password → refused, stored e-mail unchanged, old password still logs in;
- correct password + new e-mail → stored e-mail is the normalised new one; `payload.login` with new
  e-mail + old password succeeds;
- correct password + new password → new password logs in, old one fails;
- taken e-mail (another fixture user) → refused, stored e-mail unchanged;
- no change → refused;
- the action changes only the session user's row (a second fixture user's e-mail and password are
  untouched).
Schema cases — empty `newPassword` allowed; 5-char password refused; mismatch refused; missing
current password refused; e-mail normalised.

### Success Criteria:

#### Automated Verification:

- Schema spec passes: `pnpm exec vitest run src/__tests__/components/forms/account-credentials-form/account-credentials-schema.test.ts`
- Action DB spec passes against `db-test` (5435): `pnpm exec vitest run src/__tests__/lib/actions/account-credentials.db.test.ts`
- `emailClash` regression spec still passes: `pnpm exec vitest run src/__tests__/lib/actions/worker-duplicate-email.db.test.ts`
- Login action spec still passes: `pnpm exec vitest run src/__tests__/auth-actions.test.ts`

#### Manual Verification:

- None beyond Phase 3 (the action has no UI of its own yet).

---

## Phase 3: Dialog on the worker page, reset form, docs

### Overview

The UI trigger on the owner's own page, the reset form moved onto the shared password rule, and the
living docs updated.

### Changes Required:

#### 1. Form store

**File**: `src/stores/form-stores.ts`

**Intent**: Store entry the managed form needs.

**Contract**: `useAccountCredentialsFormStore = createFormStore<AccountCredentialsFormValuesT>('account-credentials-form')`.

#### 2. Form + dialog

**Files**: `src/components/forms/account-credentials-form/account-credentials-form.tsx` (new),
`src/components/dialogs/account-credentials-dialog.tsx` (new)

**Intent**: Follow `RequestReviewDialog` / `RequestReviewForm`: `FormDialog` with
`showKeepOpen={false}`, `useManagedForm` with `persistDraft: false`, `FormFooter`. Password inputs
use `type="password"` with `autoComplete` `current-password` / `new-password`. A hint under the new
password: „Zostaw puste, aby nie zmieniać hasła.". On success the dialog closes with a toast and the
page refreshes (the new e-mail renders from `fetchReferenceData`).

**Contract**: `AccountCredentialsDialog({ email }: { email: string })`; trigger label „Zmień e-mail
lub hasło"; dialog title the same.

#### 3. Worker page

**File**: `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: Render the dialog trigger when `currentUser.id === userId`, regardless of role, beside
where `EditWorkerDialog` sits. Must work at 390px.

**Contract**: no change to `canViewWorkerPage` or the manager branch.

#### 4. Reset-password form

**File**: `src/app/(auth)/zaloguj/reset-hasla/reset-password-form.tsx`

**Intent**: Replace the hand-written length check and mismatch sentence with `passwordSchema` and
the shared mismatch constant. User-visible behaviour unchanged.

**Contract**: same messages, same 6-char minimum.

#### 5. Docs

**Files**: `AGENTS.md` (Auth And Roles), `context/foundation/test-plan.md`

**Intent**: AGENTS.md — one sentence: a user changes their own e-mail/password only through
`changeOwnCredentialsAction` (current password required, id from the session); REST self-update on
`users` is closed. test-plan.md — new risk row (next free number): "someone holding a logged-in
phone takes over the account — changes its e-mail or password without knowing the current one, or
changes another account", anchored on EX-989, pointing at the two specs above.

**Contract**: prose only.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check beyond the Phase 2 specs (UI + prose phase); covered by the
  Whole-tree Gate.

#### Manual Verification:

- As an EMPLOYEE on a 390px viewport, `/pracownicy/<own id>` shows „Zmień e-mail lub hasło"; the
  dialog fits and is usable.
- Wrong current password → „Nieprawidłowe obecne hasło.", nothing changes.
- Changing only the e-mail → the page shows the new e-mail; logout, login with the new e-mail and the
  old password works.
- Changing only the password → logout, the new password logs in, the old one does not; the session
  that made the change stayed logged in until the logout.
- An e-mail taken by another worker → „Ten adres e-mail jest już zajęty.".
- As a MANAGER on another worker's page → no „Zmień e-mail lub hasło"; on their own page → present
  and works.
- Reset-password page: mismatch and a 5-char password show the same sentences as before.
- After closing and reopening the dialog (and reloading), no password value is restored.

---

## Testing Strategy

### Unit Tests:

- `canUpdateUser` per role (Phase 1).
- Form schema rules (Phase 2).

### Integration Tests:

- `account-credentials.db.test.ts` — real Payload auth against `db-test`, persisted-state asserts
  (Phase 2). It is picked up by `pnpm test:integration` (pre-push) because it lives under
  `src/__tests__` and matches `*.db.test.ts`.

### Manual Testing Steps:

See Phase 1 and Phase 3 manual bullets.

## Performance Considerations

None — one `findByID`, one `login` (pbkdf2 ~tens of ms), one `find`, one `update` per submit.

## Migration Notes

None. No schema change; `canUpdateUser` is code-only.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- DB-backed specs pass: `pnpm test:integration`
- Full suite: only when the user asks (see memory / review gate).

## References

- Research: `context/changes/2026-10-05-worker-self-credentials/research.md`
- Self-scoped write precedent: `src/lib/actions/worker-expense-drafts.ts:31-64`
- Dialog template: `src/components/dialogs/request-review-dialog.tsx`
- DB spec template: `src/__tests__/lib/actions/worker-duplicate-email.db.test.ts`
- Lesson priors: `context/foundation/lessons.md` — "An action spec with a mocked writer can assert
  that a forbidden shape SUCCEEDS" (why the action spec is DB-backed, not mocked)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Close the REST self-update path

#### Automated

- [x] 1.1 Access spec passes: `pnpm exec vitest run src/__tests__/access-control.test.ts` — e7a816ca

### Phase 2: The self-credentials action

#### Automated

- [x] 2.1 Schema spec passes — 743e6f6e
- [x] 2.2 Action DB spec passes against `db-test` (5435) — 743e6f6e
- [x] 2.3 `emailClash` regression spec still passes — 743e6f6e
- [x] 2.4 Login action spec still passes — 743e6f6e

### Phase 3: Dialog on the worker page, reset form, docs

#### Automated

- [x] 3.1 No phase-scoped automated check (UI + prose); covered by the Whole-tree Gate — 1bdff43c
