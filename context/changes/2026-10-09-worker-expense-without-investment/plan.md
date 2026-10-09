# Worker flag — expense draft without an investment — Implementation Plan

## Overview

A new per-worker flag, „Może dodawać wydatki bez inwestycji" (`users.can_add_expenses_without_investment`).
A flagged worker, on his own `/pracownicy/[id]`, sends an expense draft (photos of a faktura /
paragon) with „Bez inwestycji" picked instead of an investment. Management accepts such a draft as
„Inny wydatek" (`OTHER`), with the worker prefilled as each row's buyer. Business decisions are
settled in `research.md` → Open Questions 1–5.

## Current State Analysis

The investment is hard-wired at every draft layer:

- **Schema.** `worker_expense_drafts.investment_id` is `NOT NULL`.
- **Server action.** `sendDraftSchema.investmentId` is `.positive()`. `findDraftTargetError`
  requires stage membership (`src/lib/actions/worker-expense-drafts.ts:30-66`).
- **DAL.** `DRAFT_SELECT`, `PARAGON_SELECT` and `countPendingExpenseDrafts` inner-join `investments`.
  The `PARTIES_NOT_TRASHED` and `PENDING_DRAFT` predicates assume an investment row exists
  (`src/lib/db/worker-expense-drafts.ts:89,181-185,231,250,264`).
- **Worker dialog.** It has no „none" option, and `canSend` requires an investment
  (`src/components/worker-expenses/expense-draft-dialog.tsx:84-90,162-176`).
- **Quick-actions gate.** It needs ≥1 investment (`src/components/users/worker-quick-actions.tsx:28`).

The acceptance side already supports `OTHER`. It needs a kasa and a per-row category (manual pick),
leaves the investment hidden and null, and takes an optional per-row worker as buyer (EX-1027).
Nothing changes in `createBulkTransferAction`, the transfer validate hook, sheet sync or
`expense-duplicate-candidates`.

## Desired End State

- **Edit dialog.** A manager ticks „Może dodawać wydatki bez inwestycji" in „Dodaj / Edytuj pracownika".
- **Worker page info row.** The flag shows as a manager-only row in the info list of `/pracownicy/[id]`.
- **Worker's dialog.** A flagged worker sees „Bez inwestycji" in the dialog's investment select. It is
  auto-picked when it is the only option, i.e. the worker is on no investment.
- **Quick-actions button.** It shows when the worker has a sendable kasa AND (an investment OR the flag).
- **Server enforcement.** The server refuses a send with no investment from an unflagged worker. The
  flag is read fresh from the DB, never from the JWT. An update keeps an existing „Bez inwestycji"
  draft valid after the flag was cleared, but never switches a real investment to none without the flag.
- **Lists.** The worker's drafts table and the management queue show „Bez inwestycji" in the
  investment column. The worker table's client-side investment filter offers it as an option.
- **Acceptance.** Accepting such a draft opens „Nowy wydatek" prefilled with `type: 'OTHER'`, the
  draft's kasa, no investment, and every row's worker = the draft's worker.

### Key Discoveries

- **Field access is bypassed.** `createWorkerAction` / `updateWorkerAction` are already
  `protectedAction` and call the Local API without `user`, so field access is bypassed.
  „Any manager may set the flag" needs no access work beyond the collection field.
- **`OTHER`'s worker is per row.** It sits on `lineItems[].worker` (`makeLineItem`,
  `src/components/forms/expense-form/bulk-expense-form.ts:35-50`). The top-level `worker` is only for
  `PAYOUT` / `BONUS`.
- **Radix Select rejects an empty-string item value.** „Bez inwestycji" therefore needs a sentinel
  value (`'none'`) that the client maps to an explicit `null`.
- **Reference data is cached.** Widening `WorkerRefT` must bump the `unstable_cache` key
  `reference-data-v7` → `v8` (`src/lib/queries/reference-data.ts:186`), or a stale entry is served
  without the field.
- **Sort order already handles null.** `SORT_EXPRESSIONS.investmentName` already sorts `NULLS LAST`.
- **Null-safe paths need no change.** `restoreSkippedReceipt` copies `investment_id`, so it already
  handles null. `pendingDraftsProbe('investment')` filters by a concrete id, so a draft with no
  investment simply never appears on an investment page.

## What We're NOT Doing

- **Queue filter.** No „Bez inwestycji" option in the management queue's investment filter (decided
  2026-10-09). The column shows it; the filter lists real investments only, so
  `listExpenseDraftFilterOptions` and `queueFiltersWhere` are untouched.
