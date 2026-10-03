# Several workers per etap — split of the executed-work pool (EX-943) Implementation Plan

## Overview

Replace EX-613's „one etap, one worker" with a **split**: an etap holds several workers, and its
executed-work pool (pomiar × stawka podwykonawcy, pre-rabat, at the etap's own plane) is divided
between them by **percent** or by **amount**, chosen per etap. Every worker but one carries an
entered value; one worker takes the rest. Owner rules are in `change.md` and are authoritative; the
codebase map is `research.md`.

## Current State Analysis

- The etap stores one nullable `worker_id` (`src/migrations/20260728_1_add_worker_to_kosztorys_stages.ts`),
  typed `KosztorysStageT.workerId` (`src/lib/kosztorys/types.ts:100-106`).
- Money is attributed to a person in exactly two places:
  - the TS reference fold `subcontractorDueByPlane` (`src/lib/kosztorys/subcontractor-due.ts:73,84`),
    feeding the editor's Podsumowanie podwykonawców, the investment summary panel and the worker
    view;
  - its SQL twin, `subcontractorLinesCte` grouped by `ks.worker_id` in
    `src/lib/db/worker-payout-pairs.ts:30-62`, feeding the employee list, the listing's
    „Pozostało do wypłaty" and „Rozlicz wypłaty". A DB parity spec pins the twin to the reference.
- Margin reads only the combined due (`margin-v2.ts:28`), never a per-person figure.
- The worker is written by `updateStageAction` / `addStageAction` (`src/lib/actions/kosztorys.ts:595-651`),
  by the add-etap menu copying the last etap (`toolbar/menus/kosztorys-add-menu.tsx:95`), by the
  sheet import's one default wykonawca (`build-import-plan.ts`, landed in `fae76527`), and by
  snapshot restore (`insert-kosztorys-tree.ts`), which drops deleted users.
- The picker lives in the etap header dropdown (`grid/stage-header.tsx:111-207`,
  `grid/stage-worker-section.tsx`), behind a confirm dialog (`grid/reassign-worker-confirm-dialog.tsx`).

## Desired End State

- An etap in the editor offers „Pracownicy etapu…" in its header menu. It opens a dialog with:
  - a % / kwota switch;
  - one row per worker with an entered value, plus one worker marked as taking the rest;
  - each person's złoty amount shown live.
- The header's second line reads „Jan Kowalski +1".
- Every per-person figure follows the split: Podsumowanie podwykonawców, the employee list,
  „Rozlicz wypłaty", the listing, and the worker link / Podgląd / PDF (with „Twój udział").
  Margin and every investment-level total are unchanged, to the grosz.
- The split's arithmetic exists in **one** TS function, used by both the editor path and the
  cross-investment path. SQL only prices the pool per etap.
- The cap holds at save time: Σ fixed amounts ≤ the etap's current executed-work value, and
  Σ entered % ≤ 100.
  - If the pool later drops below the fixed amounts, they shrink pro rata, the reszta holder gets
    0, and the etap is flagged.
  - No share is ever negative.
- Existing assignments are migrated as one-person splits, and no figure moves. The golden master
  stays green after its fixture signature is regenerated.

Verify with: `pnpm exec vitest run` on the specs listed per phase, `pnpm test:integration`,
`pnpm test:parity`, and the manual checks rolled into `context/foundation/manual-checks.md`.

### Key Discoveries

- `subcontractor-due.ts:84` is the single line that credits a whole etap to one person. `:73`
  flags a plane-less etap against that one person.
- `worker-payout-pairs.ts:30-62` groups by `(investment_id, worker_id)`. `lines` inner-joins
  `stage_progress`, so an etap with no progress yields no row. With the owner's rule „no executed
  work → nothing is split", that inner join is correct as is.
- `insert-kosztorys-tree.ts:8-14,80-94` inserts stages from a hand-written column list and drops
  dead assignees. Lesson ~530: a tree field is not done until this INSERT knows it.
- `users.ts:52-55` guards user delete with `payload.count` on `kosztorys-stages.worker`
  (`lib/db/delete-blocker.ts`, Payload-only probes).
