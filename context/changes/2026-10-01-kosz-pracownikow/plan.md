# Trash for an unused worker (EX-918) Implementation Plan

## Overview

A worker added by mistake or never used can't be removed from the app today. This change lets a
manager send them to the trash (`/kosz`) together with every kasa they own, provided all of it is
unused; restore them; delete them for good with the typed name; or let them purge after 30 days.
It also closes the login gap a trash would otherwise leave open — and the one `active = false`
already leaves open — and makes `/kosz` follow one policy across every kind.

## Current State Analysis

Full research: `context/changes/2026-10-01-kosz-pracownikow/research.md` (incl. two rounds of owner
answers). In short:

- The kasa trash (EX-917) shipped the shared `/kosz` machinery (`TRASH_KINDS`, `shapeTrashRows`,
  `purgeTrashedRows`, a cron `runStep` per kind) and a seam: `trashCashRegister(payload, id, req)`.
- „Unused" for a user is the inline `preventDeleteWithReferences` probe in
  `src/collections/users.ts:25-76`; its kasa probe blocks on **any** owned kasa, empty or trashed.
- `withPayloadTransaction` commits whenever `work` returns — a refusal returned after a first write
  commits that write.
- Auth: `getCurrentUserJwt` is DB-free and ignores `sid`; nothing refuses login on `active = false`;
  Payload's own strategy (admin, REST) checks `sid` against `users_sessions`. `beforeLogin` runs after
  the password check and the session write; a throw revokes the session (`login.js:243-251, 323-335`).
- Readers: `refData.workers` is both the pickers' list and the name map (`transfer-mapping.ts:36`).
- Writers of a user id with no trash check: transfers `validate` (PAYOUT `worker`), stage split /
  add stage (`lib/db/stage-split.ts`), restore / preset / import (`liveWorkerIds`,
  `insert-kosztorys-tree.ts:37-49`), equipment holder (`hooks/equipment/validate.ts`), kasa owner.
- Employees own WORKER **and** AUXILIARY kasy (local: 20 WORKER, 7 AUXILIARY; user 24 owns both).
- No self-delete or last-owner guard exists anywhere, including `/admin` (`delete: isAdminOrOwner`).

**In-flight work in the shared tree (uncommitted, another session):** the investment trash now opens a
trashed investment read-only from `/kosz`, refuses an active investment, adds `trashedInvestments` to
reference data and bumps the cache key to `reference-data-v4`, and adds `hasSheet` to `TrashRowT`.
Phases 2–5 build on those files; see **Prerequisites**.

## Desired End State

- `/pracownicy` offers „Do kosza" on an unused worker's row (MANAGER: EMPLOYEE rows only; never your
  own row). A used worker is refused with a sentence naming what uses them.
- The worker and every kasa they own go to the trash in one transaction, or nothing does.
- `/kosz` has a „Pracownicy" section; each row names the kasy that went with the worker. Restore brings
  them all back; delete forever (typed name) removes the kasy, then the worker; the cron purges both
  after 30 days. Those kasy never appear as separate „Kasy" rows and cannot be restored or deleted alone.
- A trashed worker is absent from every list and picker, keeps their name on cancelled rows, and
  cannot be booked, assigned to an etap, handed equipment, given a kasa, or reached by a report link.
- A trashed or deactivated account cannot log in (app, `/admin`, REST); its stored sessions are
  dropped. An app session already open lasts until its JWT expires (≤ 7 days) — accepted.
- Nobody can trash or delete their own account or the last live OWNER / last live ADMIN — via the app,
  `/admin` or REST.
- Every `/kosz` kind asks for the typed name on delete forever; every kind auto-purges after 30 days
  except an item still holding real work (today only an investment with a used kosztorys).

### Key Discoveries:

- `src/lib/cash-registers/trash-cash-register.ts:15-32` — the seam; returns a refusal, never throws.
- `src/lib/db/with-payload-transaction.ts:33-35` — commits on a returned refusal → probe all, then write.
- `src/lib/db/delete-blocker.ts:53-62` — `makeDeleteBlocker`, forwards `req` into every count.
- `src/hooks/cash-registers/guard-update.ts:15-38` — freeze-while-trashed pattern to mirror for users.
- `src/hooks/transfers/validate.ts:102-115` — gate placement (below cancellation early returns, only
  newly named ids) to mirror for the PAYOUT worker.
