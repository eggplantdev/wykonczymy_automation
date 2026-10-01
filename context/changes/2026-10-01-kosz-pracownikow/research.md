---
date: 2026-10-01T10:25:00+02:00
researcher: Claude (Opus 5.5)
git_commit: c2bc1b1f
branch: staging
repository: wykonczymy
topic: 'EX-918 — trash an unused worker: plug-in points after kosz-kas, auth, read sites, write gates'
tags: [research, codebase, trash, kosz, users, workers, auth, cash-registers]
status: complete
last_updated: 2026-10-01
last_updated_by: Claude (Opus 5.5)
last_updated_note: 'Owner answers round 2 — pair shown together, all kasy, typed name everywhere, one purge rule'
---

# Research: trash an unused worker (EX-918)

**Date**: 2026-10-01T10:25:00+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: c2bc1b1f
**Branch**: staging
**Repository**: wykonczymy

## Research Question

What does a worker trash (trash / restore / delete forever / 30-day purge, `/kosz` section) have to
plug into now that the kasa trash (`kosz-kas`, EX-917) has shipped the shared `/kosz` kinds table and a
`req` seam for the worker+kasa pair? Re-verify umbrella research §6
(`context/changes/2026-09-29-kosz-pozostalych-encji/research.md:270-352`) against today's code — the
EX-943 stage split and the EX-947 worker reports landed after it.

## Summary

- **The shared machinery is ready; a third kind is mechanical.** `TrashKindT` + `TRASH_KINDS` +
  `shapeTrashRows` argument + `getTrashContents` fetch + a `runStep` in the cleanup cron
  (§1.3). The kasa trash is the layer-by-layer template.
- **"Unused" shrinks the gate surface a lot.** An unused worker has, by definition, no live
  transactions, amount edits, stage memberships, reports or equipment events. So the counters, payout
  pairs, `copyStageSplit` carry-over and share/report surfaces cannot see one. What remains is
  (a) names on **cancelled** rows and non-blocking authorship, (b) **stale-form / re-attach** writes,
  (c) **auth**.
- **The pair with the owned kasa is the real design work.** The seam exists
  (`trashCashRegister(payload, id, req)`), but: a worker may own several kasy of any type;
  `withPayloadTransaction` commits on a returned refusal, so a loop that trashes kasa A then refuses on
  kasa B commits a half-trash; nothing records that a kasa went to the trash _with_ its worker, so
  `/kosz` would show it as an independent „Kasy" row whose lone restore leaves a live kasa owned by a
  trashed user — which then blocks the worker's purge every night (§2).
- **Auth is the largest open decision.** The app's `getCurrentUserJwt` never hits the DB and ignores the
  JWT's `sid`; Payload's own strategy (admin, REST) does check `sid` against `users_sessions`. Nothing
  refuses login on `active=false` today, let alone on a trash. Four options with costs in §3.
- **Umbrella §6 drifted on two points:** the users delete probe now counts `kosztorys_stage_workers`
  (not `kosztorys_stages.worker_id`) and gained a worker-reports probe; and no local user is blocked
  _only_ by authoring a CANCELLATION, so umbrella Open Question 9 is moot.
- **Local data (prod dump):** 8 unused users — EMPLOYEE 20/23/26/29/61 (inactive), 37 (active), 46
  (active, owns the only empty kasa 31 → the pair case), OWNER 66 (a QA temp owner, created
  2026-09-30). 4 users are blocked _only_ by owning a used kasa (35, 42, 44, 64). Last-owner guard is
  live: 2 OWNER + 1 ADMIN, and one of the OWNERs is itself trashable.

## Detailed Findings

### 1. What the worker trash plugs into (state after kosz-kas)

#### 1.1 The kasa trash, the template

- Actions `src/lib/actions/cash-register-trash.ts`: `trashCashRegisterAction` (:44-65,
  `protectedAction` → `MANAGEMENT_ROLES`, inside `withPayloadTransaction(…, SKIP_HOOK_REVALIDATION)`,
  idempotent :56), `restoreCashRegisterAction` (:67-85, one update, no transaction),
  `deleteCashRegisterForeverAction` (:87-101, plain confirm). `findVisibleRegister` (:25-42) hides MAIN
  from a MANAGER.