- **Listing column.** No column on the `/pracownicy` listing.
- **Category prefill.** No AI or automatic prefill of `otherCategory`; the category stays a manual
  pick per row.
- **Existing drafts.** No change to drafts that already exist when the flag flips.
- **Write paths.** No change to `createBulkTransferAction`, transfer hooks, sheet sync or the duplicate
  finder.
- **E2E.** No E2E authored here (see Testing Strategy).

## Implementation Approach

The risk is in the DAL and the action, so the plan goes bottom-up: schema and flag plumbing first,
then null-safety and server enforcement with DB specs, then the worker UI, then the management side.
Each phase leaves the tree typechecking. Making `ExpenseDraftRowT.investmentId` nullable in Phase 2
breaks every consumer at compile time. The Phase 2 change makes only the minimum null-safe edits
needed to compile (string fallbacks). Phases 3–4 replace those with the real UX.

## Critical Implementation Details

- **Update guard.** The update action must distinguish „keeps no investment" from „clears an
  investment". When `investmentId === null` and the fresh flag read is false, allow it only if the
  pending draft (own, `status = 'pending'`) currently has `investment_id IS NULL`. Otherwise refuse
  with `chooseInvestment`, not `draftAlreadyDecided`, so the check is a separate read before the
  UPDATE. The worker owns the draft, so the read → write gap has no other actor.
- **Migration `down`.** It must delete drafts with `investment_id IS NULL` before re-adding
  `NOT NULL`, or it fails. That is lossy, so say so in its comment.
- **Deploy order.** The migration is additive (new column with a default, a dropped constraint), so
  it goes to prod before the code ships (AGENTS.md → Migrations).

---

## Phase 1: Schema + the flag

### Overview

One migration: the new user column and the nullable draft investment. The flag is carried end to end
through collection → worker form → reference data, and shown to management on the worker page.

### Changes Required

#### 1. Migration

