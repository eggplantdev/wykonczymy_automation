# Expense duplicate finder Implementation Plan

Refs: EX-1026 (the audit tool), EX-1053 follow-up (duplicates inside one zgłoszenie).

## Overview

Two things share one new engine:

1. **„Szukaj duplikatów”**, a diagnostic dialog on the home transfers list (`/`). The table's current
   filters plus a picked date range set which documents are checked. Those documents are compared
   against the whole company: every receipt transakcja and every undecided paragon of every pending
   zgłoszenie. Results come in two groups. Strong groups are expanded on top. Weak groups (same amount
   only) sit in a collapsed „Słabe (N)” section, one group per amount. Every row is a link and there
   are no actions.
2. The zgłoszenie acceptance dialog moves onto the same engine. Undecided paragony of one zgłoszenie
   are then compared with each other, and with transakcje booked from its other paragony. Today
   `excludeDraftId` hides that whole zgłoszenie from its own check.

## Current State Analysis

- `matchExpense(probe, candidate, today)` (`src/lib/expense-duplicates/match.ts`) is the only matcher.
  It returns `same-number` / `same-receipt` / `same-amount`, and `isWeakMatch` means same-amount only.
  The same-amount branch is anchored on **today**: `toWarsawDay(candidate.date) >= addMonthsToDay(today, -3)`.
  In a scan of an older period, two identical receipts from 2025 can never be a weak pair. The
  matcher is also asymmetric: when the probe's amount is unread, its number counts alone, and only
  `candidate.date` is checked.
- The loaders in `src/lib/db/expense-duplicate-candidates.ts` are built around one probed zgłoszenie:
  - `loadDraftProbes(db, draftId)` returns every read row of the draft, decided ones included.
  - `loadTransactionCandidates` = `loadBookedTransactions` + `loadMergedParagony`. Each paragon of a
    merged transakcja is its own candidate, keyed `transaction-{id}-{position}`.
  - `loadDraftCandidates` returns the read rows of other pending drafts, keyed `draft-{id}-{ordinality}`.
    Ordinality is **1-based** while `readRow` is 0-based.
  - All of them take `{amountsCents, documentNumbers}` plus `excludeDraftId`, which drops every
    transakcja booked from the probed draft (`notBookedFrom`) and the draft's own read rows
    (`d.id <> excludeDraftId`). That exclusion is why a paragon sent twice inside one zgłoszenie is
    never flagged (review-gate ledger EX-1053, line 11).
- `findExpenseDraftDuplicates(draftId)` (`src/lib/queries/expense-draft-duplicates.ts`) loops
  probes × candidates and returns `ParagonDuplicatesT[]` per read row. Its only caller is
  `use-expense-draft-acceptance.tsx:127`.
- A „decided” read row is defined by `DECIDED_READ_ROWS` (`src/lib/db/worker-expense-drafts.ts:484`):
  `worker_expense_draft_transfers.read_rows` ∪ `worker_expense_draft_skipped_receipts.read_row`.
- Transfers toolbar: `transfer-data-table.tsx:59` builds
  `fetchRows = (opts) => fetchFilteredTransfers(config.query.where, opts)`, and `:121` renders
  `InvoiceDownloadDialog` behind the `invoiceDownload` flag of `TransferTableConfigT`
  (`transfer-table-config.ts:30`). The home page (`components/dashboard/manager-dashboard.tsx`) passes
  `config.query.where = buildTransferFilters(searchParams, { id: 0 })`.
- `PendingExpenseDrafts` renders on both `/` and `/zgloszenia-wydatkow`. It opens a draft through
  `useExpenseDraftAcceptance(referenceData).open(draft)`. No URL param opens a draft today.
- Volume (local dump, measured in planning): about 4k receipt documents. Same-amount noise makes up
  most of the weak tier, which drove the grouped, collapsed weak section.

## Desired End State