- `src/lib/db/cash-register-gate.ts:7-16` — `trashedRegisterMessage` template.
- `src/lib/kosztorys/worker-report/share-refusal.ts:14` — the report link already refuses an inactive
  worker; `src/lib/db/worker-report-share.ts:24,38` reads `w.active`.
- `src/lib/actions/toggle-active.ts:43-52` — deactivation path that must also drop sessions.
- `src/lib/actions/auth.ts:28-37` — `loginAction` maps errors by `error.name`.
- `users_sessions(_parent_id → users.id ON DELETE CASCADE)` — the stored sessions.

## What We're NOT Doing

- No per-request DB check in `getCurrentUserJwt` (owner chose option a) — an open app session keeps
  working until its JWT expires.
- No last-OWNER/ADMIN guard on role changes or on unchecking „Aktywny" — only trash and delete.
- No kasa handover; a worker with a used kasa stays (deactivate instead).
- No pairing column — the pair is derived (see Implementation Approach).
- Flota and sprzęt trash (EX-915/916); kosz plików.
- No admin-panel list filters for trashed users (the panel is unused).
- No E2E spec in this change — filed to the `e2e-backlog` at the review gate, as EX-952 was for kasy.
- Restoring the cleared default kasa on restore (kasa precedent: cleared, not restored).

## Implementation Approach

Mirror the kasa trash layer by layer under a new `src/lib/workers/`, with three differences:

1. **One predicate, two consumers.** Extract the users probe into an exported blocker with the kasa
   probe removed (`workerUseBlocker`) — that is „used". The collection's `beforeDelete` stays the full
   check (use + owns a kasa), so a hard delete still meets every owned kasa. Trashing = worker unused
   AND every owned kasa passes `cashRegisterDeleteBlocker`.
2. **The pair is derived, not stored.** A trashed kasa whose owner is trashed belongs to that owner's
   `/kosz` row. Invariant: a live kasa never has a trashed owner. The worker trash writes the same
   `trashedAt` instant on the user and on each kasa; restore brings back the owner's kasy carrying that
   instant (a kasa trashed alone earlier stays trashed and reappears in „Kasy" once the owner is live).
   Delete forever / purge removes **all** the owner's trashed kasy first, then the user.
3. **Probe-all-then-write.** Every refusal is decided before the first write, because the transaction
   helper commits on return.

Auth is closed at the door, not per request: a `beforeLogin` hook refuses `trashedAt` or
`active = false`, and the trash and the deactivation drop the account's `users_sessions` rows (closes
`/admin` and REST at once).

## Critical Implementation Details

- **Session deletion order.** A `payload.update` on a user writes the whole merged document, sessions
  array included — deleting `users_sessions` rows _before_ it would let the update re-insert them. Set
  `trashedAt` / `active` first, then the raw `DELETE FROM users_sessions WHERE _parent_id = $id`, in the
  same transaction.
- **Restore order.** Restore the user before the kasy: the kasa guard refuses a restore while the owner
  is trashed. Delete forever the other way: kasy first (`owner_id` is NOT NULL and the full users
  `beforeDelete` counts owned kasy). Do it on one `req`, with **no** catch-and-continue inside — a
  swallowed Postgres error aborts the shared transaction (25P02); let it throw and roll back.
- **Users freeze guard vs login.** Payload's login writes the session and `loginAttempts` through
  `payload.db` (no collection hooks), so the freeze guard must not be what refuses a login — that is
  `beforeLogin`'s job. Verify a failed and a refused login against a trashed account still behave.

## Phase 1: Schema, login refusal, account guards

### Overview