**File**: `src/migrations/20261009_3_worker_expense_without_investment.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Add the flag column and make the draft's investment optional. Hand-written, following
`20261001_1_users_trashed_at.ts`.

**Contract**:

- `up`:
  - `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "can_add_expenses_without_investment" boolean NOT NULL DEFAULT false;`
  - `ALTER TABLE "worker_expense_drafts" ALTER COLUMN "investment_id" DROP NOT NULL;`
  - The FK and its `ON DELETE CASCADE` are unchanged.
- `down`:
  - Delete the null-investment drafts.
  - Re-add `SET NOT NULL`.
  - Drop the column.

#### 2. Users collection

**File**: `src/collections/users.ts`

**Intent**: Add the checkbox field so Payload types and the admin schema know it.

**Contract**:

- `{ name: 'canAddExpensesWithoutInvestment', type: 'checkbox', defaultValue: false, label: { en: …, pl: 'Może dodawać wydatki bez inwestycji' } }`.
- No `isAdminOrOwnerField` access: any management role sets it through the action. Placed after
  `active`.
- Run `pnpm generate:types`.

#### 3. Worker form

**Files**:

- `src/components/forms/worker-form/worker-schema.ts`
- `src/components/forms/worker-form/worker-form.tsx`
- `src/components/dialogs/edit-worker-dialog.tsx`
- `src/components/dialogs/add-worker-dialog.tsx`

**Intent**: A checkbox „Może dodawać wydatki bez inwestycji" in both dialogs.

**Contract**:

- `workerFormSchema` gains `canAddExpensesWithoutInvestment: z.boolean()`. The domain schema extends
  it, so `createWorkerAction` / `updateWorkerAction` pass it through.
- `toData` maps it.
- The `<field.Checkbox>` follows the precedent at `worker-form.tsx:111`.
- Edit defaults to `worker.canAddExpensesWithoutInvestment ?? false`; add defaults to `false`.
- Verify the actions in `src/lib/actions/workers.ts` forward the field. If they whitelist fields,
  add it.

#### 4. Reference data

**Files**:

- `src/types/reference-data.ts`
- `src/lib/queries/reference-data.ts`

**Intent**: `WorkerRefT` carries the flag, so the worker page reads it without a new query.

**Contract**:

- `WorkerRefT.canAddExpensesWithoutInvestment: boolean`.
- Add `can_add_expenses_without_investment` to the users SELECT and the mapper.
- Cache key `['reference-data-v8']`.

#### 5. Worker page info row

**Files**:

- `src/app/(frontend)/pracownicy/[id]/page.tsx`
- `src/lib/i18n/dictionaries/{pl,uk,ru}.ts` (`workerPage`)

**Intent**: A manager-only row, same pattern as „Status".

**Contract**:

- `...(isManager ? [{ label: t('expensesWithoutInvestment'), value: t(worker.canAddExpensesWithoutInvestment ? 'yes' : 'no') }] : [])`.
- New keys in all three languages:
  - pl: `expensesWithoutInvestment` „Wydatki bez inwestycji", `yes` „Tak", `no` „Nie"
  - uk: „Витрати без об'єкта" / „Так" / „Ні"
  - ru: „Расходы без объекта" / „Да" / „Нет"

### Success Criteria

#### Automated Verification

- Migration applies to the local dev DB: `pnpm payload migrate` (check `git status src/migrations` first)
- Types regenerate: `pnpm generate:types`
- Worker form spec (if one exists for the schema/toData mapping) passes: `pnpm exec vitest run <spec>`

#### Manual Verification

- „Edytuj pracownika" shows the checkbox. Ticking it and saving persists, and reopening shows it ticked.
- „Dodaj pracownika" creates a worker with the box unticked by default.
- A manager sees „Wydatki bez inwestycji: Tak/Nie" on `/pracownicy/[id]`. An EMPLOYEE on his own page
  does not see the row.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Draft DAL null-safety + server enforcement

### Overview

The data layer lists, counts and updates drafts with no investment. The send and update actions
enforce the flag with a fresh DB read.

### Changes Required

#### 1. Draft DAL

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: A draft with `investment_id IS NULL` is listed, counted, decided and restored like any
other.

**Contract**:

- `ExpenseDraftRowT.investmentId: number | null`, `investmentName: string | null`. `toDraftRow` maps
  via the null-preserving helpers.
- `JOIN investments` → `LEFT JOIN` in:
  - `DRAFT_SELECT` (:89)
  - `PARAGON_SELECT` (:231)
  - `countPendingExpenseDrafts` (:264)
- `listExpenseDraftFilterOptions` keeps its inner join.
- `PARTIES_NOT_TRASHED`: the investment clause becomes `(d.investment_id IS NULL OR EXISTS (…))`.
- `PENDING_DRAFT`: `d.status = 'pending' AND (d.investment_id IS NULL OR i.trashed_at IS NULL)`.
- `insertWorkerExpenseDraft` / `updatePendingExpenseDraft` inputs: `investmentId: number | null`.

#### 2. Flag reader

**File**: `src/lib/db/worker-gate.ts`

**Intent**: The one-statement live read the action trusts. The JWT is 90 days old and does not carry
the flag.

**Contract**:

- `canAddExpensesWithoutInvestment(db, workerId): Promise<boolean>` — `SELECT can_add_expenses_without_investment FROM users WHERE id = $1`. A missing row → `false`.
- A second reader for the update guard, `isPendingDraftWithoutInvestment(db, { draftId, workerId }): Promise<boolean>`, goes in `src/lib/db/worker-expense-drafts.ts` beside its siblings.

#### 3. Actions

**File**: `src/lib/actions/worker-expense-drafts.ts`

**Intent**: Accept `investmentId: null` only where the business rule allows it.

**Contract**:

- `sendDraftSchema.investmentId` → `z.number().int().positive(pl.notices.chooseInvestment).nullable()`.
  `updateDraftSchema` inherits it.
- `findDraftTargetError` takes `investmentId: number | null`:
  - null skips the stage-membership check;
  - the kasa check always runs.
- Send: `investmentId === null && !(await canAddExpensesWithoutInvestment(db, workerId))` →
  `noticeFailure('chooseInvestment')`.
- Update, when `investmentId === null`:
  - allowed if the worker is flagged OR `isPendingDraftWithoutInvestment`;
  - otherwise → `noticeFailure('chooseInvestment')`.
- Restore error texts (:130, :145) keep naming „inwestycja". It is still true for a draft with an
  investment and harmless for one without.

#### 4. Minimum compile fixes

**Files**: every consumer of `ExpenseDraftRowT.investmentId` / `investmentName` that stops compiling.

**Intent**: Keep the tree green with the smallest null-safe edit. Phases 3–4 own the real UX.

**Contract**: No behaviour change for drafts that have an investment.

#### 5. DB specs

**Files**:

- `src/__tests__/lib/db/worker-expense-drafts.db.test.ts`
- `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts`

**Intent**: Prove the risk end to end against the DB. Assert persisted state, not just the returned
result.

**Contract** — cases:

- A no-investment draft is inserted, listed (`investmentName: null`), counted as pending, and not
  hidden by the trash predicates.
- Send with `null`:
  - flagged → a row with `investment_id IS NULL`;
  - unflagged → refused, no row.
- Update:
  - an unflagged worker keeps an existing null draft null → ok;
  - an unflagged worker clears a real investment → refused, row unchanged;
  - a flagged worker clears it → ok.
- A null draft from a worker whose kasa is foreign is still refused (`notYourRegister`).

### Success Criteria

#### Automated Verification

- DAL spec passes: `pnpm exec vitest run src/__tests__/lib/db/worker-expense-drafts.db.test.ts`
- Action spec passes: `pnpm exec vitest run src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts`

#### Manual Verification

- (covered by Phase 3–4 manual checks)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Worker UI

### Overview

The worker sends and edits a draft with „Bez inwestycji", and his drafts table renders it.

### Changes Required

#### 1. Expense draft dialog

**File**: `src/components/worker-expenses/expense-draft-dialog.tsx`

**Intent**: „Bez inwestycji" is an explicit option, offered to a flagged worker, and to anyone editing
a draft that already has none.

**Contract**:

- New prop `canSkipInvestment: boolean`. The option shows when `canSkipInvestment || draft?.investmentId === null`.
- Sentinel `NO_INVESTMENT = 'none'` (module constant).
- `initialInvestmentId` auto-picks when the offered options are exactly one, whether that option is
  the sole investment or the sentinel.
- Draft seeding and reseeding map `null` → `'none'`.
- `submit()` sends `investmentId: investmentId === NO_INVESTMENT ? null : Number(investmentId)`.
- `canSend` stays `investmentId !== ''`.

#### 2. Quick-actions gate

**Files**:

- `src/components/users/worker-quick-actions.tsx`
- `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: The new gate: a sendable kasa AND (an investment OR the flag).