- `financial-golden-master-db.test.ts:193` hashes `ks.worker_id` into each investment's
  signature. Lesson ~1781: a changed signature de-lists the investment from comparison instead
  of failing.
- Caches that carry the stage shape need key bumps (lesson ~1070):
  - `worker-kosztorys-data-v1` (`queries/worker-kosztorys.ts:113`);
  - `preview-kosztorys-editor-data-v2` (`preview-kosztorys.ts:97`);
  - `preview-kosztorys-history-v1` (`preview-kosztorys-history.ts:50`);
  - `worker-payout-pairs-v1` (`queries/balances.ts:143`), whose rows keep their shape but whose
    meaning changes.
  - Pairs are tagged with `KOSZTORYS_CLIENT_TOTALS_TAGS`, so a stage write already expires them.
- `SNAPSHOT_SCHEMA_VERSION = 1` is not bumped (lesson ~772). The stored stage type becomes
  tolerant instead: it reads either `split`, or a legacy `workerId` as a one-person split.
- Lesson ~1774: one concept written as two independent patches has states that no single write
  produces. The mode and the members are therefore written by **one** action, in one transaction.

## What We're NOT Doing

- **Dropping `kosztorys_stages.worker_id`.** It is a destructive migration, so it ships in a
  later push after this deploy is live (lesson ~1558). New code neither reads nor writes the
  column. File a follow-up Linear issue at implement time.
- Showing co-workers' names or shares on the worker link / Podgląd / PDF.
- Scaling „Wartość przedmiaru" by the share. The worker view keeps the whole przedmiar value.
- A new label for a negative figure. „Nadpłata" keeps its meaning (payouts above the share).
- Undo for split edits. The worker assignment is not undoable today either.
- Splits in presets/szablony, which carry no etapy.
- Any change to margin, the listing's investment-level due, or the client figures.
- Refusing a pomiar / plane / cena edit because of a split.

## Implementation Approach

1. **Pure rule first.** Build the split types, the arithmetic and the validation as React-free
   code in `src/lib/kosztorys/`, specified test-first.
2. **Storage and every stage read/write in one phase**, so the type change (`workerId` → `split`)
   lands compiling. In that phase the old single-worker picker keeps working by writing a
   one-person split.
3. **Move the cross-investment path to the same rule.** SQL returns the pool per etap, and TS
   applies the split. The parity spec then only has to pin the pool.
4. **UI**: the dialog, the header line and the flag.
5. **Worker view and PDF**, then the living docs.

## Critical Implementation Details

**Deploy order.** The migration is additive: a new table, a new mode column, and a backfill. The
human runs `pnpm db:migrate:prod` **before** the push (AGENTS.md, Migrations). Between that
migrate and the deploy going live, the old code still writes `worker_id` and never touches the
new table. A worker reassigned in those minutes is therefore lost. That is acceptable for 5 users;
say it in the push note. The backfill is idempotent (`ON CONFLICT DO NOTHING`).

**Floating point and „never negative".** The split does no rounding: display rounds, and the
comparisons that decide state already use `roundToCents`. The rest share is `pool − Σ entered`,
and float residue can make it `-1e-13`, so clamp it at 0 (the one place a `Math.max(0, …)` is
correct). Both paths run the same function, so no SQL↔TS rounding bridge is needed.

**Atomic write.** Mode and members are one concept and are saved together. The action takes the
whole split and runs inside one transaction:

- update the etap's mode;
- delete its members;
- insert the new members;
- re-validate the cap against a pool computed **server-side** for that etap.

Never patch mode and members separately (lesson ~1774).

**Reszta holder integrity.** `ON DELETE CASCADE` from `users` would silently remove a member,
possibly the reszta holder. So:

- the user-delete guard blocks deleting anyone who is a member;
- the fold normalises a split that has no reszta holder (first remaining member by insertion
  order takes the rest), so a bypass degrades instead of breaking;
- restore uses the same normalisation.

## Phase 1: The split rule (pure)

### Overview

Types, arithmetic and validation for a split, with no DB or UI. Nothing consumes it yet.

### Changes Required

#### 1. Split module