- Core `src/lib/cash-registers/`: `trashCashRegister(payload, id, req)` (trash-cash-register.ts:15-32 —
  blocker → `clearDefaultRegister` → `trashedAt` update; **returns** a refusal string, never throws),
  `cashRegisterDeleteBlocker` (delete-blocker.ts:7-20, via `makeDeleteBlocker`,
  `src/lib/db/delete-blocker.ts:53-62` forwards `req`), `deleteTrashedCashRegister(payload, id, req?)`
  (delete-cash-register-forever.ts:15-48 — refuses an untrashed kasa, deletes through `payload.delete`
  so `beforeDelete` re-counts, **catches** `APIError < 500` as `blocked`), `purgeCashRegisterTrash`
  (purge-trash.ts:17-34 → `purgeTrashedRows`, serial, no `req`).
- SQL `src/lib/db/cash-register-trash.ts` (list :13-28, purge selection :30-40, raw
  `clearDefaultRegister` :44-48); gate `trashedRegisterMessage` (`src/lib/db/cash-register-gate.ts:7-16`).
- Guards: `guardCashRegisterUpdate` (`src/hooks/cash-registers/guard-update.ts:15-38`) freezes a trashed
  kasa except its restore (:28) and locks the owner of a used kasa (:32-35); `trashedAt` closed to
  access-checked writes (`src/collections/cash-registers.ts:80-88`); transfers gate
  `src/hooks/transfers/validate.ts:102-115`, below the cancellation early returns, checking only ids
  the write newly names.
- Migration `src/migrations/20260930_3_cash_register_trashed_at.ts` — additive nullable
  `timestamp(3) with time zone`, `ADD COLUMN IF NOT EXISTS`.
- Tags `src/lib/cache/tags.ts`: `CASH_REGISTER_TRASH_TAGS = ['cashRegisters','users']` (:83-86 — `users`
  because of the raw default clear), `CASH_REGISTER_DELETE_TAGS` + `transfers` (:89-92). No entity tags;
  `EntityNameT = 'investment' | 'cash-register'` (:31).

#### 1.2 The EX-918 seam

`trashCashRegister`'s docblock names it: „Takes the caller's `req` so a worker's trash (EX-918) can put
the kasa and the worker in one transaction" (`trash-cash-register.ts:7-9`). `deleteTrashedCashRegister`
takes an optional `req` for the same reason (:15-19). Owner rulings carried from
`context/archive/2026-09-30-kosz-kas/change.md:24-31`: the worker goes with their kasa **only if it is
empty**; a kasa cannot be handed to another owner; MANAGER parity. Two review-gate dismissals were
parked on EX-918 (`review-gate.md:18-19`): a trashed kasa still blocks deleting its owner, and an
EMPLOYEE lands on a 404 dashboard when their WORKER kasa is trashed.

#### 1.3 Adding a third kind to `/kosz`

1. `TrashKindT` (`src/types/trash.ts:1`).
2. A `TRASH_KINDS` entry (`src/components/trash/trash-kinds.ts:26-58`; declaration order = section
   order via `TRASH_KIND_ORDER` :60).
3. A fetcher + an argument to `shapeTrashRows` (`src/lib/queries/trash.ts:17-50`, positional per kind)
   and a fetch in `getTrashContents` (:53-68).
4. A `purgeXTrash` + `runStep` in `src/app/(payload)/api/cron/cleanup/route.ts:25-37` (and its entry
   in `steps` / the response; route test case).
5. `fateOf` (`src/components/trash/trash-section.tsx:7`) hard-codes „kosztorys w użyciu" for
   `!autoPurges` — irrelevant if workers always auto-purge.

Retention `ENTITY_TRASH_RETENTION_DAYS = 30` (`src/lib/constants/trash.ts:2`); the serial loop
`purgeTrashedRows` (`src/lib/cron/purge-trashed-rows.ts:12-35`).

#### 1.4 The users collection today

`src/collections/users.ts`:

- Auth (:80-91): `tokenExpiration: 604800`, custom forgot-password mail; everything else is Payload
  defaults — `useSessions: true`, `maxLoginAttempts: 5` (`node_modules/payload/dist/collections/config/defaults.js:136-145`).
  No `beforeLogin`.
- Hooks (:92-97): `beforeChange: [guardDefaultRegister]`, `beforeDelete: [preventDeleteWithReferences]`,
  `afterChange`/`afterDelete` revalidate `users`.