- On `/`, management sees a „Szukaj duplikatów” button next to the other table actions. It opens a
  dialog with a DateRangePicker, prefilled from the URL range. „Analizuj” returns:
  - **Strong groups:** each is a connected set of documents linked by `same-number` or `same-receipt`,
    and contains at least one document in scope. Expanded.
  - **„Słabe (N)”**, collapsed: same-amount-only pairs grouped by amount, each group containing at
    least one in-scope document and no pair already inside a strong group.
  - Each row links out in a new tab. A transakcja opens on its investment's transfers page (or `/?id=N`
    when it has no investment). A zgłoszenie opens at `/zgloszenia-wydatkow?zgloszenie=N`, which opens
    its acceptance dialog. If that zgłoszenie is no longer pending, a toast says so.
- In the acceptance dialog, an undecided paragon that repeats another undecided paragon of the same
  zgłoszenie, or a transakcja booked from another of its paragony, gets a duplicate hint. A decided
  paragon is no longer probed: it can't be booked again, and this keeps it from matching the transakcja
  booked from it.
- Verify: the specs listed per phase pass. Manual bullets cover the dialog against the local DB.

### Key Discoveries:

- `matchExpense` is pure and already unit-tested (`src/__tests__/lib/expense-duplicates/match.test.ts`).
  The `:125` case („no match when the twin was booked more than 3 months ago”) is the one the pairwise
  window rewrites.
- A probe's date exists everywhere it's needed. A transakcja has `date`, a pending read row has the
  draft's `sent_at`, and `findExpenseDraftDuplicates` has the probed draft's `sent_at`, so `today` can
  leave the signature.
- `findAllTransfersForExport(where, sort)` / Payload `find` evaluate any `Where` the table builds.
  `where-to-sql` throws on unmapped fields (`src/lib/db/where-to-sql.ts:68`), so scope ids come from
  Payload, not a SQL translation.
- `withDateRange(where, range)` (`src/lib/queries/transfer-filters.ts:284`) only takes a closed range.
  `urlDateRange` / `isClosedRange` / `ALL_TIME` are in `src/lib/utils/date-range.ts`, and
  `useLatestRequest` is in `src/hooks/use-latest-request.ts`.
- Correlated `jsonb_array_elements` hits the JIT trap (`context/foundation/lessons.md:1542-1556`).
  Expand draft reads once in a CTE with `WITH ORDINALITY`, as `loadDraftCandidates` already does.

## What We're NOT Doing

- No actions in the finder: no „Duplikat” / „to nie duplikat”, and no dismissed-pairs table. It's
  diagnostic only (user decision).
- No finder on other transfer lists (investment / kasa / worker pages). Only `/`.
- No new filter pickers in the dialog. Scope is the table's filters plus the range.
- No backfill of `document_number` / `seller_nip` on old rows (the open question in EX-1026). The
  matcher's „Notatka” line-1 / „Opis” printed-date fallbacks are what old rows get.
- No change to which matches count as strong or weak. Only the same-amount window becomes pairwise.
- No E2E. The risk is the engine and the loaders (unit + DB), plus the dialog wiring (DOM).

## Implementation Approach

The engine works on one shape: a **document** (`CandidateT`, extended with its origin and
`investmentId`). Callers decide which documents are _probes_. The engine:

1. Indexes documents by cents and by normalized number, then compares each probe only with documents
   sharing its cents or number, so it never compares all pairs (about 18M calls at 4k rows).
2. Compares each pair in both orientations and merges the reasons, so a pair comes out the same
   whichever side is the probe.