**Contract**:

- New prop `canSkipInvestment: boolean`, sourced from `worker.canAddExpensesWithoutInvestment`.
- `canAddExpense = sendableRegisters.length > 0 && (investmentLinks.length > 0 || canSkipInvestment)`.
- It forwards `canSkipInvestment` to `ExpenseDraftDialog`.

#### 3. Worker drafts section and table

**Files**:

- `src/components/worker-expenses/worker-expense-drafts-section.tsx`
- `src/components/worker-expenses/worker-expense-drafts-table.tsx`
- `src/components/worker-expenses/delete-expense-draft-button.tsx`

**Intent**: Edit, delete and filter work on a no-investment draft.

**Contract**:

- `canSkipInvestment` is threaded page → section → table → row `ExpenseDraftDialog`.
- `getInvestment` maps null → `'none'`.
- Investment filter options map a null id to `{ value: 'none', label: t('noInvestment') }`.
- `DeleteExpenseDraftButton` receives `draft.investmentName ?? t('noInvestment')`.

#### 4. Investment column

**File**: `src/components/tables/expense-drafts.tsx`

**Intent**: The shared column (worker table and management queue) renders `t('noInvestment')` for
null.

**Contract**: The `investmentName` accessor's cell gets a null fallback.

#### 5. i18n

**Files**: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts` (`expenseDrafts`)

**Contract**:

- `noInvestment` — pl „Bez inwestycji", uk „Без об'єкта", ru „Без объекта" — the uk/ru dictionaries say „об'єкт/объект" for an investment everywhere.

#### 6. DOM specs

**Files**:

- `src/__tests__/components/worker-expenses/expense-draft-dialog-mode.test.tsx` (or a sibling
  `expense-draft-dialog-no-investment.test.tsx`)
- `src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx`
- new `src/__tests__/components/users/worker-quick-actions.test.tsx`

**Contract** — cases:

- **Dialog, flagged:** „Bez inwestycji" is listed.
- **Dialog, unflagged:** it is absent.
- **Dialog, flagged with zero investments:** it is pre-selected and Send is enabled once a photo is
  picked.
- **Dialog, editing a null draft while unflagged:** the option is offered and selected.
- **Quick actions:**
  - the button shows for flagged + 0 investments + a kasa;
  - it is hidden for unflagged + 0 investments.
- **Table:** a null draft renders „Bez inwestycji" and appears as a filter option.

### Success Criteria

#### Automated Verification

- Dialog spec(s) pass: `pnpm exec vitest run src/__tests__/components/worker-expenses/expense-draft-dialog-mode.test.tsx`
- Worker table spec passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx`
- Quick-actions spec passes: `pnpm exec vitest run src/__tests__/components/users/worker-quick-actions.test.tsx`

#### Manual Verification

- As a flagged EMPLOYEE with no investment, at 390px: „Wydatek" shows on his own page, the dialog
  pre-selects „Bez inwestycji", and sending a photo lands the draft in his list as „Bez inwestycji".
- As a flagged EMPLOYEE with investments: the select lists „Bez inwestycji" plus his investments, and
  nothing is pre-selected.