**File**: `src/lib/kosztorys/stage-worker-split.ts` (new)

**Intent**: The one place the split is defined. `subcontractorDueByPlane` (Phase 2), the SQL
pairs fold (Phase 3), the server action's cap check (Phase 2) and the dialog (Phase 4) all use
it.

**Contract**:

```ts
export type StageSplitModeT = 'percent' | 'amount'
export type StageMemberT = { workerId: number; value: number; takesRest: boolean } // value: percent points (25 = 25%) or zł; ignored on the rest holder
export type StageSplitT = { mode: StageSplitModeT; members: StageMemberT[] } // null on the etap = nobody assigned

export type StageSharesT = { shares: Map<number, number>; scaledDown: boolean }
export function splitStagePool(pool: number, split: StageSplitT): StageSharesT
export function normalizeStageSplit(split: StageSplitT | null): StageSplitT | null // exactly one takesRest; empty → null
export function validateStageSplit(split: StageSplitT, pool: number): string | null // Polish sentence or null
```

Rules:

- `pool <= 0` → every member 0 and `scaledDown: false` („nie dzielimy pieniędzy, których nie ma").
- **Percent mode**: each non-rest member gets `pool × value / 100`; the rest holder gets
  `max(0, pool − Σ)`.
- **Amount mode**:
  - If Σ entered ≤ pool, each member gets its value and the rest holder gets `max(0, pool − Σ)`.
  - Otherwise each entered value is scaled by `pool / Σ`, the rest holder gets 0, and
    `scaledDown: true`.
- Σ shares === pool within float precision.

`validateStageSplit` refuses, with a Polish message:

- no members, or not exactly one rest holder;
- a duplicate worker;
- a negative value;
- percent mode with Σ > 100;
- amount mode with Σ > pool.

„Reszta" as an identifier is taken by `remainderNet` / `remainderGross`, so the code says
`takesRest` / `share`, never `remainder`.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/stage-worker-split.test.ts` passes. It covers:
  - percent 25/25/25 + rest = 25% each;
  - amount 3 × 1 000 + rest at pool 4 000 / 3 000;
  - pro-rata shrink at pool 2 400 → 800 each, rest 0, `scaledDown`;
  - pool 0 → all zero;
  - one-person split → the whole pool, bit-identical;
  - float residue never yields a negative share;
  - Σ shares === pool;
  - normalisation elects a rest holder when none is flagged;
  - every validation refusal.

#### Manual Verification

- None. The phase is pure code with no surface.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Storage, reads, writes and the reference fold

### Overview

Persist splits, carry them through every read and write path of the tree, and attribute money
through `splitStagePool` in the reference fold. The existing single-worker picker keeps working
by writing a one-person split.

### Changes Required

#### 1. Migration

**File**: `src/migrations/20260930_1_add_kosztorys_stage_workers.ts` (new), registered in
`src/migrations/index.ts`.

**Intent**: Store the split. The migration is purely additive; `worker_id` stays for the old
code during the deploy gap.

**Contract**:

- `kosztorys_stages.split_mode`: an enum created with Payload's naming convention (follow
  `20260724_2`'s `plane` enum), NOT NULL, DEFAULT `'percent'`.
- The new table `kosztorys_stage_workers` has:
  - `id` serial;
  - `stage_id` FK → `kosztorys_stages` ON DELETE CASCADE;
  - `worker_id` FK → `users` ON DELETE CASCADE;
  - `value numeric(12,2) NOT NULL DEFAULT 0`;
  - `takes_rest boolean NOT NULL DEFAULT false`;
  - `UNIQUE (stage_id, worker_id)`;
  - a partial unique index `(stage_id) WHERE takes_rest`;
  - an index on `worker_id`.
  - It is raw, not a Payload collection (research, storage options).
- Backfill: `INSERT … SELECT id, worker_id, 0, true FROM kosztorys_stages WHERE worker_id IS NOT
NULL ON CONFLICT DO NOTHING`.
- `down` drops the table and the column.

#### 2. Collection + types

**Files**:

- `src/collections/kosztorys-stages.ts`;
- `src/lib/kosztorys/types.ts`;
- `context/domain/02-glossary.md`.

**Intent**:

- Declare `splitMode` on the collection so Payload's own stage writes never clobber it.
- Replace `KosztorysStageT.workerId` with `split: StageSplitT | null`.
- `StagePatchT` loses `workerId`; the split is written only through its own action.
- Add the terms (split, member, share, takes the rest) to the glossary.

**Contract**:

- `KosztorysStageT = { id; ordinal; label; plane; split: StageSplitT | null }`.
- Fixtures building `workerId` (~46 specs) move to `split`. Keep it mechanical: a `oneWorker(id)`
  helper in the test fixtures produces `{ mode: 'percent', members: [{ workerId: id, value: 0,
takesRest: true }] }`.

#### 3. Tree read

**File**: `src/lib/db/kosztorys-tree.ts`

**Intent**: Load `split_mode` plus a per-stage `json_agg` of members (ordered by member `id`) and
map them through `normalizeStageSplit`.

**Contract**: `mapStage` returns `split`. A stage with no members → `null`.

#### 4. Split write action + add-etap copy

**File**: `src/lib/actions/kosztorys.ts` (plus a new `src/lib/db/stage-split.ts` for the SQL
statements)

**Intent**:

- A new `updateStageSplitAction(stageId, split | null)` runs through `investmentAction` (lock,
  auth, `['kosztorysStages']` tags). In one transaction it:
  - normalises the split;
  - computes the etap's pool server-side by reusing `subcontractorLinesCte` filtered to the one
    stage;
  - runs `validateStageSplit`;
  - writes the mode and replaces the members.
- `addStageAction(investmentId, plane, split)` creates the stage and its members in the same
  transaction.
- `updateStageAction` loses `workerId`.

**Contract**:

- `updateStageSplitAction(stageId: number, split: StageSplitT | null): Promise<ActionResultT>`.
- `addStageAction(investmentId: number, plane: ToolPlaneT, split: StageSplitT | null =
null)`.
- A plane-less etap refuses a non-null split, preserving the EX-613 rule „etap bez rozliczenia
  nie przyjmuje pracownika".
- A refused cap returns the Polish sentence from `validateStageSplit`.

#### 5. Editor client path

**Files**:

- `src/components/kosztorys/editor/hooks/use-kosztorys-stage-ops.ts`;
- `toolbar/menus/kosztorys-add-menu.tsx`;
- `grid/stage-header.tsx`;
- `grid/stage-worker-section.tsx`.

**Intent**:

- `handleSetStageWorker` becomes `handleSetStageSplit`: an optimistic replace of the whole
  `split`, a call to the new action, and a revert on error. It is not undoable, as today.
- The add menu copies the last etap's whole split, as the owner decided.
- For this phase, the existing single-worker picker writes `oneWorker(id)` or `null`, so the UI
  keeps working until Phase 4 replaces it.

**Contract**: `patchStageField`'s reference equality is not used for `split`; the split handler
compares nothing and always writes.

#### 6. Reference fold + its consumers

**Files**:

- `src/lib/kosztorys/subcontractor-due.ts`;
- `subcontractor-summary.ts`;
- `worker-view/scope.ts`;
- `worker-view/assigned-workers.ts`;
- `stage-conditions.ts`.

**Intent**:

- `byWorker` is built from `splitStagePool(planeTotal, split)`. A `null` split credits the `null`
  bucket, as today.
- A plane-less etap with qty adds **every** member, or `null`, to `unconfirmedWorkers`.
- `byStageWorker` is new, for the worker view's per-etap share.
- `scaledDownStageIds` is new, for the flag.
- Membership replaces `stage.workerId` in the summary's assigned set, in the worker scope and in
  the assigned-workers list.
- `stage-no-worker` matches `split === null`.
- A new condition, `stage-split-scaled`, is labelled in Polish in the sheet's register, e.g.
  „Podział obniżony — popraw podział".

**Contract**:

- `SubcontractorDueByPlaneT` gains `byStageWorker: Map<number, Map<number, number>>` and
  `scaledDownStageIds: Set<number>`.
- Σ `byWorker` === `combined`.

#### 7. Restore, snapshots, history preview

**Files**:

- `src/lib/kosztorys/serialize-tree.ts`;
- `snapshot-format.ts`;
- `insert-kosztorys-tree.ts`;
- `history/snapshot-to-tree.ts`.

**Intent**:

- The stored stage type becomes tolerant: `split?` plus legacy `workerId?`. A legacy value is read
  as a one-person split.
- Restore:
  - drops dead members through the existing `FOR SHARE` live-user check, then normalises (the
    first remaining member takes the rest);
  - inserts `split_mode` into the stage columns, and inserts members after the stage id remap;
  - still counts `droppedWorkerAssignments`, now per dropped member.
- The history preview normalises legacy stages the same way.

**Contract**:

- `SNAPSHOT_SCHEMA_VERSION` stays 1.
- `STAGE_INSERT_COLUMNS` gains `split_mode` and loses `worker_id`.

#### 8. Sheet import

**Files**:

- `src/lib/kosztorys/sheet-import/build-import-plan.ts`;
- `src/lib/actions/kosztorys-import.ts`.

**Intent**: The one default wykonawca becomes a one-person split on each imported etap that has a
plane. The dialog is unchanged.

#### 9. User delete guard

**Files**:

- `src/lib/db/delete-blocker.ts`;
- `src/collections/users.ts`.

**Intent**: The members table is not a Payload collection, so the `kosztorys-stages.worker`
probe is replaced by a raw count over `kosztorys_stage_workers`. Label: „etapy kosztorysu".

**Contract**: `DeleteProbeT` gains a raw variant, `{ count: (db, id) => Promise<number>; label }`,
executed on the caller's transaction.

#### 10. Cache keys + golden master

**Files**:

- `queries/worker-kosztorys.ts`;
- `preview-kosztorys.ts`;
- `preview-kosztorys-history.ts`;
- `src/__tests__/financial-golden-master-db.test.ts` plus its fixture.

**Intent**:

- Bump the three stage-carrying cache keys.
- Replace `ks.worker_id` in the investment signature with the members (worker, value,
  takes_rest) and `split_mode`.
- Regenerate the fixture **after** confirming every figure is unchanged, so a moved figure cannot
  hide in the re-signing.

### Success Criteria

#### Automated Verification

- Migration applies to local docker and to `db-test` (5435); the running app reads the new
  table (lesson ~193). Run `git status src/migrations` first (shared tree).
- `pnpm exec vitest run` passes on:
  - `subcontractor-due-by-plane.test.ts`, extended with splits: Σ byWorker === combined, and
    plane-less flags every member;
  - `subcontractor-summary.test.ts`;
  - `worker-view/scope.test.ts`;
  - `stage-conditions.test.ts`;
  - `kosztorys-stages.test.ts`: the action persists the split (read back from the DB, not from
    the result); a cap refusal leaves the DB unchanged; a plane-less refusal; `addStageAction`
    copies the split;
  - `restore-deleted-worker.test.ts`: a legacy `workerId` snapshot restores as a one-person
    split, and a deleted rest holder elects the next member;
  - `snapshot-to-tree.test.ts`;
  - `build-import-plan.test.ts`;
  - the users delete-guard spec.
- `pnpm test:parity` is green on the regenerated fixture, with the figures diffed unchanged
  before regenerating.

#### Manual Verification

- On an investment with assigned etapy after `db:import` + migrate, every etap shows the same
  worker as before, and Podsumowanie podwykonawców shows the same per-person figures.
- Assigning a worker through the (still single) picker survives a reload.
- „Dodaj etap" copies the previous etap's worker.
- Deleting a user who is on an etap is refused with „etapy kosztorysu".

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Cross-investment path on the same rule

### Overview

The employee list, the listing's „Pozostało do wypłaty" and „Rozlicz wypłaty" all read the SQL
pairs, which still group by `worker_id`. Make SQL return the pool per etap and apply
`splitStagePool` in TS.

### Changes Required

#### 1. Stage-level SQL + TS fold

**Files**:

- `src/lib/db/kosztorys-subcontractor-due.ts`;
- `src/lib/db/worker-payout-pairs.ts`;
- `src/lib/kosztorys/worker-payout-pairs.ts`.

**Intent**:

- `subcontractorLinesCte` stops selecting `ks.worker_id` and carries `stage_id` instead.
- `selectWorkerPayoutPairs` runs, keeping today's filters (not a szablon, not trashed, has
  pozycje, optional `investmentIds`):
  1. one query for due + flag grouped by `(investment_id, stage_id)`;
  2. the members of those stages, plus `split_mode`;
  3. paid grouped by `(investment_id, worker_id)`.
- A new pure fold, `foldWorkerPayoutPairs(stageDue, splits, paid, statuses)`, in
  `lib/kosztorys/worker-payout-pairs.ts`, applies `splitStagePool` per etap. Its other rules:
  - a plane-less etap flags every member, or the `null` pair;
  - a `null` split feeds the `null` pair.
- The row shape `WorkerPayoutPairRowT` is unchanged, so `classifyPair`, the settle action and
  the employee list need no edits.
- The investment-level `selectKosztorysSubcontractorDue` is unchanged apart from the CTE column
  swap.

**Contract**: `selectWorkerPayoutPairs(db, opts)` keeps its signature and row type. Bump the
cache key to `worker-payout-pairs-v2`.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-payout-pairs.test.ts` passes, with the
  pure fold covering percent, amount, scaled-down, plane-less and null-split cases.
- DB parity (`src/__tests__/lib/db/worker-payout-pairs.test.ts`, run in `pnpm test:integration`)
  passes on fixtures with a 2+ worker percent etap and an amount etap:
  - per-pair due === the reference `byWorker` (`roundToCents` equality);
  - Σ pairs === the listing's per-investment figure.
- `settle-payouts.test.ts` passes, with one split-etap case booking both workers.
- `kosztorys-subcontractor-due.test.ts` parity is still green.

#### Manual Verification

- On an investment with a 50/50 etap:
  - the Pracownicy list shows each worker's half;
  - „Rozlicz wypłaty" offers both pairs with their halves;
  - the listing's „Pozostało do wypłaty" is unchanged versus before the split.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Editor UI — „Pracownicy etapu…"

### Overview

Replace the single-worker picker with the split dialog, show „Jan Kowalski +1" in the header,
and flag a shrunk split.

### Changes Required

#### 1. Split dialog

**Files**:

- `src/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog.tsx` (new);
- its local draft logic in `src/lib/kosztorys/stage-split-draft.ts` (new, React-free, per the
  EX-521 cheapest-layer rule).

**Intent**: A dialog opened from the etap header menu, built from:

- `form-dialog-shell`;
- a `ui/toggle-group` (% / kwota);
- per-row `ui/decimal-field`;
- a `ui/combobox` roster for adding;
- a rest-holder radio per row;
- the computed złoty per person, from `splitStagePool` over the etap's live `byStage` value.

Behaviour (owner):

- A person added to the etap enters with 0, and the current rest holder is unchanged.
- The first person added to an empty etap takes the rest.
- Switching mode zeroes every entered value.
- Removing the rest holder leaves „Zapisz" disabled until a new one is picked.
- `validateStageSplit` messages show inline and disable „Zapisz".
- „Zapisz" calls `handleSetStageSplit`, with no extra confirmation.
- Removing everyone saves `null` („Bez przypisania").

**Contract**: Draft reducer functions `addMember`, `removeMember`, `setMode`, `setValue` and
`setRestHolder` operate on a `StageSplitT`. The dialog only renders and dispatches.

#### 2. Header + removal of the old picker

**Files**:

- `grid/stage-header.tsx`;
- `grid/stage-header-copy.ts`.

**Intent**:

- The header menu item „Pracownicy etapu…" replaces `StageWorkerSection`. It keeps today's
  plane-less gate: disabled, with the `workerNeedsPlane` copy.
- The second line shows the rest holder's name, then `+N` for the other members.
- A marker appears when the etap is in `scaledDownStageIds`.
- Delete `stage-worker-section.tsx` and `reassign-worker-confirm-dialog.tsx`, together with their
  specs.

#### 3. Problem filter

**File**: the filter surface that lists `stage-conditions`.

**Intent**: `stage-split-scaled` appears next to „etap bez pracownika".

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/stage-split-draft.test.ts` passes: add →
  0 and rest unchanged; mode switch zeroes; remove the rest holder → invalid until re-picked.
- The DOM spec `src/__tests__/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog.test.tsx`
  passes:
  - the live złoty per person;
  - „Zapisz" disabled on Σ% > 100, on Σ kwot > pool, and with no rest holder;
  - it saves the whole split once.
- `kosztorys-workers-menu.test.tsx` and `kosztorys-add-menu.test.tsx` pass, updated.

#### Manual Verification

- In the editor on staging:
  - give an etap with executed work 3 people at 25% plus a rest holder, save, and see each gets a
    quarter in Podsumowanie podwykonawców;
  - switch to kwota: values are zeroed, and a total above the executed work is refused with the
    message;
  - lower the Pomiar z natury below the fixed amounts: the header marker and the problem-filter
    entry appear, the fixed amounts shrink pro rata, and the rest holder shows 0 zł.
- The header reads „Jan Kowalski +2".
- A plane-less etap's menu item is disabled with the existing copy.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Worker link, Podgląd and PDF

### Overview

On a shared etap the worker sees the whole etap's rows plus his own share. Co-workers are never
named.

### Changes Required

#### 1. Worker summary

**Files**:

- `src/lib/kosztorys/worker-view/summary.ts`;
- `src/components/kosztorys/editor/summary/blocks/worker-summary.tsx`.

**Intent**:

- `executedByStage[].net` becomes his share, from `byStageWorker`, not `byStage`.
- A shared etap (more than one member) also carries the whole-etap value and „Twój udział: 25% /
  1 000 zł". The zł is the effective amount after any pro-rata shrink.
- `plannedNet` stays the whole przedmiar, as the owner decided.
- `executedNet` already follows `byWorker`.

**Contract**:

- `executedByStage` entries gain `wholeNet: number` and `share: { mode; value; amount } |
null`. The share is null on a one-person etap.
- Nothing about other members leaves this function.

#### 2. Print document

**File**: `src/lib/kosztorys/print/worker.ts`

**Intent**:

- Section and column totals stay whole-etap.
- The footer shows „Wykonane (cały etap)" and „Twój udział" as separate lines, so the rows and
  the footer no longer have to add up.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run` passes on:
  - `worker-view/summary.test.ts`: share per shared etap; no share line on a one-person etap; no
    co-worker id or name in the output;
  - `print/worker.test.ts`: the old „totals add up" assertion (`:115`) is replaced by „section
    totals = whole etap, footer share = byWorker".

#### Manual Verification

- The worker link of a 25% worker on a shared etap shows:
  - the whole etap's rows;
  - „Twój udział: 25% / … zł";
  - no co-worker names.
- The PDF footer shows both lines.
- A one-person worker's view is unchanged.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 6: Living docs

### Overview

Bring docs that the change makes factually wrong back in line.

### Changes Required

- `context/reference/kosztorys-editor-domain-notes.md`:
  - `:382`, `:413`, `:599` and `:972-988` become split semantics;
  - the worker-view rule „żaden nie widzi ilości ani kwot drugiego" gets its shared-etap
    exception.
- `context/foundation/investment-financials-and-discount.md:191,202-206`: per-person należne is
  the share.
- `context/foundation/test-plan.md`: add a risk, „split attribution drifts between the editor and
  the payouts path, or a share goes negative", pointing at the Phase 1/3 specs.
- `context/foundation/manual-checks.md`: amend `:1531-1535`, `:2626` and `:2637` for splits (the
  registry rows themselves are added by `/10x-implement` from the bullets above).

### Success Criteria

#### Automated Verification

- None. The phase is prose-only.

#### Manual Verification

- The docs read correctly against the shipped behaviour.

---

## Testing Strategy

### Unit Tests

- The split rule (Phase 1), the reference fold (Phase 2), the pairs fold (Phase 3), the dialog
  draft reducer (Phase 4), and the worker summary and print (Phase 5).

### Integration Tests

- Pairs SQL↔TS parity with split fixtures, and Σ pairs = listing (Phase 3).
- Split action persistence and cap refusal against the DB (Phase 2).
- Restore of legacy and dead-member snapshots (Phase 2).
- Golden master unchanged figures (Phase 2).

### Manual Testing Steps

1. Import the prod dump locally, migrate, and confirm every existing assignment and per-person
   figure is unchanged.
2. Create a 4-person percent split and a 3 × kwota + rest split, then check Podsumowanie
   podwykonawców, Pracownicy, „Rozlicz wypłaty" and the listing.
3. Correct the pomiar down below the fixed amounts. Check the marker, the filter, the pro-rata
   figures and the rest holder at 0 zł.
4. Open the worker link / PDF for a shared worker.

## Performance Considerations

- The tree read adds one `json_agg` of members per stage, bounded by etap count.
- The pairs path moves from one grouped query to three small ones plus a TS fold over roughly 200
  etap rows. That is negligible next to the 49 MB row-shipping that SQL pricing exists to avoid.

## Migration Notes

- Additive; the human runs `pnpm db:migrate:prod` before the push.
- `worker_id` stays until a follow-up destructive migration ships in a later push.
- The backfill makes every existing assignment a one-person percent split with the rest, so no
  figure moves.
- Re-run `pnpm db:import:test` + migrate on `db-test` before the integration specs.

## Whole-tree Gate

Run **once**, after the final phase:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:integration` (the DB specs incl. pairs parity)
- `pnpm test:parity` (golden master)
- `pnpm build`

The full `pnpm test` runs only if the user asks, per the standing rule.

## References

- Research: `context/changes/2026-09-30-kosztorys-stage-worker-split/research.md`
- Owner decisions: `context/changes/2026-09-30-kosztorys-stage-worker-split/change.md`
- Prior change: `context/archive/2026-07-27-kosztorys-stage-worker-assignment/change.md` (EX-613)
- Pairs: `context/archive/2026-09-29-worker-payout-remaining/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The split rule (pure)

#### Automated

- [x] 1.1 `stage-worker-split.test.ts` passes (percent, amount, pro-rata shrink, pool 0, one-person identity, no negative share, Σ = pool, normalisation, validation) — 8f7993b8

### Phase 2: Storage, reads, writes and the reference fold

#### Automated

- [x] 2.1 Migration applies to local and `db-test`; the running app reads the new table — e06fe7ad
- [x] 2.2 Fold, summary, scope and stage-conditions specs pass with splits — e06fe7ad
- [x] 2.3 Stage action specs pass (persisted split read back, cap refusal leaves DB unchanged, plane-less refusal, add-etap copies split) — e06fe7ad
- [x] 2.4 Restore / snapshot-to-tree / import / user-delete-guard specs pass — e06fe7ad
- [x] 2.5 `pnpm test:parity` green on the regenerated fixture, figures diffed unchanged (fixture needed no regeneration: a one-person split hashes as the old `worker_id`) — e06fe7ad

### Phase 3: Cross-investment path on the same rule

#### Automated

- [x] 3.1 Pure pairs-fold spec passes — 4293a756
- [x] 3.2 DB pairs parity + Σ pairs = listing pass with split fixtures — 4293a756
- [x] 3.3 `settle-payouts.test.ts` and `kosztorys-subcontractor-due.test.ts` pass — 4293a756

### Phase 4: Editor UI — „Pracownicy etapu…"

#### Automated

- [x] 4.1 `stage-split-draft.test.ts` passes — b6622bf7
- [x] 4.2 `stage-split-dialog.test.tsx` passes — b6622bf7
- [x] 4.3 Updated workers-menu and add-menu DOM specs pass — b6622bf7

### Phase 5: Worker link, Podgląd and PDF

#### Automated

- [x] 5.1 `worker-view/summary.test.ts` passes (share per shared etap, no co-worker data) — bd371cef
- [x] 5.2 `print/worker.test.ts` passes (whole-etap totals, footer share) — bd371cef

### Phase 6: Living docs

#### Automated

- [x] 6.1 No automated check — prose-only phase