- **Delete probe (:25-76), inline in `makePreventDelete`** — not an exported blocker like
  `cashRegisterDeleteBlocker`. Probes: live transactions as worker / createdBy / updatedBy;
  `amount-edits.editedBy`; **`cash-registers.owner` — any owned kasa, empty or trashed (:52-56)**;
  `countStageMemberships` (`kosztorys_stage_workers`, :57-60, since `e06fe7ad`); `countReportsByWorker`
  (:61-65, since `5b856f81`); `equipment-events.holder`. Message ends „odznacz „Aktywny"".
  Authorship (media uploader, snapshot `takenBy`) deliberately not a blocker (:22-24, `4a1f8168`).
- Access (:107-113): read/create/admin A/O/M, `update: canUpdateUser`, `delete: isAdminOrOwner`.
  `canUpdateUser` (`src/access/index.ts:45-49`): A/O anyone, MANAGER only `{role: EMPLOYEE}`, others
  only self. `role` / `active` field access A/O (:133-148).
- `toggle-active.ts:25,43-52` runs under `MANAGEMENT_ROLES` with `overrideAccess: true` — a MANAGER can
  already deactivate an OWNER.

#### 1.5 Reference data and the name map

- Users SQL (`src/lib/queries/reference-data.ts:77-81`):
  `SELECT id, name, role::text, active::boolean, email, default_cash_register_id::integer FROM users ORDER BY name`
  → `WorkerRefT` (:133-142). Every user, no trash notion. Kasy were split at :53-58 / :110-114 into
  `cashRegisters` + `trashedCashRegisters` (`src/types/reference-data.ts:55-56`). Cache key
  `reference-data-v3` (:166), tags `users` + `cashRegisters` — bump the key on a shape change
  (:163-165).
- `transfer-mapping.ts:36` resolves worker and createdBy names from `toNameMap(refData.workers)`
  (:102-103); kasy already read the union (:33-34, :97-98).
- Lesson to apply as written (`context/foundation/lessons.md:2425-2430`): split at the source into live
  - `trashed…` twin, every existing reader keeps the live list, only id→name resolvers read the union,
    split **upstream** of `activeOrSelected`, pair with a write gate in the collection hook.

### 2. The worker + kasa pair

Facts the design must absorb:

- **A worker can own several kasy, of any type.** `cash_registers.owner_id` is NOT NULL and nothing
  limits a user to one WORKER kasa — AUXILIARY, VIRTUAL, even MAIN (which `findVisibleRegister` hides
  from a MANAGER). Locally, user 64 owns an AUXILIARY kasa.
- **Half-trash on refusal.** `withPayloadTransaction` commits whenever `work` _returns_
  (`src/lib/db/with-payload-transaction.ts:33-35`); `trashCashRegister` returns its refusal. Trashing
  kasa A then being refused on kasa B commits A. The worker core must probe every kasa (and the worker)
  before the first write, or throw to roll back.
- **Swallowed errors poison a shared transaction.** `deleteTrashedCashRegister` catches its own errors;
  inside a shared `req` a caught Postgres error leaves the transaction aborted (25P02) and the next
  statement fails confusingly. Delete-forever of the pair must not rely on catch-and-continue.
- **Order of hard deletes.** The users probe counts trashed kasy too, so the pair's delete-forever and
  purge must delete the kasy first, then the user, in one `req`. The cron already runs the kasa purge
  step before any later step (`route.ts:27-30`).
- **No record of the pairing.** Nothing marks a kasa as „trashed with worker N". Consequences: `/kosz`
  lists it as an independent „Kasy" row with its own Przywróć / Usuń; restoring it alone gives a live
  kasa owned by a trashed user, which then makes the worker's purge return `blocked` every night;
  restoring the worker cannot tell which of their trashed kasy to bring back with them.
- **The 404 dashboard trap** (kosz-kas accepted it for a kasa alone): with the pair, the employee is
  trashed too, so it only matters if the employee can still log in — see §3.

### 3. Auth — a trashed user's sessions

| Step                                                 | File:line                                                                        | Hits DB for the user?                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `loginAction` → `payload.login`                      | `src/lib/actions/auth.ts:14-39`, `payload/dist/auth/operations/login.js:193-230` | yes; writes a session                                   |
| `getCurrentUserJwt`                                  | `src/lib/auth/get-current-user-jwt.ts:31-57`                                     | **no** — `jwtVerify` only, ignores `sid`                |
| `requireAuth` (41 files), `protectedAction`, layouts | `require-auth.ts:15-27`, `run-action.ts:84`, `(frontend)/layout.tsx:52-53`       | no                                                      |
| `proxy.ts`                                           | `src/proxy.ts:5,21,37`                                                           | no — cookie presence only; excludes `/admin`, `/api`    |
| `/admin`, REST                                       | `payload/dist/auth/strategies/jwt.js:64-81`                                      | yes — `findByID` + `sid` must exist in `users_sessions` |
| `(share)` routes `/p/`, `/k/`, `/zgloszenie-prac/`   | token readers                                                                    | token only                                              |