The column, the „unused" predicate, the self / last-owner rule, the freeze of a trashed account, and
the login door — everything that guards the account itself.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/<next>_users_trashed_at.ts` (hand-written; copy `20260930_3_cash_register_trashed_at.ts`)

**Intent**: Add the soft-delete column.

**Contract**: `users.trashed_at timestamp(3) with time zone NULL`, `ADD COLUMN IF NOT EXISTS`; `down`
drops it. Register in `src/migrations/index.ts`. Additive → migrate prod before the push that ships it.

#### 2. Users collection

**File**: `src/collections/users.ts`

**Intent**: Add the `trashedAt` field (closed to access-checked writes, like `cash-registers.ts:80-88`,
hidden in admin) and wire the new hooks. The delete refusal sentence stays as it is; only its probe
list moves out.

**Contract**:

- `trashedAt` date field, `access: { create: () => false, update: () => false }`, `admin.hidden: true`.
- `hooks.beforeLogin: [refuseDisabledLogin]`, `hooks.beforeChange: [guardDefaultRegister, guardUserUpdate]`,
  `hooks.beforeDelete: [guardAccountRemoval, preventDeleteWithReferences]`.
- The probe list moves out (item 3); `preventDeleteWithReferences` = `workerUseBlocker` + the kasa probe.

#### 3. The „unused" predicate

**File**: `src/lib/workers/delete-blocker.ts` (new)

**Intent**: Spell „used" once so trash, delete forever and purge ask the same question.

**Contract**: `workerUseBlocker: DeleteBlockerT` via `makeDeleteBlocker` — every current probe **except**
`cash-registers.owner` (transactions excl. cancelled, amount-edits, stage memberships, reports, equipment
holder). The kasa probe stays in the collection's `beforeDelete` only.

#### 4. Self / last-owner rule

**File**: `src/lib/workers/account-removal.ts` (new) + `src/hooks/users/guard-account-removal.ts` (new)

**Intent**: Refuse removing your own account or the last live OWNER / last live ADMIN, in one predicate
read by the trash action and by `beforeDelete` (which covers `/admin`, REST, delete forever, purge).

**Contract**: `accountRemovalRefusal(db, { targetId, targetRole, actorId? }): Promise<string | undefined>`
— self when `actorId === targetId`; last-of-role when `targetRole ∈ {OWNER, ADMIN}` and no _other_ user
of that role has `trashed_at IS NULL`. Counted per role. The cron (no `req.user`) skips the self check.
Messages in `src/lib/constants/worker-lock.ts` (new; mirror `cash-register-lock.ts`).

#### 5. Freeze a trashed account

**File**: `src/hooks/users/guard-update.ts` (new)

**Intent**: A trashed user is read-only apart from its restore — mirrors `guardCashRegisterUpdate`.

**Contract**: on `update`, throw `APIError(WORKER_TRASHED_MESSAGE, 403)` when `original.trashedAt` and the
resolved `trashedAt` is still set.

#### 6. Login refusal

**Files**: `src/hooks/users/refuse-disabled-login.ts` (new), `src/lib/actions/auth.ts`

**Intent**: Refuse a trashed or deactivated account at login, after the password check, with a readable
sentence in the app's login form.

**Contract**: hook throws an `APIError` subclass whose `name` is `'DisabledAccount'` when
`user.trashedAt || user.active === false` (a NULL `active` reads as active — `worker-report-share.ts:37`).
`loginAction` adds a branch on that name, next to `LockedAuth`, returning e.g. „To konto jest wyłączone.
Skontaktuj się z właścicielem firmy."

#### 7. Drop sessions on deactivation

**Files**: `src/lib/db/user-sessions.ts` (new), `src/lib/actions/toggle-active.ts`

**Intent**: Unchecking „Aktywny" closes `/admin` and REST at once, not after the JWT expires.

**Contract**: `deleteUserSessions(db, userId)` — `DELETE FROM users_sessions WHERE _parent_id = $1`.
`toggleUserActive(id, false)` calls it after the update (see Critical Implementation Details).

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate` (check `git status src/migrations` and the
  `_payload_migrations` name drift first — research §Local data)
- `src/__tests__/collections/users-delete-guard.test.ts` extended: self, last OWNER, last ADMIN refused;
  a second live OWNER allows it; a trashed OWNER doesn't count as live
- New `src/__tests__/collections/users-update-guard.test.ts`: a trashed user's edit refused, restore allowed
- New `src/__tests__/hooks/users/refuse-disabled-login.test.ts` (or a db spec): trashed and inactive
  login refused, session row gone, wrong password still the generic message
- `src/__tests__/lib/actions/auth.test.ts` (or new): the `DisabledAccount` branch maps to the sentence
- toggle-active spec: deactivation deletes the user's `users_sessions` rows

#### Manual Verification:

