# „Pozostało do wypłaty" per worker + „Rozlicz wypłaty" dialog — Implementation Plan

## Overview

Compute, for every investment × worker pair, what the worker earned on his etapy and what he was paid
on that investment. That one read feeds three surfaces:
- a new „Pozostało do wypłaty" column on `/pracownicy`, which replaces the all-time „Wypłaty" column;
- a „Rozlicz wypłaty" dialog, opened from the employee list (one worker, N investments) or the
  investment list (one investment, N workers);
- a cross-check against the investment list's existing column.

The dialog books one PAYOUT per ticked row, all in one database transaction. It refuses if any
figure moved since the dialog opened.

## Current State Analysis

- Per-worker settlement exists only client-side, from one investment's tree:
  - `subcontractorDueByPlane(rows, stages).byWorker` (`src/lib/kosztorys/subcontractor-due.ts`)
    minus `derivePayoutsByWorker`, rendered as „Podsumowanie pracowników" in the editor;
  - `computeWorkerSummary` for the worker view.
- The only cross-investment read is per investment: `selectKosztorysSubcontractorDue`
  (`src/lib/db/kosztorys-subcontractor-due.ts:73`, `GROUP BY investment_id`), which feeds the
  listing's `subcontractorRemaining` in `src/lib/queries/shape-investments.ts:103-106`. That listing
  figure = due − **every** PAYOUT on the investment (worker-less ones included), and is withheld when
  any etap holds executed qty with no rozliczenie.
- `/pracownicy` shows „Wypłaty" = all-time Σ PAYOUT per worker:
  - column: `src/components/tables/users.tsx:46-51`;
  - `UserRowT.balance`, fed by `fetchWorkerBalances` (`src/lib/queries/balances.ts:35-48`), which
    wraps `sumAllWorkerBalances` (`src/lib/db/sum-transfers.ts:110-130`);
  - pinned by `src/__tests__/sum-transfers.test.ts:74-100` and the golden master's `workers` axis
    (`financial-golden-master-db.test.ts:90,93,156,162,275,344,522`).
- Bulk booking exists only with one shared header (`createBulkTransferAction`,
  `src/lib/actions/transfers.ts:81-159`). Its mechanics are the template:
  - one `withPayloadTransaction`;
  - sequential awaited `payload.create({ req })`;
  - `{ skipSheetSync: true }`, then `after(() => syncBulkExpensesToSheet(ids))`, which already groups
    by investment and routes PAYOUT to the „transfery" tab (`sheets-sync.ts:116-121`).
- A completed or trashed investment refuses any transfer: `relatedInvestmentLockMessage`
  (`src/lib/db/investment-gate.ts`), with status `completed` = `LOCKED_INVESTMENT_STATUS`.
- PAYOUT stores no payment method (`carriesPaymentMethod` false; `hooks/transfers/validate.ts:190-194`).

## Desired End State

- **`/pracownicy`: „Wypłaty" is gone; „Pozostało do wypłaty" is in its place.**
  - The column shows Σ of the worker's positive, payable pairs. Overpaid pairs are never netted.
  - Markers: „nadpłata na N inw." and „N bez rozliczenia etapu".
  - Clicking the amount opens the dialog for that worker.
  - `/pracownicy/[id]` still shows its filtered „Wypłaty".
- **`/inwestycje`: the existing „Pozostało do wypłaty" cell opens the dialog for that investment.**
  Rows: one per worker, plus a greyed „Nieprzypisane" row = unassigned etapy − wypłaty bez
  pracownika. Σ rows = the cell.