- History: `56591165` (2026-02-16) replaced a `payload.auth`-based `getCurrentUser` with the JWT-only
  read during the M21 performance push (`4b30937d`); no auth latency was ever measured. The trade-off
  is only in the docstring (`get-current-user-jwt.ts:23-30`). `active` came later (`9e60815e`) and was
  wired into lists only.
- **`active` is enforced nowhere in auth.** No reference in `src/lib/auth`, `src/access`, `proxy.ts`,
  `auth.ts`, `run-action.ts`. A deactivated user — any role — can log in and act today. The only
  server-side `active` gate in the app is the report-share refusal
  (`src/lib/kosztorys/worker-report/share-refusal.ts:14`).
- Payload 3.73: deleting a user's `users_sessions` rows makes `payload.auth`, `/api/users/me` and
  `/admin` reject an otherwise valid token immediately. Our app path ignores it — even after
  `logoutAction` revokes the session, a copied cookie works until `exp`.
- `beforeLogin` runs after the session is written; a throw makes Payload revoke it and roll back
  (`login.js:243-251, 323-333`). `loginAction` maps every error to „Nieprawidłowy email lub hasło"
  unless given a new `error.name` branch (`auth.ts:28-37`).
- A cookie whose user was hard-deleted degrades, it doesn't crash: FK violations on writes stamping
  `user.id` map to the generic message (EX-928 fix, `src/lib/actions/action-failure.ts:21-33`). One
  real crash: `/zgloszenia` awaits `markSeen` → `INSERT INTO notification_reads` (FK to users) inside
  the page render (`src/app/(frontend)/zgloszenia/page.tsx:32-33`, `src/lib/db/notifications.ts:142-147`).
- Warm Neon read ≈ 20 ms (`context/foundation/lessons.md:1580`, EX-597).

| Option                                                        | Closes                                                     | Touches                                                                         | Per-request cost                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| (a) `beforeLogin` refuses trashed (+ inactive?)               | new logins — app, admin, REST                              | `users.ts` hook, `auth.ts` message branch                                       | 0                                                                         |
| (b) delete `users_sessions` on trash + `sid` check in the app | existing sessions everywhere (rows alone close admin/REST) | trash action, `get-current-user-jwt.ts`, maybe `tags.ts`                        | one indexed read, or 0 cached                                             |
| (c) `trashed_at` (+`active`) check in `getCurrentUserJwt`     | existing app sessions and app logins; admin/REST stay open | `get-current-user-jwt.ts`, `tags.ts` + entity-tag bumps on trash/restore/toggle | one read, or 0 cached (`entityTag('user', id)` needs a new `EntityNameT`) |
| (d) accept the 7-day window                                   | nothing                                                    | —                                                                               | 0                                                                         |

What an unclosed window actually allows: a trashed user's session can still create rows stamped with
their id (`createdBy`), which makes them **used** while in the trash. The `beforeDelete` re-count then
refuses delete-forever and the purge logs `blocked` — fail-safe, not data loss. (a)+(b-rows-only)
closes logins and `/admin` at zero per-request cost and leaves only the app session window.

### 4. Readers

Full inventory: 55 reader sites. What a trash changes, grouped:

- **Pickers — must not offer a trashed worker** (all fed by `refData.workers`, so the split fixes them
  at the source): PAYOUT worker (`expense-form.tsx:341-342`), kasa owner
  (`cash-register-form.tsx:80-85`), equipment holder (`equipment-target-field.tsx:92`), stage-split
  „add" (`stage-split-dialog.tsx:62`, hard `isActiveRef` filter), sheet-import worker pick
  (`sheet-import-dialog.tsx:196`, hard `isActiveRef` filter), transfer filters
  (`build-filter-config.ts:24-25`), manager dashboard „Dodane przez" (`queries/dashboard.ts:18-20`),
  workers menu (`kosztorys-workers-menu.tsx:27-29` → `assigned-workers.ts:13-32`, skips an id with no
  name). Shared combobox `entity-combobox-field.tsx:64-105` applies `activeOrSelected` — a widenable
  hint, never the trash filter.