- Log in as a deactivated employee → the sentence, not „Nieprawidłowy email lub hasło"
- In `/admin`, try to delete your own account and the only ADMIN → refused with the sentence

**Implementation Note**: When this phase's automated verification passes, commit and continue — do not
pause for manual confirmation.

---

## Phase 2: Readers and write gates

### Overview

A trashed worker disappears from every list and picker but keeps their name on history, and no write
can name them. Most gates guard a stale form or a re-attach — an unused worker has no live use.

### Changes Required:

#### 1. Reference-data split

**Files**: `src/lib/queries/reference-data.ts`, `src/types/reference-data.ts`

**Intent**: Split users at the source into live + `trashedWorkers` (lessons.md:2425-2430), like kasy and
investments.

**Contract**: users SQL selects `(trashed_at IS NOT NULL) AS trashed`; `workers` = live,
`trashedWorkers: WorkerRefT[]` documented „for naming a trashed worker on old rows only — never a picker
or listing". Bump the cache key one past whatever the tree holds (`v4` → `v5`).

#### 2. Name resolvers read the union

**Files**: `src/lib/queries/transfer-mapping.ts`, `src/lib/queries/cash-registers.ts`,
`src/app/(frontend)/kasa/[id]/page.tsx`

**Intent**: Cancelled rows and a trashed kasa's owner keep their names. The other resolvers from
research §4 can never meet a trashed (unused) worker and stay on the live list.

**Contract**: worker / createdBy name map built from `[...workers, ...trashedWorkers]`.

#### 3. Write gates

**Files**: `src/lib/db/worker-gate.ts` (new), `src/hooks/transfers/validate.ts`,
`src/lib/actions/kosztorys.ts` (add stage / update split), `src/lib/kosztorys/insert-kosztorys-tree.ts`,
`src/hooks/equipment/validate.ts`, `src/hooks/cash-registers/guard-update.ts` + the kasa create path

**Intent**: Refuse naming a trashed worker anywhere a user id is assigned.

**Contract**:

- `trashedWorkerMessage(db, ids): Promise<string | undefined>` — mirror of `trashedRegisterMessage`.
- Transfers: below both early returns, only a `worker` this write newly names.
- Stage add / split update: refuse before `replaceStageSplit` / `insertStageMembers`.
- `liveWorkerIds`: `AND trashed_at IS NULL` — a trashed member is dropped and counted like a deleted
  one (restore / preset / import never re-attach a trashed worker).
- Equipment: a trashed `holder` refused (`APIError 403`).
- Kasa: create or owner change to a trashed user refused; **restore** of a kasa whose owner is trashed
  refused with „Przywróć pracownika — kasa wraca razem z nim".
- Report link: `reportShareRefusal` refuses a trashed worker (read `trashed_at` next to `active` in
  `worker-report-share.ts`); the `/p/` link is unaffected (no membership → nothing to show).

### Success Criteria:

#### Automated Verification:

- New `src/__tests__/hooks/transfers/validate-worker-trash.test.ts` (mirror `validate-register-trash`):
  PAYOUT to a trashed worker refused; cancelling an old row naming them still works
- `src/__tests__/lib/queries/transfer-mapping.test.ts`: a trashed worker's name on a cancelled row
- `src/__tests__/lib/queries/reference-data-sql-drift.test.ts` green with the new column
- Stage split / add stage refusal spec; `liveWorkerIds` drops a trashed member (extend the restore spec)
- `cash-registers-update-guard.test.ts`: owner → trashed user refused; restore while owner trashed refused
- Equipment validate spec: trashed holder refused
- Report share refusal spec: trashed worker refused

#### Manual Verification:

- With a worker trashed (via SQL on 5433 before Phase 3 exists, or after Phase 3), no picker on
  `/transakcje`, the etap split dialog or `/sprzet` offers them

**Implementation Note**: commit and continue when automated verification passes.

---

## Phase 3: Trash core, actions, purge

### Overview

Trash / restore / delete forever for the worker + kasy, and the 30-day purge.

### Changes Required:

#### 1. Core

**Files**: `src/lib/workers/trash-worker.ts`, `restore-worker.ts`, `delete-worker-forever.ts`,
`purge-trash.ts` (new); `src/lib/db/worker-trash.ts` (new SQL)

**Intent**: The pair in one transaction, all refusals decided before the first write.

**Contract**:

- `trashWorker(payload, workerId, req): Promise<string | undefined>` — order: `workerUseBlocker` →
  `cashRegisterDeleteBlocker` for every owned kasa (first refusal returned, naming the kasa) → then
  writes: one `now` instant; for each kasa `trashCashRegister`-equivalent write with that instant
  (`clearDefaultRegister` + `trashedAt`); the user's `trashedAt` (same instant, `overrideAccess`);
  `deleteUserSessions`. `trashCashRegister` gains an optional `trashedAt` argument rather than a copy.
- `restoreWorker(payload, workerId, req)` — user `trashedAt: null`, then each owned kasa whose
  `trashed_at` equals the user's previous instant.
- `deleteTrashedWorker(payload, workerId, req?)` — refuses an untrashed user; deletes every trashed kasa
  of the owner, then the user, via `payload.delete` (so `beforeDelete` re-counts); returns
  `DeleteForeverResultT`. No internal catch around the kasa deletes.
- SQL: `fetchTrashedWorkers` (id, name, role, trashedAt, kasy names aggregated),
  `selectPurgeableWorkerIds(db, days)`; `selectPurgeableCashRegisterIds` and `fetchTrashedCashRegisters`
  exclude kasy whose owner is trashed.
- `purgeWorkerTrash(payload, db)` via `purgeTrashedRows`.

#### 2. Actions

**File**: `src/lib/actions/worker-trash.ts` (new)

**Intent**: Three `protectedAction`s mirroring `cash-register-trash.ts`.