- **Dialog rows:** Inwestycja/Pracownik | Wykonane | Wypłacone | Pozostało | Kwota wypłaty (prefilled,
  editable) | Po wypłacie (live „zostanie X" / „rozliczone" / „nadpłata X" in red).
  - Shared: data, kasa, opis. Footer: Razem.
  - A sentence above submit appears when any row pays ahead: „Wypłacasz X zł ponad wykonaną pracę
    (…) — to będzie zaliczka".
  - Already-overpaid rows start unticked.
  - Greyed, non-payable rows:
    - completed investment („Inwestycja zakończona — przywróć na Aktywna, żeby wypłacić");
    - etap without a rozliczenie („ustaw rozliczenie etapu");
    - „Nieprzypisane".
- **Submit books N PAYOUTs**, each with its own inwestycja + pracownik, in one transaction.
  - It refuses when any shown Pozostało differs from a fresh recompute, and the dialog reloads.
  - Where a row pays ahead, the server appends „w tym zaliczka X zł" to that PAYOUT's opis.
  - The sheet syncs once, after commit.
- MANAGER, OWNER and ADMIN see the column and can use the dialog.

### Key Discoveries:

- `byWorker` skips plane-less etapy entirely (`subcontractor-due.ts:63-68`), so no TS reference yet
  says *which worker's* pair is short. The worker view's `worker-view/scope.ts:23` blocks on any
  plane-less etap of his, **qty or not**; the pair flag gates on qty, like the listing SQL. The two
  differ on purpose: the view blocks a whole page, while the pair only withholds money that exists.
- "Has a kosztorys" on the listing = the investment has ≥1 `kosztorys_items` row
  (`kosztorys-client-totals.ts:47`, `shape-investments.ts:114`). The pair uses the same test.
- Szablon/trash filter convention: `i.status <> ${TEMPLATE_INVESTMENT_STATUS} AND i.trashed_at IS NULL`
  (`reference-data.ts:73`, `catalogue-usage.ts:16`).
- `payouts-by-worker.ts:20-22` ("never re-split this into its own GROUP BY worker_id") guards the
  single-investment block's snapshot consistency. It does not forbid a cross-investment read.
- `FormDialog` (`src/components/ui/form-dialog.tsx`) opens by a global `formId`.
  `data-table-row.tsx:28-44` ignores clicks inside `a, button`, so the trigger must be a `<Button>`.
- `1601b075`: summing grosz-rounded rows drifted 1 gr. Keep pair figures unrounded, and round once
  per displayed number.

## What We're NOT Doing

- No netting across investments, no „na etacie" flag, no change to the listing's own formula.
- PAYOUTs with no investment stay out, as do investments with no kosztorys (the pair is absent).
- No payment method field (PAYOUT never stores one).
- No change to the lock: completed investments stay unpayable until reopened.
- No per-pair axis in the golden master: the pair is pinned by the parity spec and the Σ = listing
  cross-check.
- No browser E2E in this change (filed to e2e-backlog in Phase 5).
- No change to the editor's „Podsumowanie pracowników", the worker view, or `/pracownicy/[id]`.

## Implementation Approach

Treat pair grain as a third projection of the existing SQL fold, not a third formula. Add `worker_id`
to the `lines` CTE's grouping and join PAYOUTs per (investment, worker). Pin it against the TS
reference (`byWorker` minus payouts per worker), exactly as the per-investment fold is pinned today.

A pure TS module turns pair rows into two shapes: the employee column, and dialog rows for either
target. It owns every classification (payable / overpaid / withheld / locked / unassigned), so the
column, the dialog and the action cannot classify a pair differently.

The action recomputes through the same SQL uncached, and refuses on any mismatch.

## Critical Implementation Details

- **Refuse-on-moved compares rounded figures.** The client sends each row's shown Pozostało. The
  server compares `roundToCents(recomputed)` to it, never raw floats. That way a float residue can't
  refuse a legitimate submit.
- **Sequential creates only** (EX-855, overlapping Payload transactions on Neon can lose rows): no
  `Promise.all` inside `withPayloadTransaction`. Sheet sync runs in `after()` only once the
  transaction has returned, so a rollback never leaves a synced ghost row.
- **Golden master regeneration must run on a fresh `pnpm db:import:test`** (plus the seeds its
  preconditions name). A changed input hash otherwise silently drops investments from the
  comparison.

## Phase 1: Per-pair read model

### Overview

The SQL pair fold, its TS reference, the pure shaping module and the cached fetch, pinned by DB specs
over constructed data.

### Changes Required:

#### 1. TS reference learns which worker is short

**File**: `src/lib/kosztorys/subcontractor-due.ts`

**Intent**: Let the reference implementation name the workers whose pair is short. The SQL
per-worker withhold then has something to be pinned against.

**Contract**: `SubcontractorDueByPlaneT` gains `unconfirmedWorkers: Set<number | null>`. A plane-less
etap that holds qty adds its `workerId` (`null` = unassigned). `hasUnconfirmedPlane` stays
`unconfirmedWorkers.size > 0`. Existing callers are unaffected.

#### 2. SQL pair fold

**File**: `src/lib/db/worker-payout-pairs.ts` (new; `server-only`, raw SQL + mapper only)

**Intent**: For every investment × worker pair, compute due, paid and the withhold flag in one
statement, over investments that have a kosztorys and are neither a szablon nor trashed.

**Contract**: `selectWorkerPayoutPairs(db, opts?: { investmentIds?: number[] }): Promise<WorkerPayoutPairRowT[]>`,
where `WorkerPayoutPairRowT = { investmentId: number; workerId: number | null; due: number; paid: number; hasUnconfirmedPlane: boolean; investmentStatus: string }`.
- **Due side:** the same `lines` CTE as `kosztorys-subcontractor-due.ts` plus `ks.worker_id`,
  grouped by `(investment_id, worker_id)`. It keeps the same price `CASE`, the same
  `FILTER (WHERE plane IS NOT NULL)` and the same qty-gated `bool_or`.
- **Paid side:** Σ amount of `type = 'PAYOUT' AND cancelled IS NOT TRUE AND investment_id IS NOT NULL`,
  grouped by `(investment_id, worker_id)`, worker-less included.
- **Join:** a FULL OUTER JOIN on the pair. Restrict to investments with ≥1 `kosztorys_items` row,
  `status <> TEMPLATE_INVESTMENT_STATUS`, `trashed_at IS NULL`. Carry the investment's status for the
  lock classification.
- `investmentIds` narrows to the action's recompute set.
- A header comment names `subcontractor-due.ts` as the reference and the parity spec as the pin,
  mirroring `kosztorys-subcontractor-due.ts:7-17`. Duplicating the `lines` CTE text is accepted;
  extracting a shared SQL fragment is fine if it reads cleanly.

**File**: `src/lib/kosztorys/payouts-by-worker.ts`

**Intent**: Scope the "never re-split into its own GROUP BY worker_id" comment to the
single-investment block, so it no longer reads as forbidding `selectWorkerPayoutPairs`.

**Contract**: comment only.

#### 3. Pure shaping module

**File**: `src/lib/kosztorys/worker-payout-pairs.ts` (new, React-free)

**Intent**: Classify every pair once, and project the rows into the employee column and the dialog
rows for either target.

**Contract**:
- `classifyPair(row)` returns `{ remaining, state }`:
  - `remaining = due − paid`, unrounded;
  - `state` is one of `'payable' | 'settled' | 'overpaid' | 'withheld' | 'locked' | 'unassigned'`;
  - precedence: `unassigned` (workerId null) → `withheld` (flag) → `locked` (status completed) →
    `overpaid` (< 0) → `settled` (0) → `payable`.
- `workerColumnFigures(rows)` returns a `Map<workerId, { owed, overpaidCount, withheldCount }>`:
  - `owed` = Σ positive remaining of payable **and locked** pairs (locked still counts, per owner);
  - rounded once at the end.
- `settleRowsForWorker(rows, workerId)` / `settleRowsForInvestment(rows, investmentId)` return
  ordered dialog rows. The investment target folds the `null` pair into one „Nieprzypisane" row whose
  remaining = unassigned due − worker-less paid.
- `paidAheadOf(remaining, amount) = max(0, amount − max(remaining, 0))` is the one zaliczka rule. The
  dialog and the action both import it.

#### 4. Cached fetch

**File**: `src/lib/queries/balances.ts`

**Intent**: Cache the pair read for the list pages. It must expire on any kosztorys or transfer
write.

**Contract**: `fetchWorkerPayoutPairs` is an `unstable_cache` over `selectWorkerPayoutPairs`:
- key `'worker-payout-pairs-v1'`;
- tags `[...KOSZTORYS_CLIENT_TOTALS_TAGS, CACHE_TAGS.transfers]`;
- returns the row array. It is not `cachedInvestmentMap`, which keys one row per investment.

### Success Criteria:

#### Automated Verification:

- Parity spec passes: `pnpm exec vitest run src/__tests__/lib/db/worker-payout-pairs.test.ts`. On
  constructed trees it checks four things:
  - each SQL pair's `due` equals `byWorker.get(workerId)`;
  - `hasUnconfirmedPlane` equals `unconfirmedWorkers.has(workerId)`;
  - `paid` equals `derivePayoutsByWorker` for that investment;
  - Σ pairs (incl. null) of `due − paid` equals the listing figure `due − totalPayouts` to the grosz
    when not withheld.

  The fixtures cover:
  - an assigned plane-less etap with qty (only that worker's pair is withheld);
  - 2+ workers on one investment;
  - an unassigned etap;
  - a worker-less PAYOUT;
  - a worker with PAYOUTs but no etap;
  - a completed investment;
  - excluded rows: a szablon, a trashed investment, an investment with no kosztorys, a cancelled
    PAYOUT, a PAYOUT with no investment.
- Unit spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/worker-payout-pairs.test.ts`.
  It covers:
  - the classification precedence;
  - no netting (a worker with +3000 and −500 shows owed 3000, overpaidCount 1);
  - locked pairs still counted in `owed`;
  - „Nieprzypisane" = unassigned due − worker-less paid;
  - `paidAheadOf` edges (remaining negative / zero / above amount);
  - rounding once.
- Existing reference spec still green: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-subcontractor-due.test.ts`

#### Manual Verification:

- None: no user-visible change in this phase.

---

## Phase 2: Employee list column

### Overview

Remove the all-time „Wypłaty" and everything that exists only to feed it. Add „Pozostało do wypłaty"
with its markers, display-only for now.

### Changes Required:

#### 1. Remove „Wypłaty"

**Files**:
- `src/components/tables/users.tsx`
- `src/types/table-rows.ts` (`UserRowT.balance`)
- `src/app/(frontend)/pracownicy/page.tsx`
- `src/lib/queries/balances.ts` (`fetchWorkerBalances`, `WorkerBalanceMapT`)
- `src/lib/db/sum-transfers.ts` (`sumAllWorkerBalances`)
- `src/__tests__/sum-transfers.test.ts:74-100`
- `src/__tests__/financial-golden-master-db.test.ts` (the `workers` input hash, snapshot and
  comparison entries)
- `src/__tests__/fixtures/financial-golden-master.json`

**Intent**: The figure mixed salary, loans, gifts and fuel. It was never a settlement. Its only
consumers are this page and the two specs.

**Contract**:
- `UserRowT` drops `balance`.
- The golden master's `SnapshotT` drops `workers` from both `inputHashes` and the snapshot.
- Regenerate with `pnpm test:golden:update` after a fresh `pnpm db:import:test` (plus the seeds its
  preconditions name).
- Deletion is gated on typecheck, not grep.

#### 2. Add „Pozostało do wypłaty"

**Files**:
- `src/app/(frontend)/pracownicy/page.tsx`
- `src/types/table-rows.ts`
- `src/components/tables/users.tsx`

**Intent**: Show each worker what the firm still owes him for kosztorys work, with the reasons a
pair is left out made visible.

**Contract**:
- The page fetches `fetchWorkerPayoutPairs()` beside `fetchReferenceData()` and maps
  `workerColumnFigures` onto `UserRowT.payoutRemaining?: { owed: number; overpaidCount: number; withheldCount: number }`.
  It is `undefined` when the worker has no pair.
- Column header = `SUBCONTRACTOR_FIGURE_LABELS.remaining`, right-aligned, `sortUndefined: 'last'`.
- Cell:
  - `formatPLN(owed)`, or „—" when there are no pairs;
  - „nadpłata na N inw." / „N bez rozliczenia etapu" as hinted markers, reusing `HintedValue` /
    `LabelHintIcon` from `components/tables/investments.tsx` (extract if they're file-private).

### Success Criteria:

#### Automated Verification:

- Golden master regenerated and green: `pnpm test:golden:update`, then `pnpm test:parity`
- `src/__tests__/sum-transfers.test.ts` passes without the worker-balance cases:
  `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`
- Column DOM spec passes: `pnpm exec vitest run src/__tests__/components/tables/users.test.tsx`
  (owed amount, „—", both markers)

#### Manual Verification:

- `/pracownicy` has no „Wypłaty" column. „Pozostało do wypłaty" shows the seeded worker's owed sum
  and markers.
- `/pracownicy/[id]` still shows „Wypłaty", and it follows the page filters.

---

## Phase 3: Booking action

### Overview

A new server action books N PAYOUTs, each with its own inwestycja + pracownik, after re-checking
every figure against a fresh recompute.

### Changes Required:

#### 1. Schema

**File**: `src/components/forms/settle-payouts-form/settle-payouts-schema.ts` (new)

**Intent**: Validate what the client may send. The server is the one that decides amounts are still
valid.

**Contract**: `settlePayoutsSchema` has these fields:
- `date`: ISO date;
- `sourceRegister`: number;
- `description`: string, optional;
- `rows`: 1..n of `{ investmentId, workerId, amount: > 0, expectedRemaining }`;
- pairs must be unique within `rows`.

#### 2. Action

**File**: `src/lib/actions/settle-payouts.ts` (new, `'use server'`)

**Intent**: Book the batch atomically, or refuse with a sentence the dialog can show.

**Contract**: `settlePayoutsAction(data)` goes through `protectedAction('settlePayoutsAction rows=N', …, ['transfers'])`
and returns `ActionResultT & { stale?: true }`. Steps, in order:
1. `validateAction(settlePayoutsSchema)`, then `validateSourceRegister`.
2. For each distinct investment, `relatedInvestmentLockMessage`. Refuse with the investment's name.
3. `selectWorkerPayoutPairs(db, { investmentIds })`, uncached. For each row:
   - the pair must exist and `classifyPair` must be `payable | settled | overpaid`, else refuse;
   - `roundToCents(remaining)` must equal `expectedRemaining`, else return
     `{ success: false, stale: true, error: 'Kwoty zmieniły się od otwarcia okna — wczytuję je ponownie.' }`.
4. Per row, `description` = the shared opis, plus `\nw tym zaliczka X zł` when
   `paidAheadOf(remaining, amount) > 0`. X is formatted with `formatPLN`.
5. `withPayloadTransaction(payload, req => sequential payload.create({ collection: 'transactions', req, data: { type: 'PAYOUT', amount, date, sourceRegister, investment, worker, description, createdBy } }), { skipSheetSync: true })`.
6. `after(() => syncBulkExpensesToSheet(createdIds))`.

### Success Criteria:

#### Automated Verification:

- DB action spec passes: `pnpm exec vitest run src/__tests__/lib/actions/settle-payouts.test.ts`,
  modelled on `payout-without-stages.test.ts`. It asserts **persisted rows**, not the return value:
  - two investments × one worker book two PAYOUTs with the right inwestycja/pracownik/kwota;
  - a pay-ahead row gets the „w tym zaliczka" line, and an exact row doesn't;
  - a stale `expectedRemaining` → `stale: true` and **zero** rows written;
  - a completed investment → refused, zero rows;
  - a withheld pair and the unassigned pair → refused, zero rows;
  - a failure on row 2 rolls back row 1.

#### Manual Verification:

- None beyond Phase 4 (the action has no UI of its own).

---

## Phase 4: „Rozlicz wypłaty" dialog

### Overview

The dialog loads fresh rows on open, handles the row math live, and is wired into both lists.

### Changes Required:

#### 1. On-demand read

**File**: `src/lib/queries/settle-payouts.ts` (new, `'use server'`)

**Intent**: Give the dialog fresh rows for its target without shipping every pair to the list page's
client.

**Contract**: `fetchSettlePayoutRows(target: { kind: 'worker' | 'investment'; id: number })` calls
`requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)`, reads `fetchWorkerPayoutPairs()` (tag-expired on every
relevant write, so fresh), and returns `settleRowsFor…` joined with investment/worker names from
reference data.

#### 2. Dialog + form

**Files**:
- `src/components/dialogs/settle-payouts-dialog.tsx` (new)
- `src/components/forms/settle-payouts-form/settle-payouts-form.tsx` (new)

**Intent**: Deliver the agreed row UI and submit through the action. On `stale`, reload the rows in
place.

**Contract**:
- One dialog instance per table, opened with a target. It uses `FormDialog` with a per-target
  `formId`, or a controlled `Dialog`; whichever fits `FormDialog`'s global-`formId` model.
- The form uses `useAppForm`, with shared `date` (today, `warsawToday`) and `sourceRegister` (default
  `getDefaultCashRegister(referenceData)`), plus an optional opis.
- Per row: a tick and a `Kwota wypłaty` input.
  - Prefill: payable → remaining; overpaid → unticked, empty.
  - Greyed, non-tickable rows show the reason text: locked, withheld, „Nieprzypisane".
- „Po wypłacie" and the pay-ahead sentence come from `paidAheadOf`. „Razem" = Σ ticked amounts.
- Submit is disabled with no ticked row. Refresh on success follows the `use-form-submit` pattern.

#### 3. Triggers

**Files**:
- `src/components/tables/users.tsx`
- `src/components/tables/investments.tsx` (the `subcontractorRemaining` cell)
- `src/components/users/user-data-table.tsx`
- the investments data table that owns the column

**Intent**: Clicking „Pozostało do wypłaty" opens the dialog for that row.

**Contract**:
- The amount renders as a `<Button variant="link">`. The row-click guard (`data-table-row.tsx:28-44`)
  then leaves navigation alone.
- Employee rows get a trigger when they have any pair. Investment rows get one when the figure is
  defined; a withheld listing cell stays non-clickable.

### Success Criteria:

#### Automated Verification:

- Form DOM spec passes: `pnpm exec vitest run src/__tests__/components/forms/settle-payouts-form/settle-payouts-form.test.tsx`.
  It covers:
  - prefill, and an overpaid row starting unticked;
  - live „zostanie / rozliczone / nadpłata";
  - the pay-ahead sentence appearing only when a row exceeds;
  - Razem;
  - greyed rows not tickable;
  - submit disabled with nothing ticked;
  - `stale` → rows refetched (action mocked explicitly, per the `stubServerActions` rule).

#### Manual Verification:

- From `/pracownicy`, the seeded worker's dialog lists his investments. Paying one exact and one
  ahead books two wypłaty, and the opis of the second says „w tym zaliczka X zł". The column updates
  after submit.
- From `/inwestycje`, the seeded 2-worker investment's rows plus „Nieprzypisane" sum to the cell.
- A completed investment's row is greyed with the reopen hint. A withheld worker's row says „ustaw
  rozliczenie etapu".
- Book from a second tab between opening and submitting: the first dialog refuses and reloads.
- The wypłaty appear on the owner's sheet „transfery" tab (production-only write; locally, check
  the log line).
- Logged in as MANAGER, the column and dialog work.

---

## Phase 5: Seed, docs, closure

### Overview

A seed for manual checks, the living docs brought up to date, and the loose ends closed.

### Changes Required:

#### 1. Seed

**File**: `src/scripts/seed-worker-payouts.ts` (new) + `package.json` `seed:worker-payouts` (test-DB
pattern, like `seed:kosztorys-*`)

**Intent**: Build the cases real data lacks, so the manual checks have something to open.

**Contract**: The seed is idempotent. It creates or refreshes one worker with pairs on 2 investments,
one investment with 2+ workers plus an unassigned etap and a worker-less wypłata, an assigned
plane-less etap with qty, and a completed investment with a positive pair.

#### 2. Docs

**Files**:
- `context/foundation/investment-financials-and-discount.md` (per-worker figure next to the listing
  column rules at `:168-187`)
- `context/reference/kosztorys-editor-domain-notes.md` (pair grain, unassigned row, zaliczka line)
- `context/foundation/test-plan.md` (new risk: bulk PAYOUT books wrong pairs or books on stale
  figures, via `/10x-test-plan`)
- `context/reference/manual-verification.md` (the seed command)

**Intent**: Keep the living docs true.

**Contract**: prose sections only.

#### 3. Closure

- Archive `context/changes/2026-09-03-worker-payouts-on-employee-card/` (superseded) under
  `context/archive/`.
- File the E2E as a Linear issue labelled `e2e-backlog` in project „Wykonczymy": open dialog from
  `/pracownicy` → book → column refreshes.

### Success Criteria:

#### Automated Verification:

- Seed runs twice cleanly against the test DB: `pnpm seed:worker-payouts && pnpm seed:worker-payouts`
- The e2e-backlog issue id is recorded in this plan's Progress line.

#### Manual Verification:

- Docs read correctly against the shipped behaviour.

---

## Testing Strategy

### Unit Tests:

- Classification precedence, no netting, locked pairs counted, the unassigned fold, `paidAheadOf`,
  and rounding once (`worker-payout-pairs.test.ts`).

### Integration Tests:

- SQL ↔ TS parity per pair, and Σ pairs = listing figure (`lib/db/worker-payout-pairs.test.ts`).
- Action: persisted rows, the refusals, rollback (`lib/actions/settle-payouts.test.ts`).
- Golden master regenerated without the `workers` axis.

### Manual Testing Steps:

1. `pnpm seed:worker-payouts`, then open `/pracownicy` and `/inwestycje` on the test DB.
2. Walk the Phase 4 manual list: exact pay, pay ahead, stale refusal, greyed rows, MANAGER.

## Performance Considerations

One aggregate over stages ⋈ progress ⋈ items plus one over PAYOUTs, the same order of cost as the
existing listing fold. It is cached and tag-expired, so the list pages pay it once per write. The
action's recompute is narrowed to the batch's investments.

## Migration Notes

No schema change, no migration.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Parity suite passes: `pnpm test:parity`
- Unit + DOM suite passes: `pnpm test` (on explicit go only; the user runs the full suite)

## References

- Research: `context/changes/2026-09-29-worker-payout-remaining/research.md`
- Decisions: `context/changes/2026-09-29-worker-payout-remaining/change.md`
- Per-investment fold (the pattern): `src/lib/db/kosztorys-subcontractor-due.ts`
- Bulk booking mechanics: `src/lib/actions/transfers.ts:81-159`
- Listing column: `src/components/tables/investments.tsx:258-266`, `src/lib/queries/shape-investments.ts:103-106`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Per-pair read model

#### Automated

- [x] 1.1 Parity spec passes (`lib/db/worker-payout-pairs.test.ts`) — bf24a1f1
- [x] 1.2 Unit spec passes (`lib/kosztorys/worker-payout-pairs.test.ts`) — bf24a1f1
- [x] 1.3 Existing reference spec still green (`kosztorys-subcontractor-due.test.ts`) — bf24a1f1

### Phase 2: Employee list column

#### Automated

- [x] 2.1 Golden master regenerated and green — 52c252bd
- [x] 2.2 `sum-transfers.test.ts` passes without worker-balance cases — 52c252bd
- [x] 2.3 Column DOM spec passes (`components/tables/users.test.tsx`) — 52c252bd

### Phase 3: Booking action

#### Automated

- [x] 3.1 DB action spec passes (`lib/actions/settle-payouts.test.ts`) — c32e0639

### Phase 4: „Rozlicz wypłaty" dialog

#### Automated

- [ ] 4.1 Form DOM spec passes (`settle-payouts-form.test.tsx`)

### Phase 5: Seed, docs, closure

#### Automated

- [ ] 5.1 Seed runs twice cleanly against the test DB
- [ ] 5.2 e2e-backlog issue id recorded