- **Listings / detail:** `/pracownicy` (`pracownicy/page.tsx:16-31`), `/pracownicy/[id]`
  (`[id]/page.tsx:41-42` → 404 via `refData.workers.find`), `/kasy` owner names
  (`queries/cash-registers.ts:8-22`), employee dashboard redirect (`(dashboard)/page.tsx:17-22`),
  `default-cash-register.ts:9-13`.
- **id→name resolvers over history — must read live + trashed:** `transfer-mapping.ts:36` (worker +
  createdBy on **cancelled** rows; also feeds print and invoice download via `fetch-transfer-rows.ts`),
  `kasa/[id]/page.tsx:62-64` and `queries/cash-registers.ts:13-17` (owner of a kasa trashed with
  them), `settle-payouts.ts:60`, `payouts-by-worker.ts:33`, `subcontractor-summary.ts:93`,
  `stage-header.tsx:71`, `stage-split-dialog.tsx:59`, `assigned-workers.ts:18`. For an _unused_ worker
  only the first two can actually hit a trashed id; the rest are safe on either list but cheaper to
  reason about on the union.
- **Already see everyone (raw SQL joins / Payload find):** `lib/db/equipment.ts:42,123-124`,
  `lib/db/worker-reports.ts:74-75` (`decided_by`), `kosztorys-snapshots.ts:108-136` (`takenBy`),
  `sheets-sync.ts` depth-1 population → `tab-rows.ts:107`, `worker-kosztorys.ts:53-61`. Leave
  unfiltered — non-blocking authorship names must survive.
- **Unreachable for an unused worker:** `countPendingReports` (`worker-reports.ts:203-210`),
  `owedWorkersByInvestment` (`queries/investments.ts:26-35`), payout pairs
  (`lib/db/worker-payout-pairs.ts:46-66`), `copyStageSplit` (`kosztorys-add-menu.tsx:96`), stage
  members (`kosztorys-tree.ts:88-95`) — all require a use the trash predicate forbids.
- **Share links:** `/p/` (`worker-kosztorys.ts:136-155`) checks only the investment's trash; the report
  link checks `active` (`worker-report-share.ts:17-40`). A share for a worker with no stage membership
  can't be minted (`resolveWorkerScope` refusal), so an unused worker holds a share only if it outlived
  their membership; locally `kosztorys_worker_shares` has 0 rows. Delete-forever cascades shares away.
- **Not users:** `notification-recipients` is free-text emails (`src/globals/notification-recipients.ts:16`).

### 5. Write gates

Every path that assigns a user id accepts any existing id today. Writes that can name a **trashed**
worker (stale form, REST, re-attach) and so need a gate, mirroring `trashedRegisterMessage`:

| Path                                                                                    | File:line                                                                                                | Column                                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Transfers `validate` hook (PAYOUT worker; create + bulk + settle-payouts all land here) | `src/hooks/transfers/validate.ts:57`, kasa gate template :101-115                                        | `worker_id`                                                                        |
| Add stage / update stage split                                                          | `src/lib/actions/kosztorys.ts:657-709, 756-792` → `src/lib/db/stage-split.ts:20-70`                      | `kosztorys_stage_workers.worker_id`                                                |
| Snapshot restore / apply preset / sheet import                                          | `src/lib/kosztorys/insert-kosztorys-tree.ts:37-49` (`liveWorkerIds`: `SELECT id FROM users … FOR SHARE`) | stage members — add `AND trashed_at IS NULL`; it already drops and counts dead ids |
| Equipment create / transfer                                                             | `src/lib/actions/equipment.ts:16-55, 72-87`, hook `src/hooks/equipment/validate.ts:21-66`                | `holder_id`                                                                        |
| Kasa create / owner                                                                     | `src/lib/actions/cash-registers.ts:30-65`, `guard-update.ts:15-38`                                       | `owner_id`                                                                         |
| Worker update while trashed                                                             | `src/lib/actions/workers.ts:27-44`, `toggle-active.ts:45-52`                                             | users row — freeze like `guardCashRegisterUpdate`                                  |

Session-user stamps (`createdBy`, `updatedBy`, `editedBy`, `decided_by`, `taken_by`, media
`createdBy`) are governed by §3, not by a gate. Share mint and report submit need a stage membership,
which the stage gate already forbids.