3. Drops pairs that are one document, or siblings by origin (rules below).
4. Returns **pairs** (for the zgłoszenie dialog's per-paragon hints) and, on top of them, **groups**
   (for the finder): strong groups via union-find over strong pairs, weak groups bucketed by cents.

The loaders lose `excludeDraftId`, drop decided read rows from pending drafts, and carry each
document's origin so the engine can apply the identity rules. Both callers use the same loaders.

**Identity / sibling rules (the engine's invariant):**

- A document never pairs with itself (same `key`).
- Documents with the same `source: 'transaction'` and `id` never pair. These are one transakcja and the
  paragony it was merged from.
- A pending read row (`draftId = D, readRows = [r]`) never pairs with a transakcja booked from D whose
  `readRows` contain r. If that transakcja's `readRows` is empty (booked before read rows were tracked),
  it never pairs with any read row of D. Undecided read rows of D **do** pair with each other, and with
  transakcje booked from D's other read rows.
- Decided read rows are never documents. The loader removes them, so they're neither probes nor
  candidates.

## Critical Implementation Details

- **Origin indexing.** `loadDraftCandidates` keys by 1-based ordinality, while `readRow` everywhere else
  (`read_rows`, `skipped_receipts.read_row`, `loadDraftProbes`) is 0-based. Origins use the 0-based
  `readRow`. Keep the key's existing form or change it consistently, but never compare a key's number
  with `readRows`.
- **The finder's candidate filter is derived from the probes.** Load the probes first, then load
  candidates with `{amountsCents, documentNumbers}` taken from those probes (the existing filter
  mechanism). Every match needs equal cents or an equal number, so this loses nothing. It also bounds
  the load to the documents that can possibly match, so a one-month scope doesn't pull the full
  4k-row history with pages.
- **The zgłoszenie link opens a dialog on arrival.** That means an async download plus a server read,
  which is an external effect. It's the one place this change uses a `useEffect`: it runs once per
  param value, guarded by a ref, and calls `router.replace` without `zgloszenie` so a refresh or a
  close doesn't reopen it.

## Phase 1: Engine (pure)

### Overview

A pairwise same-amount window in the matcher, plus a new grouping module with the identity rules,
indexing, pairs and groups. No I/O.

### Changes Required:

#### 1. Pairwise window

**File**: `src/lib/expense-duplicates/match.ts`

**Intent**: The same-amount branch checks the distance between the two documents' dates, not the
candidate's distance from today, so a period scan of old data still yields weak pairs.

**Contract**: `matchExpense(probe: DatedDocT, candidate: DatedDocT): MatchVerdictT | null`. `today` is
dropped. Same-amount requires both `date`s, and `|toWarsawDay(probe.date) − toWarsawDay(candidate.date)|`
must be ≤ `SAME_AMOUNT_WINDOW_MONTHS` (compared with `addMonthsToDay` in both directions). Export
`DatedDocT`. The `same-number` / `same-receipt` branches are unchanged.

#### 2. Grouping engine

**File**: `src/lib/expense-duplicates/find-duplicates.ts` (new). Types go in
`src/lib/expense-duplicates/types.ts` if the module would otherwise mix them.

**Intent**: Apply the identity rules, index, match both orientations, return pairs and groups.

**Contract**:

```ts
// Origin fields the identity rules read; CandidateT (phase 2) extends this.
type DocumentT = DatedDocT & {
  key: string
  source: 'transaction' | 'draft'
  id: number
  draftId: number | null // the zgłoszenie it was booked from / sent in
  readRows: number[] // 0-based; a pending read row carries [its row]
}
type DuplicatePairT<D> = { a: D; b: D; reasons: MatchReasonT[] }
export function findDuplicatePairs<D extends DocumentT>(
  documents: D[],
  isProbe: (doc: D) => boolean,
): DuplicatePairT<D>[] // each unordered pair once, at least one side a probe
export function groupDuplicates<D extends DocumentT>(
  pairs: DuplicatePairT<D>[],
): { strong: DuplicateGroupT<D>[]; weak: DuplicateGroupT<D>[] }
type DuplicateGroupT<D> = { key: string; reasons: MatchReasonT[]; members: D[] }
```

- Strong groups are connected components over pairs with any non-`same-amount` reason.
- Weak groups are same-amount-only pairs bucketed by `cents`, excluding a pair whose two ends already
  share a strong group.
- Ordering is deterministic: groups by the newest member's date desc, then key; members by date desc,
  then key.

#### 3. Unit specs

**Files**: `src/__tests__/lib/expense-duplicates/match.test.ts` (rewrite the `:125` case, add pairwise
cases), `src/__tests__/lib/expense-duplicates/find-duplicates.test.ts` (new).

**Intent**: Pin the window and every identity rule. Write the rule tests first (`/10x-tdd`).

**Contract**: The cases cover:

- two 2025 twins 10 days apart → weak pair;
- twins 4 months apart → none;
- the pair is the same whichever side is the probe;
- merged-transakcja siblings never pair;
- a read row never pairs with the transakcja booked from it, nor with one booked from its zgłoszenie
  with empty `readRows`;
- two undecided read rows of one zgłoszenie pair;
- A–B strong and B–C strong → one group;
- a weak pair inside a strong group is not repeated in the weak section;
- a pair of two non-probes is never returned.

### Success Criteria:

#### Automated Verification:

- Matcher spec passes: `pnpm exec vitest run src/__tests__/lib/expense-duplicates/match.test.ts`
- Engine spec passes: `pnpm exec vitest run src/__tests__/lib/expense-duplicates/find-duplicates.test.ts`

#### Manual Verification:

- None. The engine is pure; the phases 2 and 4 checks exercise it.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Loaders and the zgłoszenie path

### Overview

Generalize the loaders and move `findExpenseDraftDuplicates` onto the engine, so the acceptance dialog
catches duplicates inside one zgłoszenie.

### Changes Required:

#### 1. Loaders

**File**: `src/lib/db/expense-duplicate-candidates.ts`

**Intent**: Remove `excludeDraftId`. Drop decided read rows from pending drafts. Carry each document's
origin and `investmentId`. Let a caller select transakcje by id (the finder's probes) as well as by
amount or number.

**Contract**:

- `CandidateT` gains `investmentId: number | null`, `draftId: number | null` and `readRows: number[]`,
  and satisfies phase 1's `DocumentT`.
- The selector is `CandidateFilterT = { amountsCents; documentNumbers } | { transactionIds: number[] }`.
- `loadBookedTransactions`: `draftId` / `readRows` come from `worker_expense_draft_transfers`, or
  null / `[]` for a manual booking.
- `loadMergedParagony`: the same origin; the paragon's `readRows` is the whole merged set, which is
  enough for the sibling rule.
- `loadDraftCandidates`: drops read rows in the decided set (the `DECIDED_READ_ROWS` logic, as a
  `NOT IN` over the CTE's 0-based row, not a correlated expansion) and carries `draftId = d.id`,
  `readRows = [ordinality − 1]`. It takes an optional `draftId` to load one draft's undecided rows
  (the dialog's probes).
- `loadDraftProbes` is removed. Its job is `loadDraftCandidates({ draftId })` without a filter.

#### 2. Zgłoszenie dialog query

**File**: `src/lib/queries/expense-draft-duplicates.ts`

**Intent**: Probes are the draft's undecided read rows, dated by its `sent_at`. Candidates are
transakcje and pending read rows (this draft included) filtered by the probes' cents and numbers.
`findDuplicatePairs` replaces the nested loop.

**Contract**: The return shape `ParagonDuplicatesT[]` and its sort are unchanged. One entry per
**undecided** read row. `matches` = the other side of each pair touching that probe. The client
(`expense-draft-duplicate-hints.tsx`) is untouched.

#### 3. DB specs

**File**: `src/__tests__/lib/db/expense-duplicate-candidates.db.test.ts`

**Intent**: Lead with a red test for the EX-1053 follow-up (`/10x-tdd`), then adapt the
self-exclusion test.

**Contract**:

- New: a pending zgłoszenie whose read rows 0 and 2 are the same paragon → `findExpenseDraftDuplicates`
  flags row 2 with `draft-{id}-…` row 0, and vice versa.
- New: row 0 booked as a transakcja, row 3 its undecided twin → row 3 matches that transakcja.
- Adapted `:273`: a decided read row is not in the result at all, and no undecided row matches the
  transakcja booked from itself.
- Loaders never return a decided read row (booked or skipped).
- Existing cases (merged paragon matched by a new zgłoszenie `:237`, etc.) stay green after their
  calls lose `excludeDraftId`.

### Success Criteria:

#### Automated Verification:

- Candidates DB spec passes against 5435: `set -a && source .env && set +a && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec vitest run src/__tests__/lib/db/expense-duplicate-candidates.db.test.ts`
- Duplicate-mark DOM spec still passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/expense-draft-duplicate-mark.test.tsx`

#### Manual Verification:

- A pending zgłoszenie holding the same paragon twice (two photos of one receipt) → „Zweryfikuj”: both
  paragony show „Możliwe duplikaty” pointing at each other.
- A zgłoszenie with one paragon booked and its twin still waiting → the waiting one shows the booked
  transakcja as a possible duplicate. The booked one shows no hint against itself.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Finder query

### Overview

A management-only server read that turns the table's scope plus a range into strong and weak groups.

### Changes Required:

#### 1. Finder

**File**: `src/lib/queries/expense-duplicate-groups.ts` (new, `'use server'`)

**Intent**: Resolve the in-scope transakcja ids, load probes and candidates, run the engine, and keep
the groups that contain a probe.

**Contract**:

```ts
export async function findExpenseDuplicateGroups(
  where: Where,
  range: DateRangeT,
): Promise<
  ActionResultT<{ strong: DuplicateGroupT<CandidateT>[]; weak: DuplicateGroupT<CandidateT>[] }>
>
```

- Access: `requireAuth(MANAGEMENT_ROLES)`, the same as `fetchFilteredTransfers`
  (`src/lib/queries/fetch-transfers-for-invoices.ts`). A read, not a mutation, so it lives in
  `lib/queries`.
- Scope:
  - `withDateRange(where, range)` when `isClosedRange(range)`, else `where` as is (all time is allowed:
    old data is the audit's main target).
  - Restrict to receipt types (`INVESTMENT_EXPENSE`, `INVESTMENT_EXPENSE_NET`, `OTHER`) and
    `cancelled ≠ true`.
  - Resolve ids through Payload `find` (`depth: 0`, `pagination: false`, `select: { id: true }`).
- Probes are the scoped transakcje, their merged paragony, and **every undecided read row of every
  pending zgłoszenie**. The pending queue is small, and each of those rows can still be booked, so the
  table's transakcja filters don't narrow it.
- Candidates are loaded by the probes' cents and numbers across the whole company. The probe set and
  the candidate set are unioned by `key` before `findDuplicatePairs`.

#### 2. DB spec

**File**: `src/__tests__/lib/queries/expense-duplicate-groups.db.test.ts` (new; check the mirror path
matches the integration discovery in `scripts/test-integration.sh`)

**Intent**: Pin scope and company-wide matching on the real DB.

**Contract**:

- A twin in another investment, outside the range, is found when one side is in scope.
- A pair with both sides out of scope is absent.
- The table's `where` (e.g. one investment) narrows the probes but not the candidates.
- A pending read row's twin booked last year appears with the pending row as the probe.
- A cancelled transakcja is never a member.
- EMPLOYEE is refused.

### Success Criteria:

#### Automated Verification:

- Finder DB spec passes against 5435: `set -a && source .env && set +a && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec vitest run src/__tests__/lib/queries/expense-duplicate-groups.db.test.ts`

#### Manual Verification:

- None separate; phase 4's dialog checks exercise it.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: UI

### Overview

The „Szukaj duplikatów” dialog on the home transfers list, link rendering, and `?zgloszenie=N` on the
zgłoszenia page.

### Changes Required:

#### 1. Table flag

**Files**: `src/components/transfers/transfer-table-config.ts`, `transfer-data-table.tsx`,
`src/components/dashboard/manager-dashboard.tsx`

**Intent**: A `duplicateFinder?: boolean` flag with a doc comment, in the style of `invoiceDownload`.
Only the home page sets it. The toolbar renders the dialog with
`findGroups = (range) => findExpenseDuplicateGroups(config.query.where, range)`.

#### 2. Dialog

**File**: `src/components/transfers/duplicate-finder-dialog.tsx` (new)

**Intent**: A dialog built from the InvoiceDownloadDialog / TelmakCheckDialog patterns.

**Contract**:

- Trigger button „Szukaj duplikatów”. Range from `urlDateRange(searchParams)`, `DateRangePicker stacked`.
- „Analizuj” calls `findGroups` through `settleAction` + `useLatestRequest`.
- States: idle / loading / error with retry / empty („Nie znaleziono możliwych duplikatów”) / results.
- Results:
  - Strong groups expanded, one block each: a header with the reasons and member count, then a
    compact table.
  - A collapsed `CollapsibleSection` „Słabe (N)” holding one block per amount.
- Wide dialog: `sm:max-h-[94vh] sm:max-w-[96vw] overflow-auto`, as in Telmak.

#### 3. Result rows and links

**Files**: `src/components/tables/expense-duplicates.tsx`, `src/lib/expense-duplicates/document-href.ts`
(new, if no existing home fits)

**Intent**: Reuse `getExpenseDuplicateColumns` for group members. „Pasuje do” becomes a link
(`target="_blank"`) when a link option is passed. The zgłoszenie dialog keeps plain text.

**Contract**: `documentHref(doc)` → `investmentTransfersHref(doc.investmentId, { id })` when a
transakcja has an investment, `/?id=N` when it has none, `/zgloszenia-wydatkow?zgloszenie=N` for a
draft. Status column: in the finder it shows the pair's reasons for the group, not the per-paragon
decision; drop the Akcje column.

#### 4. `?zgloszenie=N`

**Files**: `src/app/(frontend)/zgloszenia-wydatkow/page.tsx`, `src/components/worker-expenses/pending-expense-drafts.tsx`

**Intent**: The page parses `sp.zgloszenie` (a positive int) and passes `openDraftId` to
`PendingExpenseDrafts`, which opens that draft's acceptance dialog once on arrival, then removes the
param.

**Contract**:

- If the id isn't in `drafts`, toast „To zgłoszenie jest już rozpatrzone” and drop the param.
- `PendingExpenseDrafts` returns null for an empty queue, so the toast must still fire then: render the
  opener before the early return, or lift it to the page.
- The home page passes no `openDraftId`.

#### 5. DOM specs

**Files**: `src/__tests__/components/transfers/duplicate-finder-dialog.test.tsx` (new),
`src/__tests__/components/worker-expenses/pending-expense-drafts.test.tsx` (extend)

**Contract**:

- Dialog:
  - strong groups render expanded and weak ones collapsed under „Słabe (N)”;
  - a transakcja row links to its investment's transfers page in a new tab, and a zgłoszenie row to
    `?zgloszenie=N`;
  - the empty state renders.
  - The action is a `vi.fn` prop, never the stubbed server module.
- Queue:
  - `openDraftId` of a listed draft opens its dialog once;
  - an unlisted id toasts and doesn't open.

#### 6. Docs

**Files**: `context/foundation/test-plan.md` (risk #26 row and its coverage row)

**Intent**: Name the new engine, finder and in-zgłoszenie specs under risk #26.

### Success Criteria:

#### Automated Verification:

- Dialog DOM spec passes: `pnpm exec vitest run src/__tests__/components/transfers/duplicate-finder-dialog.test.tsx`
- Queue DOM spec passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/pending-expense-drafts.test.tsx`

#### Manual Verification:

- `/` as OWNER → „Szukaj duplikatów” → range of the last 3 months → „Analizuj”: strong groups are listed
  expanded and „Słabe (N)” is collapsed. Expanding it shows one block per amount.
- Filter the list to one investment first, then analyse: every group contains a transakcja of that
  investment, and its twin may belong to another investment.
- Click a transakcja in a group: a new tab opens that investment's transfers filtered to that one
  transakcja. The dialog in the first tab keeps its results.
- Click a zgłoszenie in a group: a new tab opens Zgłoszenia wydatków with that zgłoszenie's „Zweryfikuj”
  dialog open, and a refresh doesn't reopen it.
- Open `/zgloszenia-wydatkow?zgloszenie=<an already accepted one>`: a toast says it's already
  rozpatrzone and no dialog opens.
- „Wszystko” (all time) → „Analizuj”: results come back in a few seconds, not a timeout.
- Investment and kasa pages show no „Szukaj duplikatów” button.

**Implementation Note**: The final phase runs the whole-tree gate below.

---

## Testing Strategy

### Unit Tests:

- The matcher's pairwise window and symmetry.
- Every engine identity rule, strong clustering and weak bucketing (phase 1).

### Integration Tests:

- Loaders: decided rows excluded; origins carried; in-zgłoszenie duplicates found (phase 2).
- Finder: scope narrows probes, not candidates; out-of-scope pairs absent; management only (phase 3).

### Manual Testing Steps:

The phase 2 and phase 4 `#### Manual Verification` bullets, on local (5435 by default, per
`context/reference/manual-verification.md`).

## Performance Considerations

- Engine: indexed by cents and number, so the work is roughly Σ(bucket sizes) per probe, not n².
  Round amounts (100,00 zł) make the biggest buckets. That is the weak noise already measured, and
  grouping by amount keeps it to one block per amount.
- Load: the probes first, then candidates filtered by the probes' cents and numbers. An all-time scope
  makes the filter cover the whole history (about 4k transakcje with their `pages` JSON). If that pass
  is slow in the all-time manual check, load without pages and fetch pages for group members only. Do
  that in this change only if the measurement calls for it.

## Whole-tree Gate

Run once, after phase 4.

- Typecheck: `pnpm typecheck`
- Lint on changed files: `pnpm exec eslint <changed files>`
- Integration legs touched by the change: the two DB specs above, plus
  `src/__tests__/lib/db/worker-expense-drafts.db.test.ts` (shares the decided-rows logic)
- Full `pnpm test` / `pnpm test:integration` only on an explicit ask (standing rule).

## References

- Change notes: `context/changes/2026-10-14-expense-duplicate-finder/change.md`
- Prior change: `context/changes/2026-10-13-worker-expense-paragon-decisions/review-gate.md` (line 11)
- Matcher: `src/lib/expense-duplicates/match.ts`
- Loaders: `src/lib/db/expense-duplicate-candidates.ts`
- Decided rows: `src/lib/db/worker-expense-drafts.ts:484`
- Dialog patterns: `src/components/transfers/invoice-download-dialog.tsx`, `telmak-check-dialog.tsx`
- Scope pattern: `src/lib/queries/fetch-transfers-for-invoices.ts`
- Test-plan risks #26 and #28: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Engine (pure)

#### Automated

- [x] 1.1 Matcher spec passes
- [x] 1.2 Engine spec passes

### Phase 2: Loaders and the zgłoszenie path

#### Automated

- [x] 2.1 Candidates DB spec passes against 5435
- [x] 2.2 Duplicate-mark DOM spec still passes

### Phase 3: Finder query

#### Automated

- [x] 3.1 Finder DB spec passes against 5435

### Phase 4: UI

#### Automated

- [x] 4.1 Dialog DOM spec passes
- [x] 4.2 Queue DOM spec passes