**Contract**: `trashWorkerAction(id)`, `restoreWorkerAction(id)`,
`deleteWorkerForeverAction(id, confirmName)` — `MANAGEMENT_ROLES`; a MANAGER sees and acts only on
EMPLOYEE rows (others → „nie znaleziono", like hidden MAIN); trash runs `accountRemovalRefusal` with
`actorId`; trash inside `withPayloadTransaction(…, SKIP_HOOK_REVALIDATION)`; idempotent when already
trashed; delete forever requires `confirmName` to match the name.
Tags in `src/lib/cache/tags.ts`: `WORKER_TRASH_TAGS = ['users', 'cashRegisters']`; delete adds
`transfers` and `equipmentEvents`.

#### 3. Cron

**File**: `src/app/(payload)/api/cron/cleanup/route.ts`

**Intent**: A `workerTrash` step after `cashRegisterTrash`, in `steps` and the response.

**Contract**: `runStep('workerTrash', () => purgeWorkerTrash(payload, db))`; on deletions revalidate
`users` + `cashRegisters` with `EXPIRE_NOW` (inside the purge, like the kasa one).

### Success Criteria:

#### Automated Verification:

- New `src/__tests__/lib/actions/worker-trash.db.test.ts`: unused worker + empty kasa trashed together;
  used worker refused; worker with one used kasa of two → refused and **nothing** trashed; self refused;
  last OWNER refused; MANAGER on an OWNER → not found; sessions deleted; restore brings both back;
  delete forever with wrong name refused, right name removes kasy then user
- New `src/__tests__/lib/workers/purge-trash.db.test.ts`: purged after 30 days with their kasy; a worker
  made used while trashed → `blocked`, not deleted
- `src/__tests__/lib/cash-registers/purge-trash.db.test.ts`: a kasa with a trashed owner is not purged
  by the kasa step
- `src/__tests__/app/api/cron/cleanup/route.test.ts`: the new step present and isolated

#### Manual Verification:

- None beyond Phase 4 (no UI yet).

**Implementation Note**: commit and continue when automated verification passes.

---

## Phase 4: UI

### Overview

„Do kosza" on `/pracownicy`, and a „Pracownicy" section in `/kosz`.

### Changes Required:

#### 1. „Do kosza"

**Files**: `src/components/workers/trash-worker-button.tsx` (new; mirror
`components/cash-registers/trash-cash-register-button.tsx`), `src/components/tables/users.tsx`,
`src/app/(frontend)/pracownicy/page.tsx`

**Intent**: A row action; hidden on your own row and, for a MANAGER, on non-EMPLOYEE rows. The confirm
names the kasy that will go with the worker.

**Contract**: the page passes `currentUserId` / role (and each row's owned kasy names) to the columns.

#### 2. `/kosz` section

**Files**: `src/types/trash.ts`, `src/lib/queries/trash.ts`, `src/components/trash/trash-kinds.ts`,
`src/components/trash/trash-section.tsx`

**Intent**: Third kind; each row lists „razem z kasą: …".

**Contract**: `TrashKindT` gains `'worker'`; `TrashRowT` gains `pairedRegisters: string[]` (empty for
other kinds) — or a per-kind detail slot if the in-flight `hasSheet` work has introduced one by then;
`shapeTrashRows` takes the workers argument and filters non-EMPLOYEE rows for a MANAGER;
`TRASH_KINDS.worker` with `sectionTitle: 'Pracownicy'`, `nameLabel: 'Imię i nazwisko'`, `lost` naming
the kasy and the name on cancelled rows; workers always `autoPurges` and `mustTypeName`.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/queries/trash.test.ts`: worker rows shaped, kasy names attached, MANAGER filter,
  paired kasy absent from „Kasy"
- `src/__tests__/components/trash/trash-contents.test.tsx`: the „Pracownicy" section renders
- New `src/__tests__/components/workers/trash-worker-button.test.tsx` (or users table spec): hidden on
  own row and for MANAGER on an OWNER row

#### Manual Verification:

- `/pracownicy` → „Do kosza" on worker 46 → `/kosz` shows them with „razem z kasą: …"; kasa 31 absent
  from „Kasy" and `/kasy`
- „Przywróć" → both back; trash again → „Usuń na zawsze" asks for the name and removes both
- As MANAGER: no „Do kosza" on an OWNER row; an OWNER trashed by an OWNER is not listed in `/kosz`
- A used worker → refusal toast naming what uses them

**Implementation Note**: commit and continue when automated verification passes.

---

## Phase 5: One `/kosz` policy + docs

### Overview

Typed name on delete forever for every kind, and the docs. **Starts only after the other session's
investment-trash work is committed** (see Prerequisites).

### Changes Required:

#### 1. Typed name everywhere

**Files**: `src/lib/actions/cash-register-trash.ts`, `src/lib/cash-registers/delete-cash-register-forever.ts`,
`src/lib/actions/investment-trash.ts`, `src/lib/queries/trash.ts`, `src/types/trash.ts`,
`src/components/trash/delete-forever-dialog.tsx`, `src/components/trash/trash-kinds.ts`

**Intent**: One confirm for every kind; the server checks the name for every kind, not only a used
investment or a szablon.

**Contract**: `deleteCashRegisterForeverAction(id, confirmName)` checks the name; the investment action's
`mustTypeName` condition becomes unconditional; `TrashRowT.mustTypeName` and `askReason` are removed
(the dialog always asks); the „kosztorys w użyciu" warning moves into the investment's `lost` / fate
line if it is still wanted. `autoPurges` stays — it is the one stated exception.

#### 2. Docs

**Files**: `AGENTS.md` (Auth And Roles), `context/foundation/test-plan.md`,
`context/reference/kosztorys-editor-domain-notes.md` only if it states trash policy

**Intent**: Record the login door and the `/kosz` policy where the next reader looks.

**Contract**: AGENTS.md — one paragraph: a trashed or inactive account is refused at login, sessions are
dropped on trash/deactivate, an open app session lasts until JWT expiry (DB-free auth, by choice);
nobody removes themselves or the last OWNER/ADMIN. Test-plan — extend risk #15 to workers + the pair;
add a risk row „a removed or deactivated account still gets in" (via `/10x-test-plan`).

### Success Criteria:

#### Automated Verification:

- `src/__tests__/components/trash/delete-forever-dialog.test.tsx`: every kind asks for the name
- `src/__tests__/lib/actions/cash-register-trash.db.test.ts`: wrong name refused
- `src/__tests__/lib/actions/investment-trash.db.test.ts`: an unused investment now requires the name

#### Manual Verification:

- `/kosz` → „Usuń na zawsze" on a kasa and on an unused investment asks for the name

**Implementation Note**: commit when automated verification passes.

---

## Testing Strategy

### Unit Tests:

- Account-removal predicate (self, last-of-role per role, trashed doesn't count), `trashedWorkerMessage`,
  `shapeTrashRows` with workers.

### Integration Tests (5435 DB):

- The pair: all-or-nothing trash, restore order, delete-forever order, purge, kasa purge exclusion.
- Gates: PAYOUT, stage split, `liveWorkerIds`, equipment, kasa owner/restore, report share.
- Login refusal end-to-end through `payload.login` (session row revoked).

### Manual Testing Steps:

1. Trash worker 46 with kasa 31 from `/pracownicy`; check `/kosz`, `/kasy`, pickers.
2. Restore; trash again; delete forever with the typed name.
3. Deactivate an employee; log in as them → refused with the sentence.
4. Try trashing yourself and the only ADMIN → refused.

E2E (browser, action → DB → revalidation): filed to the `e2e-backlog` at the review gate.

## Performance Considerations

None material: one extra boolean in the users ref query; the login hook reads the user Payload already
loaded; trash touches a handful of rows.

## Migration Notes

Additive nullable column → apply to prod (`pnpm db:migrate:prod`, human) **before** pushing the code.
Local: check `_payload_migrations` for the `20260930_2/_3_cash_register_trashed_at` name drift first;
the kasa migration is `IF NOT EXISTS`, so a re-run is harmless.

## Whole-tree Gate

Run once, after Phase 5:

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm test` and `pnpm test:integration` (pre-push runs both legs)

## Prerequisites

- **The other session's investment-trash work is committed** before Phase 2 (`reference-data.ts`,
  `types/reference-data.ts`) and before Phases 4–5 (`trash-kinds.ts`, `queries/trash.ts`,
  `types/trash.ts`, `trash-section.tsx`, `investment-trash.ts`). Phase 1 and Phase 3's core touch none
  of those files. Re-read those files at the start of each dependent phase — this plan was written
  against their uncommitted state at 2026-10-01.
- Local DB migrated from this tree (`git status src/migrations` first).

## References

- Research: `context/changes/2026-10-01-kosz-pracownikow/research.md`
- Umbrella: `context/changes/2026-09-29-kosz-pozostalych-encji/research.md` §6
- Reference implementation: `context/archive/2026-09-30-kosz-kas/`
- Lessons: `context/foundation/lessons.md:2236-2253`, `:2425-2430`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, login refusal, account guards

#### Automated

- [x] 1.1 Migration applies to the local DB — c8da93ab
- [x] 1.2 Users delete guard: self, last OWNER, last ADMIN refused; trashed OWNER not counted — c8da93ab
- [x] 1.3 Users update guard: trashed user's edit refused, restore allowed — c8da93ab
- [x] 1.4 Login refusal: trashed and inactive refused, session revoked, wrong password unchanged — c8da93ab
- [x] 1.5 `loginAction` maps `DisabledAccount` to the sentence — c8da93ab
- [x] 1.6 Deactivation deletes the user's sessions — c8da93ab

### Phase 2: Readers and write gates

#### Automated

- [x] 2.1 PAYOUT to a trashed worker refused; cancellation still works
- [x] 2.2 Trashed worker named on a cancelled row
- [x] 2.3 Reference-data SQL drift spec green
- [x] 2.4 Stage split / add stage refused; `liveWorkerIds` drops a trashed member
- [x] 2.5 Kasa owner → trashed refused; kasa restore while owner trashed refused
- [x] 2.6 Equipment holder trashed refused
- [x] 2.7 Report share refuses a trashed worker

### Phase 3: Trash core, actions, purge

#### Automated

- [ ] 3.1 Worker trash actions db spec (pair, all-or-nothing, guards, sessions, restore, delete forever)
- [ ] 3.2 Worker purge db spec
- [ ] 3.3 Kasa purge skips kasy with a trashed owner
- [ ] 3.4 Cleanup cron route spec with the new step

### Phase 4: UI

#### Automated

- [ ] 4.1 `shapeTrashRows` worker rows, kasy names, MANAGER filter, paired kasy absent from „Kasy"
- [ ] 4.2 `/kosz` renders the „Pracownicy" section
- [ ] 4.3 „Do kosza" hidden on own row and for MANAGER on non-EMPLOYEE rows

### Phase 5: One `/kosz` policy + docs

#### Automated

- [ ] 5.1 Delete-forever dialog asks for the name for every kind
- [ ] 5.2 Kasa delete forever refuses a wrong name
- [ ] 5.3 Unused investment delete forever requires the name