### 6. Delete forever / purge cascade

Of `users.id` references, on an _unused_ worker: `transactions.worker_id` / `created_by_id` /
`updated_by_id` on cancelled rows → SET NULL (names lost on the cancelled audit view — the same cost
the owner accepted for kasy); `media.created_by_id`, `kosztorys_snapshots.taken_by`,
`equipment_events.created_by_id`, `worker_reports.decided_by` → SET NULL; `kosztorys_worker_shares`,
`worker_report_shares`, `notification_reads`, `users_sessions`, `payload_preferences_rels`,
`payload_locked_documents_rels` → CASCADE; legacy `kosztorys_stages.worker_id` (unprobed, EX-945) →
SET NULL; `cash_registers.owner_id` NOT NULL → must go first.

Tags: trash/restore `users` + `cashRegisters`; delete forever adds `transfers` (cancelled rows lose
FKs), `equipmentEvents` (`created_by` nulled), and whatever the snapshot/report readers are tagged with.

## Code References

- `src/lib/cash-registers/trash-cash-register.ts:7-32` — the seam
- `src/lib/cash-registers/delete-cash-register-forever.ts:15-48` — delete-forever with optional `req`
- `src/lib/db/with-payload-transaction.ts:33-35` — commits on a returned refusal
- `src/lib/actions/cash-register-trash.ts:18-101` — action shape to mirror
- `src/hooks/cash-registers/guard-update.ts:15-38` — freeze-while-trashed guard
- `src/hooks/transfers/validate.ts:57,101-115` — worker field; trashed-kasa gate template
- `src/lib/db/cash-register-gate.ts:7-16` — `trashedRegisterMessage` template
- `src/collections/users.ts:25-76,80-113,133-148` — delete probe, auth, access, field access
- `src/access/index.ts:45-49` — `canUpdateUser`
- `src/lib/actions/toggle-active.ts:25,43-52` — `overrideAccess` toggle
- `src/lib/queries/reference-data.ts:53-58,77-81,110-114,133-142,163-171` — split template, users SQL, cache key
- `src/lib/queries/transfer-mapping.ts:33-36,97-103` — name maps
- `src/lib/queries/trash.ts:17-68`, `src/components/trash/trash-kinds.ts:26-60`, `src/types/trash.ts:1-17` — /kosz kinds
- `src/app/(payload)/api/cron/cleanup/route.ts:25-37`, `src/lib/cron/purge-trashed-rows.ts:12-35` — purge
- `src/lib/auth/get-current-user-jwt.ts:23-57` — DB-free auth
- `src/lib/actions/auth.ts:14-46` — login / logout
- `node_modules/payload/dist/auth/strategies/jwt.js:64-81` — Payload's `sid` check
- `src/lib/kosztorys/insert-kosztorys-tree.ts:37-49` — `liveWorkerIds`
- `src/lib/db/stage-split.ts:20-70`, `src/lib/actions/kosztorys.ts:657-792` — stage assignment writes
- `src/hooks/equipment/validate.ts:21-66` — holder writes

## Architecture Insights

- **The trash predicate does the gating work.** Because only an unused worker can be trashed, most
  readers can never meet one; the plan should name the reachable ones (cancelled-row names, pickers,
  stale-form writes, re-attach on restore, sessions) and not gate the rest „for symmetry".
- **One predicate, extracted.** The users probe is inline in `makePreventDelete`; the kasa precedent
  exported it as a `makeDeleteBlocker` blocker so trash, delete-forever and purge share it. The worker
  variant differs in exactly one probe: owning a kasa blocks only if that kasa is itself used.
- **Probe-all-then-write** for a multi-row trash: a refusal must be decided before the first write,
  because the transaction helper commits on return.
- **Split, don't filter** for `refData.workers` — it is both the pickers' list and the name map
  (lessons.md:2425-2430). Bump `reference-data-v3`.
- **Fail-safe direction holds:** anything that slips past (a session writing while trashed) makes the
  worker _used_, and the `beforeDelete` re-count turns delete-forever / purge into a refusal.

## Historical Context (from prior changes)

- `context/archive/2026-09-30-kosz-kas/change.md:22-31`, `plan-brief.md:26-39,79,97-98`,
  `review-gate.md:18-19` — pair ruling, the seam, the two dismissals parked on EX-918.
