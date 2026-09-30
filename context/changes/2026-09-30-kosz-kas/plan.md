# Trash for an unused kasa (EX-917) Implementation Plan

## Overview

Trash / restore / delete-forever for a cash register with no live transactions, a „Kasy" section in
`/kosz`, a „Do kosza" entry on `/kasy`, and a 30-day auto-purge. It also carries the shared prep the
second trash kind owes: the UI-level `TRASH_KINDS` table and moving the retention constant out of
`investment-lock.ts`. It leaves a seam for EX-918 (worker + empty kasa trashed together).

## Current State Analysis

Full map in `research.md`. The load-bearing facts:

- Four FKs point at `cash_registers.id`, all nullable and none blocking. The source/target register
  FKs on `transactions` and `users.default_cash_register_id` are `SET NULL`;
  `payload_locked_documents_rels` is `CASCADE` (research §1).
- „Unused" already exists as the inline `beforeDelete` probe in `src/collections/cash-registers.ts:16-29`.
  It counts live transactions only; cancelled rows have been exempt since `7728e424`.
- `fetchReferenceData` (`src/lib/queries/reference-data.ts:53-57,99-105`) is **both** the picker
  source and the name map for transaction rows (`transfer-mapping.ts:32` → `lookupName`, fallback „—").
  Filtering trashed kasy out of its SQL would blank the kasa name on their cancelled rows.
- Nothing refuses a booking into a given kasa. `validateSourceRegister` checks that the kasa exists;
  `targetRegister` is not validated at all. When a user's default kasa is filtered out of a picker,
  the picker looks empty while the form value still holds the id (research §3 pitfall).
- The kasa owner can be changed today (`edit-cash-register-dialog.tsx:30` → `updateCashRegisterAction`),
  which contradicts „a kasa cannot be handed over".
- The investment trash is the pattern to mirror, per layer:
  - actions: `src/lib/actions/investment-trash.ts`;
  - DB: `src/lib/db/investment-trash.ts`;
  - query: `src/lib/queries/trash.ts`;
  - purge: `src/lib/investments/purge-trash.ts`;
  - cron step: `src/app/(payload)/api/cron/cleanup/route.ts:26`;
  - UI: `src/components/trash/*`.

## Desired End State

- A MANAGER, OWNER or ADMIN can send a kasa with no live transactions to the trash from `/kasy`.
- A kasa with live transactions is refused with a readable sentence.
- A trashed kasa disappears from:
  - `/kasy` and the dashboard tiles;
  - every picker and filter;
  - its `/kasa/[id]` page (404);
  - the employee dashboard redirect.
- A trashed kasa keeps its name on its cancelled transaction rows, without a link.
- The trashed kasa cannot receive a booking. The transfers hook refuses it with a readable sentence,
  including from a stale form or a stale default.
- It cannot be edited, and it cannot be set as anyone's default kasa.
- Trashing clears it as a default kasa; restoring does not bring the default back.
- `/kosz` shows a „Kasy" section with Przywróć and „Usuń na zawsze" (a plain confirm) and a countdown.
- A MANAGER sees no MAIN kasa there, and the actions refuse MAIN for a MANAGER.
- The daily cron purges kasy trashed more than 30 days ago.
- A used kasa's owner cannot be changed: the hook refuses it and the edit dialog disables the field.

Verify with the specs listed per phase, plus the manual checks.

### Key Discoveries:

- `src/lib/db/delete-blocker.ts:46-72`: `makeDeleteBlocker` forwards `req`, so a caller that deletes
  the kasa before its owner in one transaction (EX-918) is counted on in-transaction state.
- `src/hooks/transfers/validate.ts:66-76`: the investment gate throws `APIError(msg, 403)`. The message
  reaches the toast through `toActionFailure`, so no action-level mirror is needed for readability.
- `src/hooks/transfers/validate.ts:79-98`: a CANCELLATION row nulls `sourceRegister`, and a cancelled
  update returns early. The kasa gate goes **after** both, so a cancelled row that points at a
  trashed kasa (the only kind that can) stays cancellable and invoice-attachable.
- `src/collections/users.ts:46-53`: the users delete probe must keep counting trashed kasy
  (`owner_id` is NOT NULL). Do not add a trash filter there.
- `src/lib/utils/is-active-ref.ts:11-17`: `activeOrSelected` keeps a selected id. The trash is a hard
  exclusion that must happen **before** it, i.e. upstream, in the ref data.
- `entityTag('cash-register', id)` has no cached reader. Do not invent one; `collection:cash-registers`
  is the right tag here.
- `cash_registers.name` is not unique, so a restore cannot collide.

## What We're NOT Doing

- **EX-918, the pair (worker + kasa).** Only the seam: a req-aware trash core and a req-aware
  delete-forever.
- **Handing a kasa over to another owner.** The opposite: a used kasa's owner is locked.
- **Flota and sprzęt trash**, and any generic backend trash abstraction. `TRASH_KINDS` is UI/copy only.
- **Per-kasa entity tags.**
- **`filterOptions` on the Payload admin relationship fields.** The admin panel is unused.
- **An E2E spec.** Browser-level risk is covered at the DOM layer plus the DB action specs (as in the
  kosz-inwestycji-manager precedent). If the review gate asks for one, it goes to the `e2e-backlog`.
- **Splitting `INVESTMENT_TRASH_TAGS`.**
- **Fixing the 21 employees who already have no WORKER kasa.** That is pre-existing state.

## Implementation Approach

Server gates first, so every later phase lands on a schema that already refuses the dangerous writes.
Then the readers (the name-map split). Then the trash backend (actions, purge, cron). Then the UI and
docs. Each phase is independently green.

## Critical Implementation Details

**The name map vs the pickers.** Split `ReferenceDataT.cashRegisters` into:

- `cashRegisters`: live only, so every existing picker or listing consumer is fail-safe by default;
- `trashedCashRegisters`.

Only `transfer-mapping.ts` reads the union. A new consumer cannot forget a filter on a list that
never contained the trashed kasa; this is risk #15 turned into a default.

**The default-kasa clear bypasses the users hooks.** It is raw SQL inside the trash transaction, so
the `users` tag must be on the trash action's tag list, not left to `afterChange`.

## Phase 1: Schema and server gates

### Overview

The `trashed_at` column plus every server-side refusal. The column can hold a value but no app path
sets it yet. After this phase a trashed kasa (set in a spec) cannot be booked into, edited, or made a
default, and a used kasa's owner cannot change.

### Changes Required:

#### 1. Migration + collection field

**File**: `src/migrations/<next>_cash_register_trashed_at.ts` (+ `src/migrations/index.ts`),
`src/collections/cash-registers.ts`

**Intent**: Hand-written, additive nullable column, mirroring `20260928_0_investment_trashed_at.ts`.

**Contract**:

- `cash_registers.trashed_at timestamp(3) with time zone NULL`; `down` drops it.
- Field `trashedAt` (`type: 'date'`, `admin.hidden`), mirroring `investments.ts:161-166`.
- Take the next free prefix at implement time. Run `git status src/migrations` in the **main**
  checkout before migrating the shared local DB.

#### 2. Lift the delete probe into a shared blocker

**File**: new `src/lib/cash-registers/delete-blocker.ts`; `src/collections/cash-registers.ts`

**Intent**: One predicate for „unused", shared by `beforeDelete`, the trash action, the purge and the
owner lock.

**Contract**:

- `export const cashRegisterDeleteBlocker: DeleteBlockerT`: the same probe and message as today.
- The collection's hook becomes `beforeDelete: [refuseDeleteWhen(cashRegisterDeleteBlocker)]`.
- `cash-registers-delete-guard.test.ts` stays green, unchanged.

#### 3. Kasa trash constants

**File**: new `src/lib/constants/trash.ts`

**Intent**: A Payload-CLI-graph-safe home, because collection hooks import it. The retention move
itself is in Phase 3; this file starts with the kasa sentences.

**Contract**:

- `CASH_REGISTER_TRASHED_MESSAGE` = „Kasa jest w koszu — przywróć ją, żeby coś zmienić."
- `CASH_REGISTER_OWNER_LOCKED_MESSAGE`, in the sense of „Nie można zmienić właściciela kasy, która ma
  transakcje."

#### 4. Kasa gate query

**File**: new `src/lib/db/cash-register-gate.ts`

**Intent**: The kasa twin of `investment-gate.ts`: one statement that answers „is any of these kasy
trashed".

**Contract**:

- `trashedRegisterMessage(db: DbExecutorT, ids: number[]): Promise<string | undefined>`.
- It returns `CASH_REGISTER_TRASHED_MESSAGE` when any id has `trashed_at IS NOT NULL`, and returns
  early on an empty list.

#### 5. Transfers write gate

**File**: `src/hooks/transfers/validate.ts`

**Intent**: Refuse a booking that names a trashed kasa. This is the real guarantee; the picker
filtering in Phase 2 only hides.

**Contract**:

- Placement: after the CANCELLATION and cancelled-update early returns.
- Scope: for `sourceRegister` / `targetRegister`, only when `operation === 'create'` or the
  resolved id differs from `original`.
- Refusal: `APIError(message, 403)`.
- An invoice-only patch never reaches the gate (its ids equal the original's).

#### 6. Cash-register update guard

**File**: new `src/hooks/cash-registers/guard-update.ts`; wired in `src/collections/cash-registers.ts`
(`beforeChange`, `operation === 'update'` only)

**Intent**: A trashed kasa is read-only apart from its restore, and a used kasa keeps its owner.

**Contract**:

- **Trashed kasa:** when `originalDoc.trashedAt` is set and the resolved `trashedAt` (data if the key
  is present, else original) is still non-null, throw `APIError(CASH_REGISTER_TRASHED_MESSAGE, 403)`.
  A restore (`trashedAt: null`) passes.
- **Owner lock:** when the resolved owner id differs from `originalDoc.owner` and
  `cashRegisterDeleteBlocker(req.payload, id, req)` returns a message, throw
  `APIError(CASH_REGISTER_OWNER_LOCKED_MESSAGE, 403)`.

#### 7. Default-kasa guard on users

**File**: new `src/hooks/users/guard-default-register.ts`; wired in `src/collections/users.ts`
(`beforeChange`)

**Intent**: Stop a default from being pointed at a trashed kasa. This covers
`setDefaultCashRegisterAction`, `createWorkerAction` and `updateWorkerAction` in one place.

**Contract**:

- Refuse only when `defaultCashRegister` is present in `data`, resolves to an id different from
  `originalDoc`'s, and that kasa is trashed.
- The check is `trashedRegisterMessage`; the refusal is `APIError(CASH_REGISTER_TRASHED_MESSAGE, 403)`.
- The users delete probe stays untouched.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate`, after `git status src/migrations` in the
  main checkout.
- The transfers kasa gate refuses a trashed source and a trashed target on create, lets an unchanged
  trashed id through on update, and lets CANCELLATION through:
  `pnpm exec vitest run src/__tests__/hooks/transfers/validate-register-trash.test.ts`
- The cash-register update guard refuses an edit of a trashed kasa, allows a restore, refuses an
  owner change on a used kasa, and allows one on an unused kasa:
  `pnpm exec vitest run src/__tests__/collections/cash-registers-update-guard.test.ts`
- The users guard refuses a trashed default and allows an unchanged one:
  `pnpm exec vitest run src/__tests__/collections/users-default-register-guard.test.ts`
- The existing delete guard is still green:
  `pnpm exec vitest run src/__tests__/collections/cash-registers-delete-guard.test.ts`

#### Manual Verification:

- None separate. This phase is covered by the end-to-end checks in Phase 4.

**Implementation Note**: When automated verification passes, commit and continue.

---

## Phase 2: Readers

### Overview

A trashed kasa is gone from every picker, listing and detail page, and keeps its name on transaction
rows.

### Changes Required:

#### 1. Split the ref data

**File**: `src/lib/queries/reference-data.ts`, `src/types/reference-data.ts`

**Intent**: A live list for every consumer, and the trashed ones kept apart for the name map only.

**Contract**:

- SELECT `trashed_at` and partition the rows into `cashRegisters` (live) and `trashedCashRegisters`,
  both typed `CashRegisterRefT[]`.
- Cache key: `reference-data-v2` → `reference-data-v3`.
- `reference-data-sql-drift.test.ts` stays green.

#### 2. Name map keeps trashed kasy; rows flag them

**File**: `src/lib/queries/transfer-mapping.ts`, `src/components/tables/transfers.tsx:131-154`

**Intent**: A cancelled row pointing at a trashed kasa shows the kasa's name, but no link to the
404ing detail page.

**Contract**:

- The name map is built from `cashRegisters ∪ trashedCashRegisters`.
- The row gains `sourceRegisterTrashed` / `targetRegisterTrashed: boolean`.
- The link cell suppresses the link when the flag is set, the same as for „—".
- Exports and invoices (`fetch-transfer-rows.ts`, `fetch-transfers-for-invoices.ts`) inherit the name
  through the same mapping.

#### 3. Consumers

**File**: every consumer of `refData.cashRegisters`:

- `(dashboard)/page.tsx`
- `kasa/[id]/page.tsx`
- `pracownicy/page.tsx`
- `pracownicy/[id]/page.tsx`
- the deposit, expense and internal-transfer forms
- `settle-payouts-dialog.tsx`
- `queries/cash-registers.ts`
- `queries/settle-payouts.ts`
- `utils/build-filter-config.ts`

**Intent**: They already read the live list after the split. Verify each one compiles and needs no
change. None should read `trashedCashRegisters`.

**Contract**: No new reads. `(dashboard)` and `kasa/[id]` resolve to `notFound()` for a trashed kasa
by construction.

### Success Criteria:

#### Automated Verification:

- The mapping names a trashed kasa and flags it; a live kasa is unflagged:
  `pnpm exec vitest run src/__tests__/lib/queries/transfer-mapping.test.ts`
- The ref-data SELECT covers the mapped fields:
  `pnpm exec vitest run src/__tests__/reference-data-sql-drift.test.ts`

#### Manual Verification:

- None separate. This phase is covered by the end-to-end checks in Phase 4.

**Implementation Note**: When automated verification passes, commit and continue.

---

## Phase 3: Trash backend, purge, cron, retention constant

### Overview

The three actions, the listing SQL, the purge and its cron step, plus the constant move.

### Changes Required:

#### 1. Retention constant move

**File**: `src/lib/constants/trash.ts`, `src/lib/constants/investment-lock.ts`, and its readers:

- `queries/trash.ts`
- `investments/purge-trash.ts`
- `__tests__/helpers/investment.ts`
- `__tests__/lib/db/investment-trash.db.test.ts`

**Intent**: One entity-trash retention, under a name the planned `kosz-plikow` constant cannot collide
with.

**Contract**: `ENTITY_TRASH_RETENTION_DAYS = 30` in `constants/trash.ts`. `TRASH_RETENTION_DAYS` is
removed from `investment-lock.ts`.

#### 2. Kasa trash SQL

**File**: new `src/lib/db/cash-register-trash.ts`

**Intent**: Statements plus mappers only.

**Contract**:

- `fetchTrashedCashRegisters(db): Promise<TrashedCashRegisterRowT[]>` returns
  `{ id, name, type, trashedAt }`, ordered by `trashed_at DESC`.
- `selectPurgeableCashRegisterIds(db, olderThanDays): Promise<number[]>`.
- `clearDefaultRegister(db, id): Promise<void>` runs
  `UPDATE users SET default_cash_register_id = NULL WHERE default_cash_register_id = $id`.

#### 3. Trash core + delete-forever (the EX-918 seam)

**File**: new `src/lib/cash-registers/trash-cash-register.ts`,
`src/lib/cash-registers/delete-cash-register-forever.ts`

**Intent**: Req-aware cores that the actions wrap now and EX-918 composes later inside one
transaction.

**Contract**:

- `trashCashRegister(payload, id, req): Promise<string | undefined>` returns a refusal message or
  `undefined`, in this order:
  1. `cashRegisterDeleteBlocker`;
  2. `clearDefaultRegister`;
  3. `payload.update({ trashedAt: now }, { overrideAccess: true, context: SKIP_HOOK_REVALIDATION, req })`.
- `deleteTrashedCashRegister(payload, id, req?)` runs `payload.delete` with `overrideAccess`, so
  `beforeDelete` re-counts.

#### 4. Actions

**File**: new `src/lib/actions/cash-register-trash.ts`

**Intent**: Mirror `investment-trash.ts`: `protectedAction(MANAGEMENT_ROLES)` → `withPayloadTransaction`
→ idempotent `findByID` → core.

**Contract**:

- `trashCashRegisterAction(id)`, `restoreCashRegisterAction(id)`, `deleteCashRegisterForeverAction(id)`.
- A MANAGER on a MAIN kasa is refused, with the same not-found-style refusal the rest of the app gives
  a MANAGER for MAIN.
- Delete-forever refuses a kasa that is not trashed (`NOT_TRASHED_MESSAGE` pattern).
- Tags: `CASH_REGISTER_TRASH_TAGS = ['cashRegisters', 'users']` for trash/restore;
  `CASH_REGISTER_DELETE_TAGS` adds `'transfers'`. Both live in `src/lib/cache/tags.ts`.

#### 5. Purge + cron step

**File**: new `src/lib/cash-registers/purge-trash.ts`; `src/app/(payload)/api/cron/cleanup/route.ts`

**Intent**: A serial purge like `investments/purge-trash.ts`: count purged / blocked / failed, with
`TODO(EX-449) SENTRY-REQUIRED` on a failure, then `revalidateTag(tag, EXPIRE_NOW)` for the delete tags
once anything was purged.

**Contract**:

- `purgeCashRegisterTrash(payload, db)`.
- A new `runStep('cashRegisterTrash', …)`, with its result on the response as `cashRegisterTrash`.
- `ok` still means „no step threw", and a 500 still means „all steps threw".

### Success Criteria:

#### Automated Verification:

- Actions pin: MANAGER may trash, restore and delete an AUXILIARY kasa; MANAGER is refused on MAIN;
  EMPLOYEE is refused on all three; a live transaction blocks and a cancelled one does not; trash
  clears the default (persisted); restore round-trips without the default; delete-forever refuses a
  kasa that is not trashed and nulls the cancelled row's register:
  `pnpm exec vitest run src/__tests__/lib/actions/cash-register-trash.db.test.ts`
- Listing order and purge selection past and within retention:
  `pnpm exec vitest run src/__tests__/lib/db/cash-register-trash.db.test.ts`
- The purge deletes past-retention kasy only:
  `pnpm exec vitest run src/__tests__/lib/cash-registers/purge-trash.db.test.ts`
- The cron forwards the new step, and a partial failure gives `ok:false`:
  `pnpm exec vitest run "src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts"`
- The investment trash specs are still green after the constant move:
  `pnpm exec vitest run src/__tests__/lib/db/investment-trash.db.test.ts src/__tests__/lib/actions/investment-trash.db.test.ts`

#### Manual Verification:

- None separate. This phase is covered by the end-to-end checks in Phase 4.

**Implementation Note**: When automated verification passes, commit and continue.

---

## Phase 4: `/kosz` kinds, `/kasy` entry, owner-lock UI, docs

### Overview

The second trash kind in the UI, the entry button, the disabled owner field, and the living docs.

### Changes Required:

#### 1. Trash rows carry a kind

**File**: `src/lib/queries/trash.ts`

**Intent**: One uncached `getTrashContents()` returns the rows of both kinds with the fields the UI
switches on, instead of the UI deriving them from investment-only flags.

**Contract**:

```ts
type TrashRowT = {
  kind: TrashKindT
  id: number
  name: string
  trashedAt: Date
  daysLeft: number
  autoPurges: boolean
  mustTypeName: boolean
}
```

- `TrashKindT = 'investment' | 'template' | 'cash-register'`.
- Investment rows keep today's semantics (`mustTypeName` = kosztorys used or template; `autoPurges` =
  kosztorys not used).
- Kasa rows: `autoPurges: true`, `mustTypeName: false`.
- MAIN kasy are dropped for a MANAGER.
- The retention comes from `ENTITY_TRASH_RETENTION_DAYS`.

#### 2. `TRASH_KINDS` table

**File**: `src/components/trash/*` (the `trash-kinds.ts` constant beside them)

**Intent**: Replace the `isTemplate` ternaries with one `Record<TrashKindT, …>` holding:

- section title („Inwestycje" / „Szablony" / „Kasy");
- restore toast;
- delete-forever copy;
- the restore / delete-forever actions.

`trash-contents.tsx` renders one `TrashSection` per kind with rows. `fateOf()` reads `autoPurges`.
The dialog reads `mustTypeName`.

**Contract**:

- `trashed-investment-actions.tsx` becomes kind-agnostic (e.g. `trashed-row-actions.tsx`).
- The delete-forever dialog takes a `TrashRowT`.
- Kasa copy: „Kasa przywrócona.", and a plain confirm naming the kasa.

#### 3. „Do kosza" on `/kasy`

**File**: `src/components/tables/cash-registers.tsx`, a new `src/components/cash-registers/trash-cash-register-button.tsx`

**Intent**: Mirror `trash-investment-button.tsx`: a ghost `DeleteButton` with a neutral confirm, never
pre-disabled, and the server refusal toasted.

**Contract**: A new `actions` column on the `/kasy` table.

#### 4. Owner lock in the edit dialog

**File**: `src/lib/queries/cash-registers.ts`, a new `selectUsedRegisterIds(db)` in
`src/lib/db/cash-register-trash.ts`, `edit-cash-register-dialog.tsx`, `cash-register-form.tsx`

**Intent**: A used kasa's owner field renders disabled with a hint, so the user doesn't discover the
lock only via a refused save.

**Contract**:

- `fetchVisibleRegisters` rows gain `isUsed: boolean` (live transactions exist; the same predicate as
  the blocker, `cancelled IS NOT TRUE`).
- The form takes `isOwnerLocked`.

> **Addendum (review gate, 2026-09-30):** built differently. The edit dialog lives on `/kasa/[id]`,
> not on the `/kasy` rows, so the page computes `isOwnerLocked` from `cashRegisterDeleteBlocker` —
> the same predicate the update guard enforces. No `isUsed` column and no `selectUsedRegisterIds`.

#### 5. Docs

**Files**:

- `context/foundation/test-plan.md`: add a response row for risk **#15**. Every reader of a trashed
  kind is pinned by a live/trashed split at the source, and a write gate at the hook.
- `context/foundation/lessons.md`: add a lesson. A list that doubles as a name map is split
  (live + trashed), not filtered.
- `AGENTS.md`: no change, unless a fact it states becomes false.

**Intent**: Record the durable rationale.

### Success Criteria:

#### Automated Verification:

- `/kosz` renders the „Kasy" section only when there are kasa rows, uses a plain confirm for a kasa,
  and keeps the typed name for a used-kosztorys investment:
  `pnpm exec vitest run src/__tests__/components/trash/trash-contents.test.tsx src/__tests__/components/trash/delete-forever-dialog.test.tsx`
- The trash-rows query maps both kinds and drops MAIN for a MANAGER:
  `pnpm exec vitest run src/__tests__/lib/queries/trash.test.ts`

#### Manual Verification:

- On `/kasy` as MANAGER, „Do kosza" on an unused AUXILIARY kasa → it disappears from `/kasy`, the
  dashboard tiles, the expense/deposit/internal-transfer pickers and the transfer filters.
- „Do kosza" on a kasa with live transactions shows a refusal toast naming the count.
- A cancelled transaction on the trashed kasa still shows the kasa name in the transfers list, with
  no link. `/kasa/<id>` returns 404.
- An expense form left open from before the trash, submitted with that kasa, is refused with
  „Kasa jest w koszu…".
- A user whose default was the trashed kasa opens a new expense: the picker is empty and there is no
  hidden preselect.
- In `/kosz` → „Kasy", Przywróć brings it back everywhere, and the default stays cleared.
- In `/kosz` → „Kasy", „Usuń na zawsze" removes it for good.
- Editing a used kasa shows the owner field disabled. Editing an unused kasa lets the owner change.
- As MANAGER, a MAIN kasa never appears in `/kosz`.

Setup for these checks: `context/reference/manual-verification.md`. Local candidates (research §7):
kasa 6, kasa 42, and kasa 30 (which has a cancelled row).

**Implementation Note**: The final phase. Roll the manual bullets into
`context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests:

- The transfers kasa gate against a fake `drizzle.execute`, mirroring `validate-lock.test.ts`.
- The mapping's union name map and trash flags.
- The trash-rows kind mapping.
- DOM: the `/kosz` sections and the dialog's confirm mode.

### Integration Tests:

These run against the DB (5435) and go through `pnpm test:integration` discovery:

- the cash-register update guard and the users default guard;
- the three actions, with the role matrix and persisted state;
- the listing and purge SQL;
- the purge.

Generalise `trashDaysAgo(db, id, days)` over the table (e.g. a `table` parameter with an allow-list),
or add a kasa twin. Prefer generalising: there is one helper and two callers.

### Manual Testing Steps:

See the Phase 4 Manual Verification.

## Performance Considerations

`fetchReferenceData` keeps one query; the partition happens in JS. The owner lock is one count for
the one kasa `/kasa/[id]` shows.

## Migration Notes

Additive: on deploy, prod is migrated **before** the push (a human runs `pnpm db:migrate:prod`).
Existing rows get `trashed_at = NULL`, which means live. No backfill.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- DB integration suite passes: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-09-30-kosz-kas/research.md`
- Umbrella: `context/changes/2026-09-29-kosz-pozostalych-encji/research.md` § 5, § 6.4, § 7
- Pattern: `context/archive/2026-09-24-kosz-inwestycji/`, `context/archive/2026-09-29-kosz-inwestycji-manager/`
- `TRASH_KINDS` origin: `context/archive/2026-09-29-kosz-szablonow/review-gate.md:21,26`
- Linear: EX-917 (blocks EX-918)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and server gates

#### Automated

- [x] 1.1 Migration applies to the local DB — a628e120
- [x] 1.2 Transfers kasa gate spec passes — a628e120
- [x] 1.3 Cash-register update guard spec passes — a628e120
- [x] 1.4 Users default-kasa guard spec passes — a628e120
- [x] 1.5 Existing cash-register delete guard still green — a628e120

### Phase 2: Readers

#### Automated

- [x] 2.1 Transfer-mapping spec passes (trashed name kept + flagged) — 98bb3291
- [x] 2.2 Ref-data SQL drift spec passes — 98bb3291

### Phase 3: Trash backend, purge, cron, retention constant

#### Automated

- [x] 3.1 Cash-register trash actions DB spec passes — ae8ec8e7
- [x] 3.2 Cash-register trash SQL DB spec passes — ae8ec8e7
- [x] 3.3 Cash-register purge DB spec passes — ae8ec8e7
- [x] 3.4 Cron cleanup route spec passes with the new step — ae8ec8e7
- [x] 3.5 Investment trash specs still green after the constant move — ae8ec8e7

### Phase 4: `/kosz` kinds, `/kasy` entry, owner-lock UI, docs

#### Automated

- [x] 4.1 Trash DOM specs pass (kasa section, plain confirm, typed name kept for investments) — 57b1118b
- [x] 4.2 Trash-rows query spec passes — 57b1118b