- After a manager unticks the flag: the worker's existing „Bez inwestycji" draft still edits and saves
  with that option; a new send no longer offers it; and with 0 investments the button disappears.
- The same flow in Ukrainian shows „Без об'єкта".

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Management acceptance

### Overview

Accepting a no-investment draft prefills „Inny wydatek" with the worker as each row's buyer. Reject
and queue display are null-safe.

### Changes Required

#### 1. Acceptance prefill

**File**: `src/components/worker-expenses/use-expense-draft-acceptance.tsx`

**Intent**: Implements decision 1 from research.md.

**Contract** — `prefillFor`, when `draft.investmentId === null`:

- `type: 'OTHER'`, `investment: ''`;
- every line item gets `worker: String(draft.workerId)`;
- `expenseCategory` stays the default resolved one (it is ignored for `OTHER`);
- `otherCategory` stays empty, a manual pick.

Otherwise the prefill is unchanged. Keep the branch a small pure helper so it is unit-testable; the
cheapest home is beside `buildDraftPrefill` in `draft-prefill.ts`.

#### 2. Reject confirm

**File**: same file, `:239`

**Contract**: `` `${rejecting.workerName} · ${rejecting.investmentName ?? 'Bez inwestycji'}` ``.
Management dialogs are Polish-only.

#### 3. Specs

**Files**:

- `src/__tests__/components/worker-expenses/draft-prefill.test.ts`
- `src/__tests__/components/worker-expenses/pending-expense-drafts.test.tsx`
- `src/__tests__/components/worker-expenses/expense-drafts-data-table.test.tsx`

**Contract** — cases:

- **Prefill:** a null-investment draft yields `type: 'OTHER'`, an empty investment, the draft's kasa,
  and every row's `worker` = the draft's worker. A draft with an investment is unchanged.
- **Queue:** the row renders „Bez inwestycji".

### Success Criteria

#### Automated Verification

- Prefill spec passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/draft-prefill.test.ts`
- Queue specs pass: `pnpm exec vitest run src/__tests__/components/worker-expenses/pending-expense-drafts.test.tsx src/__tests__/components/worker-expenses/expense-drafts-data-table.test.tsx`

#### Manual Verification

- A manager opens the „Bez inwestycji" draft in „Zgłoszenia wydatków" → the form shows „Inny wydatek",
  the worker's kasa, no investment field, and the worker on every row. Picking a category per row and
  saving creates `OTHER` transfers with that worker as buyer, and the draft becomes „przyjęty".
- Rejecting it shows „<pracownik> · Bez inwestycji" in the confirm.
- Switching the type to „Wydatek inwestycyjny" during acceptance asks for an investment as usual.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

- **Integration (DB):** the risk is a wrongly refused or wrongly allowed send/update, and a null draft
  vanishing from lists through an inner join. These are covered in Phase 2 against the 5435 test DB,
  asserting persisted rows.
- **DOM:**
  - option offered or hidden per flag and per existing draft;
  - auto-pick;
  - the quick-actions gate;
  - null rendering.
- **Unit:** the acceptance prefill branch.
- **E2E:** not authored. The browser-level path (worker send → manager accept) reuses the existing
  draft E2E flow; only the option differs, and the DOM + DB layers cover the new risk. If the
  slice-review gate wants one, file it under `e2e-backlog`.

## Migration Notes

Additive: `db:migrate:prod` before the code ships. Existing drafts all have an investment and are
untouched; every existing user gets `false`.

## Whole-tree Gate

Run **once**, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Integration suite passes: `pnpm test:integration`
- Unit + DOM suite passes: `pnpm test`

## References

- Research: `context/changes/2026-10-09-worker-expense-without-investment/research.md`
- `OTHER` buyer worker: EX-1027
- Worker draft flow: EX-971
- Migration precedent: `src/migrations/20261001_1_users_trashed_at.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema + the flag

#### Automated

- [x] 1.1 Migration applies to the local dev DB — 5ee26ef07
- [x] 1.2 Types regenerate — 5ee26ef07
- [x] 1.3 Worker form spec passes

### Phase 2: Draft DAL null-safety + server enforcement

#### Automated

- [x] 2.1 DAL spec passes
- [x] 2.2 Action spec passes

### Phase 3: Worker UI

#### Automated

- [x] 3.1 Dialog spec(s) pass
- [x] 3.2 Worker table spec passes
- [x] 3.3 Quick-actions spec passes

### Phase 4: Management acceptance

#### Automated

- [x] 4.1 Prefill spec passes
- [x] 4.2 Queue specs pass