- `context/archive/2026-09-24-kosz-inwestycji/change.md:30,38,43-50` — 30-day purge, typed name only for
  a used kosztorys, one shared `/kosz`, no generic abstraction.
- `context/archive/2026-09-29-kosz-inwestycji-manager/change.md:19-24` — MANAGER parity.
- `context/changes/2026-09-29-kosz-pozostalych-encji/research.md:431-441` — trash = mistaken/never-used
  only; `active` stays the way to leave; parity over OWNER/ADMIN rows deferred to this change.
- `context/foundation/lessons.md:2236-2253` — hand-rolled `trashed_at`, fail open.
- `context/archive/2026-09-30-worker-work-reports/change.md:265,270-272` — a report blocks the worker's
  delete; the report link requires an active worker.
- `context/changes/2026-09-30-kosztorys-stage-worker-split/plan.md:26,81-83,126-131` — stage
  memberships table, legacy column dropped by EX-945, restore drops deleted users.
- `context/reference/kosztorys-editor-domain-notes.md:389-395` — `/p/` link revoked only deliberately
  (EX-888).
- Commits `56591165` / `4b30937d` (JWT-only auth), `9e60815e` / `325b3e40` (`active`), `4a1f8168`
  (self-delete removed, authorship non-blocking), `7728e424` (cancelled rows exempt), `5ed25d5d`
  (`canUpdateUser`).
- `context/foundation/test-plan.md` — risk #15 (a trashed entity leaking back) is the row to extend;
  #19 covers an inactive worker on the report link; nothing covers login/auth.

## Related Research

- `context/changes/2026-09-29-kosz-pozostalych-encji/research.md` (umbrella, §6)
- `context/changes/2026-09-22-kosz-plikow/research.md` (file trash; separate retention constant)

## Local data (prod dump on 5433, read-only)

Users by role: ADMIN 1, OWNER 2, MANAGER 3, EMPLOYEE 40 active + 6 inactive.

| id                 | role     | active | owned kasy         | note                                     |
| ------------------ | -------- | ------ | ------------------ | ---------------------------------------- |
| 20, 23, 26, 29, 61 | EMPLOYEE | no     | —                  | 20 has one expired session               |
| 37                 | EMPLOYEE | yes    | —                  |                                          |
| 46                 | EMPLOYEE | yes    | 31 (WORKER, empty) | the pair case                            |
| 66                 | OWNER    | yes    | —                  | QA temp owner (2026-09-30), live session |

Blocked only by a used kasa: 35 (kasa 13, 41 tx), 42 (15, 3 tx), 44 (29, 34 tx), 64 (AUXILIARY 40, 3 tx).
Blocked only by a CANCELLATION's `createdBy`: nobody. `users_sessions`: 13 rows, 7 live.
`kosztorys_worker_shares`: 0. `worker_report_shares`: 2 (both workers used).

**Local migration drift (prerequisite check):** the local DB recorded `20260930_2_cash_register_trashed_at`,
but the file is `20260930_3_cash_register_trashed_at.ts` (and `_2` is now `add_worker_reports`). A local
`payload migrate` will see `_3` as pending; it is `IF NOT EXISTS`, so re-running is harmless, but check
`_payload_migrations` before adding this change's migration.

## Open Questions

1. **Auth level.** (a) `beforeLogin` refusal + deleting the user's `users_sessions` rows on trash
   (closes login, `/admin`, REST; app session window stays ≤ 7 days, fail-safe) — or also (c) a DB
   check in `getCurrentUserJwt`? And does the refusal cover `active = false` too? Today a deactivated
   user can log in, which is a pre-existing gap independent of the trash.
2. **MANAGER parity over non-EMPLOYEE rows.** Trash an OWNER / ADMIN / MANAGER as a MANAGER (full parity,
   matches `toggle-active` today), or follow `canUpdateUser` (MANAGER → EMPLOYEE only)?
3. **Guards.** Refuse self-trash; refuse trashing the last active OWNER/ADMIN (locally 2 OWNER + 1 ADMIN,
   and OWNER 66 is itself trashable).
4. **Pair representation.** How does a kasa remember it went with its worker — a column on
   `cash_registers` (e.g. the worker id it was trashed with), or the identical `trashed_at` instant?
   On `/kosz`: hide the paired kasa from „Kasy" and show it on the worker's row, or show it in both with
   restore/delete of the kasa alone refused while its owner is trashed?
5. **Several owned kasy.** All owned kasy must be unused for the worker to go; include AUXILIARY /
   VIRTUAL / MAIN ones in the pair, or refuse a worker who owns a non-WORKER kasa?
6. **Delete-forever confirm** — plain (as kasy) or typed name? An unused worker loses only names on
   cancelled rows and authorship stamps.
7. **Auto-purge after 30 days** — yes by default (a trashable worker is unused by definition), unless
   the auth window or the pair make manual-only safer.

## Follow-up — owner answers (2026-10-01)

| #   | Question                 | Answer                                                                                                                     |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Auth                     | **(a)** — `beforeLogin` refuses a trashed user and the trash deletes their `users_sessions` rows. No per-request DB check. |
| 2   | MANAGER over other roles | A MANAGER trashes **EMPLOYEE only** (matches `canUpdateUser`); A/O trash any role.                                         |
| 3   | Guards                   | Refuse self-trash; refuse trashing the last OWNER/ADMIN. **Also enforce in the Payload admin** (see below).                |
| 6   | Delete-forever confirm   | **Typed name, for every kind in `/kosz`** — one behaviour across the page.                                                 |
| 7   | Auto-purge               | **Yes, 30 days**, and the policy must be the same for every kind.                                                          |

### Payload admin today (for Q3)

`users.access.delete = isAdminOrOwner` (`src/collections/users.ts:111`), no self check since
`4a1f8168` dropped `isAdminOrOwnerOrSelf`, and no last-owner check anywhere. So in `/admin` an OWNER/ADMIN
can delete their own account or the last OWNER, provided the reference probe passes (an unused account
passes). The guard belongs in the users `beforeDelete` hook — it then covers `/admin`, REST, the
in-app delete-forever and the purge with one predicate. The same self/last-owner rule should gate
`trashedAt` writes (trash action + a `beforeChange` guard), since `/admin` can also write fields.

### Kasy actually owned by employees (for Q4/Q5)

Local DB: 20 employees own a WORKER kasa, **7 own an AUXILIARY kasa** — six of them own only an
AUXILIARY one, user 24 owns both (WORKER 18 + AUXILIARY 38). MAIN and VIRTUAL kasy are owned only by
OWNER/MANAGER (16, 17). With the Q2 ruling, a MANAGER never trashes an account owning MAIN; an A/O may.
„Own kasa" is therefore not „the WORKER kasa" — any type can be an employee's.

### Current `/kosz` policy matrix (for Q6/Q7)

| Kind       | Typed name on delete forever    | Auto-purge after 30 days                 |
| ---------- | ------------------------------- | ---------------------------------------- |
| Inwestycja | only when its kosztorys is used | only when its kosztorys is unused        |
| Szablon    | always                          | yes (a szablon's kosztorys isn't „used") |
| Kasa       | never (plain confirm)           | yes                                      |

Making Q6 uniform changes kasy (plain → typed) and unused investments (plain → typed). Making Q7
uniform literally would auto-delete an investment with a used kosztorys — the one exception kosz-inwestycji
deliberately carved out. **An investment-trash change is in flight in the shared tree right now**
(uncommitted edits to `investment-trash.ts`, `trash-kinds.ts`, `queries/trash.ts`, `types/trash.ts`,
`constants/trash.ts`, plus `isUndeletableStatus` for active investments) — the policy unification must
land after it, not on top of it.

## Follow-up — owner answers, round 2 (2026-10-01)

| #   | Question               | Answer                                                                                                                                                                                                                                                                                  |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | Pair in `/kosz`        | The kasy trashed with a worker show **under the worker's row**, not as separate „Kasy" rows; they restore and delete together with the worker.                                                                                                                                          |
| 5   | Several kasy           | The worker goes with **all** owned kasy, any type, only if every one is empty; one used kasa refuses the trash.                                                                                                                                                                         |
| 6   | Delete-forever confirm | Typed name for every kind (kasy and unused investments switch from plain confirm).                                                                                                                                                                                                      |
| 7   | Auto-purge             | One stated rule: every kind deletes itself after 30 days **except an item still holding real work**, which waits for a manual delete. Kinds keep their own „real work" check — today only an investment with a used kosztorys can hit it, since workers and kasy enter the trash empty. |

Sequencing: the cross-kind changes (typed name for kasy/investments, the shared `fateOf` wording) land
after the in-flight investment-trash edits in the shared tree are committed.
