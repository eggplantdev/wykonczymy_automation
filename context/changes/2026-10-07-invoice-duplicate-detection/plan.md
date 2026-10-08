# Invoice Duplicate Detection Implementation Plan

## Overview

Management accepts a worker's zgłoszenie wydatku in the accept dialog. That dialog warns when a paragon
in the zgłoszenie repeats a booked transakcja or another pending zgłoszenie. Management can mark the
paragon „Duplikat". The mark is saved together with the decision. The worker never sees anything:
a refused duplicate shows to him as „Odrzucone". (EX-1025. The audit of already-booked transakcje is
EX-1026, later.)

The owner-accepted spike (`f4c4153a2`) already draws the hint table, the queue label and the filter. This
plan hardens the spike instead of redesigning it, and applies the 2026-10-08 rulings in `change.md`:

- the mark is saved with the decision, not on the click;
- no content hash;
- three structured document-identity fields that management can see and edit.

## Current State Analysis

- **The AI read.**
  - The one receipt extractor is `extractReceipt` (`src/lib/ai/openrouter.ts`, schema in
    `src/lib/ai/receipt-extraction-schema.ts`). The same extractor serves the worker draft read and
    management's per-row scan.
  - It writes the document number on line 1 of `invoiceNote`, and the seller plus the printed date into
    `description`. It never asks for a NIP.
  - The draft read is stored in `worker_expense_drafts.ai_read` and validated by `expenseDraftReadSchema`
    (`src/lib/db/expense-draft-read.ts`). A read that fails this schema loses the whole prefill.
- **Booking.**
  - `createBulkTransferAction` (`src/lib/actions/transfers.ts:92-163`) calls `payload.create` once per
    line item.
  - It then calls `decideExpenseDraft` inside `withPayloadTransaction`, passing
    `skippedReceipts: number[][]`. That list comes from `receiptDecision`
    (`src/lib/worker-expenses/receipt-decision.ts`): the line items removed from the form.
  - `transactions` has no document-identity column.
- **The spike.** Its known gaps are listed in `research.md`:
  - The match is based on `invoiceNote` line 1 and `description` only, plus a `filesize:WxH`
    fingerprint.
  - The candidate SQL scans every receipt-type transakcja with a fingerprint subquery for each row, and
    expands draft reads with a correlated `jsonb_array_elements` (the JIT trap).
  - The `lib/db` functions run two statements each.
  - „Duplikat" is refused on the click (`skipPendingReceiptAsDuplicate`). This writes a skipped paragon
    under a still-pending zgłoszenie, which the 2026-10-08 ruling forbids.
  - „Last paragon" is decided from the prefill instead of the live form.
  - The `revision` remount drops the manager's edits.
  - A failed read leaves „Sprawdzanie duplikatów…" on screen forever.
  - The spike migration `20261007_2_add_expense_draft_duplicate_of.ts` is applied to the local DB only.
    Staging stops at `20261007_1`.
- **Filtering.** Transakcje are not Payload-trashable. Every sum in `lib/db` filters with
  `cancelled IS NOT TRUE`, and the candidate query does the same.
- **Indexes.** `transactions.amount` has only a trigram index on `amount::text`. At about 5k transakcje,
  a sequential scan filtered by `amount = ANY(…)` is cheap, so no index is added.

## Desired End State

Each wydatek line item in management's expense form, and in the edit-transakcja form, has a row
between the file row and „Notatka". The row holds three optional, editable fields: „Nr dokumentu",
„NIP sprzedawcy" and „Data na paragonie".

- The fields are prefilled from the AI read, and stack in a column below 768px.
- They are persisted on the transakcja as `document_number`, `seller_nip` and `document_date`.

When the accept dialog opens, it shows a table of possible duplicates for each paragon. A strong match
is red; a weak match is muted.

- **„Duplikat"** takes the paragon out of the live form and keeps everything else the manager typed.
  - On accept, the paragon is saved as a skipped receipt with `duplicate_of`.
  - On the last remaining paragon, the click rejects the whole zgłoszenie with a draft-level
    `duplicate_of`.
- **„OK, to nie duplikat"** hides the row for the open dialog only.
- **The queue** shows „Duplikat #id" and can be filtered with „Duplikaty".
- **The worker's tables** show only „Odrzucone".

### Key Discoveries:

- The extractor's fields are required strings, and an empty string means "not read"
  (`receipt-extraction-schema.ts:11-15`). The new fields follow the same convention, so
  `generateObject` keeps one shape.
- `toReadRow` copies only fields that are present (`read-expense-draft-receipts.ts:18-23`), and the
  draft read row schema is all-optional (`expense-draft-read.ts:10`). Old reads without the new fields
  keep parsing.
- `receiptToLineItemValues` (`apply-receipt-to-row.ts:16`) is the single read → line-item mapper. Both
  the draft prefill and the per-row scan go through it.
- The only NIP constant today is `TELMAK_NIP` (`src/lib/telmak/parse-telmak.ts:5`). The company's own
  NIP does not exist in the code yet.
- `rejectExpenseDraftAction` (`lib/actions/worker-expense-drafts.ts:101`) already accepts the spike's
  draft-level `duplicateOf`. `restoreRejectedExpenseDraft` clears it.
- `decideExpenseDraft` inserts skipped receipts via `jsonb_to_recordset`, and keeps only the pages the
  draft actually owns.
- `payload.config.ts:74` sets `push: false`. The schema changes only through hand-written migrations.

## What We're NOT Doing

- No content hash, no `media.sha256`, no change to `/api/media-upload`, no „To samo zdjęcie" reason.
- No backfill of `document_number` for existing transakcje. That is a follow-up script, applied to prod
  by a human. Until it runs, legacy rows match through the fallback parse of `invoiceNote` and
  `description`.
- „OK, to nie duplikat" is not stored. Persisted dismissals belong to EX-1026.
- No hint anywhere except the accept dialog: no queue badge, no hint in management's own expense form,
  no flag on transakcje.
- `CORRECTION` is not compared.
- „Notatka" line 1 and „Opis" keep their current AI layout. Sheet sync, the investor view, Telmak and
  the filename keep reading them.
- Telmak does not switch to the new columns (follow-up).
- The stale `context/foundation/lessons.md:2127` stays as it is (follow-up).
- No new index.

## Implementation Approach

Data first, then form, then matching, then the decision flow.

- The columns and the AI fields land first, so the form can carry them.
- Once the form persists them, the matcher has structured data on new rows. It keeps a legacy
  fallback for old rows and old reads.
- The decision rework comes last, because it consumes the matcher's output shape and the new
  `skippedReceipts` shape.

### Matching rules (one place: `src/lib/expense-duplicates/match.ts`)

- **Document identity, resolved from the column or the legacy fallback:**
  - number = `documentNumber`, else line 1 of `invoiceNote` (uppercased, whitespace stripped; at least
    5 characters including a digit, else none);
  - date = `documentDate`, else the `DD.MM.YYYY` parsed from `description`;
  - seller:
    - if both sides have a NIP: NIP equality;
    - otherwise: the existing description-prefix key (lowercased alphanumerics, first 5 characters,
      date removed).
- **Amount agrees** when the cents are equal, or when the probe has no amount.
- **Strong `same-number`:** the numbers are equal and the amount agrees. It is not strong when both
  sides carry a NIP and the NIPs differ.
- **Strong `same-receipt`:** same amount, same printed day and same seller.
- **Weak `same-amount`:** same amount and printed days within ±3 (`WEAK_WINDOW_DAYS`).
- **Order:** results are sorted strong first, then by date descending.

## Critical Implementation Details

- **The spike migration is replaced, not stacked.**
  - Delete `20261007_2_add_expense_draft_duplicate_of.ts` and its `index.ts` entry.
  - The new `20261008_0` uses `ADD COLUMN IF NOT EXISTS`, so it applies over the spike's columns on
    the local DB.
  - On the local DB, delete the stale `payload_migrations` row named
    `20261007_2_add_expense_draft_duplicate_of`, so Payload does not report a migration without a file.
  - Run `git status src/migrations` before migrating.
  - Restart the dev server after migrating.
- **`document_date` is `varchar` holding ISO `YYYY-MM-DD` (a Payload `text` field), not a Payload
  `date`.**
  - In Postgres, Payload maps `date` to `timestamptz`. A date-only value would then shift across the
    timezone boundary.
  - The matcher compares calendar days anyway.
- **„Duplikat" never reaches the server before the decision,** except on the last paragon.
  - The form owns `duplicateOfByItemId`.
  - The hint table lives inside the form, through a render slot, so it reads the live line-item list.
    Without the slot it would decide from the prefill (the spike's bug).
- **Prerequisite: the company NIP value.**
  - `COMPANY_NIP` goes into `src/lib/constants/company.ts`.
  - The owner said they will supply it. `/10x-implement` asks for it at the Phase 1 kickoff if it is
    still missing, and does not invent one.

## Phase 1: Data model + document identity

### Overview

Add the columns, add the Payload fields, and teach the extractor and the draft read the three fields.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261008_0_add_document_identity_and_duplicate_of.ts` (+ `src/migrations/index.ts`); delete `src/migrations/20261007_2_add_expense_draft_duplicate_of.ts`

**Intent**: One additive migration for the whole change, replacing the spike's migration.

**Contract**:

- `up`:
  - `worker_expense_drafts.duplicate_of jsonb` and
    `worker_expense_draft_skipped_receipts.duplicate_of jsonb`, both `IF NOT EXISTS`;
  - `transactions.document_number varchar`, `transactions.seller_nip varchar` and
    `transactions.document_date varchar`.
- `down` drops all five columns.

#### 2. Transfers collection

**File**: `src/collections/transfers.ts`

**Intent**: Expose the three columns to Payload, so `payload.create` and `payload.update` write them and
the generated types carry them.

**Contract**: optional `text` fields `documentNumber`, `sellerNip` and `documentDate`. Then run
`pnpm generate:types`, whose output is gitignored.

#### 3. NIP + company constant

**File**: `src/lib/constants/company.ts` (new), `src/lib/utils/nip.ts` (new)

**Intent**: One normaliser shared by the AI read, the form validation and the matcher.

**Contract**:

- `COMPANY_NIP: string` (10 digits).
- `normalizeNip(raw: string): string | undefined`:
  - strips a `PL` prefix, spaces and dashes;
  - returns 10 digits, or `undefined` when the result is not exactly 10 digits.

#### 4. Extractor

**File**: `src/lib/ai/receipt-extraction-schema.ts`, `src/lib/ai/openrouter.ts`

**Intent**: Read the number, the seller's NIP and the printed date as structured fields, alongside the
unchanged `invoiceNote` and `description`.

**Contract**:

- Schema: add `documentNumber`, `sellerNip` and `documentDate`. All three are `z.string()`, with an
  empty string meaning "not read".
- Prompt:
  - number: the same value as `invoiceNote` line 1;
  - NIP: the **seller's** NIP, never the buyer's, digits only;
  - date: the printed document date as `YYYY-MM-DD`.
- Post-process inside `extractReceipt`:
  - `sellerNip` goes through `normalizeNip`, and is dropped when it equals `COMPANY_NIP`;
  - `documentDate` is dropped unless it is a valid ISO date.

#### 5. Draft read + prefill mapping

**File**: `src/lib/db/expense-draft-read.ts`, `src/lib/actions/read-expense-draft-receipts.ts`, `src/components/forms/expense-form/apply-receipt-to-row.ts`

**Intent**: Carry the fields from the read into the line-item values, without breaking stored reads that
lack them.

**Contract**:

- `expenseDraftReadRowSchema` gains three `z.string().optional()` fields.
- `toReadRow` copies them when they are non-empty.
- `ReceiptValuesT` and `receiptToLineItemValues` map them, defaulting to `''`.

### Success Criteria:

#### Automated Verification:

- Migration applies on the local DB after the stale spike row is removed: `pnpm payload migrate`
- `src/__tests__/lib/utils/nip.test.ts` passes. It covers:
  - the `PL` prefix and dashes;
  - 9 and 11 digits rejected.
- `src/__tests__/lib/ai/extract-receipt-sanitize.test.ts` passes:
  - a read equal to `COMPANY_NIP` is dropped;
  - an invalid date is dropped.

  The spec targets the post-process function, not the model call.

- `src/__tests__/components/worker-expenses/draft-prefill.test.ts` passes, extended with two cases:
  - a read with the new fields prefills them;
  - a stored read without them still prefills everything else.

#### Manual Verification:

- „Zgłoszenia wydatków" → open a new zgłoszenie whose paragon is a faktura: the row shows the read
  number, the seller's NIP (not ours) and the printed date. (These fields are visible only after
  Phase 2; check them then.)

**Implementation Note**: When this phase's automated verification passes, commit and continue — do not pause for per-phase manual confirmation.

---

## Phase 2: Form fields + persistence

### Overview

The three visible fields in the expense form and the edit-transakcja form, validated and persisted.

### Changes Required:

#### 1. Line-item values + schemas

**File**: `src/components/forms/expense-form/bulk-expense-form.ts`, `src/components/forms/expense-form/bulk-expense-schema.ts`, `src/components/forms/expense-form/map-line-item.ts`

**Intent**: Carry the fields through the client form, the server schema and the mapping to the action
payload.

**Contract**:

- Line item gains `documentNumber`, `sellerNip` and `documentDate` (strings, default `''`).
- Validation, client and server:
  - NIP: empty, or `normalizeNip` succeeds (message „NIP musi mieć 10 cyfr");
  - date: empty, or a valid ISO date.
- `mapLineItem` sends the normalised NIP, and `undefined` for empty values.

#### 2. Line-items UI

**File**: `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: A new row between the file row and „Notatka", with „Nr dokumentu", „NIP sprzedawcy" and
„Data na paragonie".

**Contract**:

- Below `sm` the three fields stack in a column, always visible. From `sm` up they sit three across.
- The date uses the date-input control the form already uses for the booking date.

#### 3. Persist on booking

**File**: `src/lib/actions/transfers.ts` (`createBulkTransferAction`)

**Intent**: Write the three values on every created transakcja, whatever its type.

**Contract**: `payload.create` data gains `documentNumber`, `sellerNip` and `documentDate`. An empty value
becomes `null`.

#### 4. Edit-transakcja form

**File**: `src/lib/schemas/transfer.ts`, `src/lib/schemas/transfer-form.ts`, `src/components/forms/edit-transfer-form/edit-transfer-form.tsx`, `src/components/forms/edit-transfer-form/edit-transfer-form-api.ts`, `src/lib/queries/transfer-mapping.ts`, `src/lib/actions/transfers.ts` (`updateTransferAction`)

**Intent**: The same row in the edit form, so a misread can be fixed after booking.

**Contract**:

- The row renders wherever the edit form renders the invoice/„Notatka" block.
- The values are read back through `transfer-mapping.ts` for the defaults.
- Validation matches the line-item schema.
- `updateTransferAction` writes the three fields.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/components/forms/expense-form/bulk-expense-schema.test.ts` passes:
  - an invalid NIP fails;
  - an empty NIP passes;
  - a NIP is normalised on the way out.
- `src/__tests__/lib/actions/create-bulk-transfer-document-identity.db.test.ts` passes. It asserts the
  persisted row carries the three columns, and that empty values are stored as `NULL`.

#### Manual Verification:

- „Dodaj wydatek" → the row between the file row and „Notatka" shows „Nr dokumentu", „NIP sprzedawcy"
  and „Data na paragonie".
- „Skanuj" / „Odczytaj ponownie" fills all three.
- Save → open the transakcja in „Edytuj": the values are there. Change the NIP and save: the change
  sticks.
- „NIP sprzedawcy" with 9 digits: the form refuses to save with „NIP musi mieć 10 cyfr". An empty value
  saves.
- At 390px wide the three fields stack in a column. At ≥768px they sit in one row.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do not pause for per-phase manual confirmation.

---

## Phase 3: Matcher + candidate queries

### Overview

Rewrite the spike's match and candidate SQL onto the structured fields with the legacy fallback. Drop the
fingerprint. One statement per `lib/db` function, with orchestration in `lib/queries`.

### Changes Required:

#### 1. Matcher

**File**: `src/lib/expense-duplicates/match.ts`

**Intent**: Implement the matching rules above. Remove the fingerprint and the `same-file` reason.

**Contract**:

- `ExpenseDocT { amount, documentNumber, sellerNip, documentDate, invoiceNote, description }`.
- `MatchReasonT = 'same-number' | 'same-receipt' | 'same-amount'`.
- The tier mapping is unchanged.
- `itemKeys` / `sharedItems` stay only if `expense-duplicates.tsx` renders them. If nothing reads them,
  delete them (gate on typecheck).

#### 2. Candidate SQL

**File**: `src/lib/db/expense-duplicate-candidates.ts`

**Intent**: Three single-statement reads that filter in SQL, with no correlated JSON expansion.

**Contract**:

- `loadDraftProbes(draftId)`:
  - reads the pending draft's `ai_read` rows, expanded once `WITH ORDINALITY`;
  - returns `ExpenseDocT & { rowIndex, mediaIds }`.
- `loadTransactionCandidates({ amountsCents, documentNumbers })`:
  - filters on type `IN RECEIPT_TYPES`, `cancelled IS NOT TRUE`, and either
    `round(amount*100) = ANY($1)` or the normalised `document_number` or `invoice_note` line 1
    `= ANY($2)`;
  - joins the creator, the drafter (via `worker_expense_draft_transfers`), the investment and the media
    pages.
- `loadDraftCandidates({ excludeDraftId, amountsCents, documentNumbers })`:
  - other pending drafts' read rows, expanded once in a CTE `WITH ORDINALITY`;
  - the same SQL filters.
- One shared SQL fragment builds the pages JSON (`{url, filename, mimeType}`).
- `who` → `submitterName`.
- Strip the `SPIKE` comments.

#### 3. Query orchestration

**File**: `src/lib/queries/expense-draft-duplicates.ts`

**Intent**: The client-invoked read, shaped like `queries/investment-asset-ids.ts`.

**Contract**:

- `'use server'`.
- `findExpenseDraftDuplicates(draftId): Promise<ActionResultT<ParagonDuplicatesT[]>>`.
- Management only. An auth failure returns an error result and does not throw.
- Returns an empty list when the draft has no read.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/expense-duplicates/match.test.ts` passes. Cases from the dump evidence:
  - same number + same amount → strong;
  - same number + different amount → none;
  - different numbers, same amount + printed date + seller → strong `same-receipt` (the Castorama case
    `087393/0888` vs `812765/003957/26`);
  - same number, both NIPs present and different → not strong;
  - same amount, printed dates 2 days apart → weak; 5 days apart → none;
  - a legacy candidate with number only in `invoiceNote` and date only in `description` → still
    matches;
  - a probe without an amount still matches by number.
- `src/__tests__/lib/db/expense-duplicate-candidates.db.test.ts` passes:
  - returns a booked `INVESTMENT_EXPENSE`/`OTHER` with an equal amount, and a pending draft's row;
  - excludes cancelled transakcje, `CORRECTION`, and the probe's own draft.

#### Manual Verification:

- Open the zgłoszenie seeded with `spike-seed.sql`, which holds the same Castorama paragon as another
  pending zgłoszenie: the hint table shows the other zgłoszenie as a red match, although the two
  numbers differ.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do not pause for per-phase manual confirmation.

---

## Phase 4: Decision-time „Duplikat"

### Overview

The mark rides on the decision, and the dialog works on the live form. Delete the spike's refuse-on-click
path, and fix the dialog's state bugs.

### Changes Required:

#### 1. Decision shape

**File**: `src/lib/worker-expenses/receipt-decision.ts`, `src/lib/actions/transfers.ts`, `src/lib/db/worker-expense-drafts.ts`

**Intent**: A skipped receipt can carry the transakcja or zgłoszenie it repeats.

**Contract**:

- `receiptDecision(receiptMediaIds, lineItems, duplicateOfByItemId: Map<string, DuplicateOfT>)` returns
  `skippedReceipts: { mediaIds: number[]; duplicateOf?: DuplicateOfT }[]`.
- `createBulkTransferAction` opts and `decideExpenseDraft` take the same shape.
- `jsonb_to_recordset` gains `duplicate_of jsonb`, written to `sr.duplicate_of`.

#### 2. Delete the click-time path

**File**: `src/lib/actions/worker-expense-drafts.ts`, `src/lib/db/worker-expense-drafts.ts`

**Intent**: Nothing writes a skipped receipt under a pending zgłoszenie.

**Contract**:

- Delete `markReceiptDuplicateAction` and `skipPendingReceiptAsDuplicate`.
- Delete `SKIPPED_MEDIA` / `skippedMediaIds` if nothing else reads them (gate on typecheck).
- `rejectExpenseDraftAction(draftId, duplicateOf?)` stays.

#### 3. Dialog on the live form

**File**: `src/components/worker-expenses/use-expense-draft-acceptance.tsx`, `src/components/worker-expenses/expense-draft-duplicate-hints.tsx`, `src/components/forms/expense-form/expense-form.tsx`, `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: „Duplikat" removes the paragon from the form the manager is editing, with no remount. The
last-paragon rule reads the live line-item count.

**Contract**:

- `ExpenseForm` takes
  `renderAboveLineItems?: (api: { lineItemIds: string[]; markDuplicate(itemId: string, duplicateOf: DuplicateOfT): void }) => ReactNode`.
- The form owns `duplicateOfByItemId`:
  - `markDuplicate` removes the line item through the existing `handleRemoveLineItem`;
  - when only one line item is left, it calls the dialog's reject with `duplicateOf` instead, and
    drops any earlier marks.
- `ParagonDuplicatesT.rowIndex` maps to the prefill line-item id.
- Hint rows for paragons that are no longer in `lineItemIds` are hidden.
- Remove `revision`.
- Hints state:
  `{ status: 'reading' } | { status: 'no-read' } | { status: 'error'; message } | { status: 'ready'; paragons }`.
- A reopen mid-read shows „reading", never „Nie znaleziono podobnych wydatków.".
- `onRemoveLastItem` (the trash on the only item → reject confirm) stays.

#### 4. Queue + worker surfaces

**File**: `src/components/tables/expense-drafts.tsx`, `src/components/filters/queue-filters.tsx`, `src/components/worker-expenses/expense-drafts-data-table.tsx`

**Intent**: Keep the spike's „Duplikat #id" label and the „Duplikaty" filter on the management queue.
The worker's table keeps „Odrzucone".

**Contract**:

- The behaviour stays as in the spike.
- Strip the `SPIKE` comments.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/worker-expenses/receipt-decision.test.ts` passes: a removed item with a mark emits
  `duplicateOf`, and a removed item without one does not.
- `src/__tests__/lib/db/worker-expense-drafts.db.test.ts` passes, extended with three cases:
  - accept with one duplicate-marked paragon writes `sr.duplicate_of`;
  - reject with `duplicateOf` writes the draft-level column;
  - restore clears it.
- `src/__tests__/components/worker-expenses/expense-draft-duplicate-mark.test.tsx` passes. It is
  test-driven debugging for the remount bug: written first and seen failing on the spike.
  - With two paragony, edit the second paragon's amount, then mark the first „Duplikat": the edit
    survives and one line item remains.
  - Marking the remaining one calls the reject action with `duplicateOf`.
- `src/__tests__/components/worker-expenses/pending-expense-drafts.test.tsx` passes, with
  `findExpenseDraftDuplicates` mocked (fixes `:60-75`).
- `src/__tests__/components/worker-expenses/worker-expense-drafts-table.test.tsx` passes: a draft with
  `duplicateOf` renders „Odrzucone" and never „Duplikat".
- `src/__tests__/components/worker-expenses/expense-drafts-data-table.test.tsx` passes: the label shows,
  and `?duplicates=1` narrows the list.

#### Manual Verification:

- Zgłoszenie with two paragony, one of which repeats a booked transakcja:
  1. Change something on the other paragon.
  2. Click „Duplikat" on the matching row.

  Expected: the paragon leaves the form, the change stays, and nothing is saved yet. Accept: the
  queue shows the zgłoszenie as accepted, and the skipped paragon reads „Duplikat #id".

- Zgłoszenie with one paragon → „Duplikat": the zgłoszenie is rejected at once. The queue shows
  „Duplikat #id", and the worker's `/pracownicy/[id]` shows „Odrzucone".
- „OK, to nie duplikat" hides the row. Close and reopen the dialog: the row is back.
- „Duplikaty" filter on „Zgłoszenia wydatków": only zgłoszenia with a duplicate mark remain.
- A zgłoszenie whose AI read failed shows an explicit message in the hint area instead of an endless
  „Sprawdzanie duplikatów…".
- „Przywróć" on a rejected duplicate zgłoszenie brings it back to pending without the label.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do not pause for per-phase manual confirmation.

---

## Phase 5: Docs + backlog

### Overview

Record the risk, defer the E2E, and update the living docs.

### Changes Required:

#### 1. Test plan

**File**: `context/foundation/test-plan.md` (via `/10x-test-plan`)

**Intent**: A row for "a paragon booked twice": the risk the matcher and decision specs anchor on.

**Contract**: a new risk row naming the unit, db and dom specs from Phases 3–4.

#### 2. E2E backlog

**File**: Linear (project „Wykonczymy", label `e2e-backlog`)

**Intent**: Defer the browser flow: accept dialog → „Duplikat" → accept → queue label, with the worker
seeing „Odrzucone".

**Contract**:

- One issue, with its id recorded in `change.md`.
- Reality-check the Linear MCP first.

#### 3. Change notes

**File**: `context/changes/2026-10-07-invoice-duplicate-detection/change.md`

**Intent**: Mark the spike seed as superseded where it seeds fingerprints. Record the E2E issue id.

**Contract**: the `### Follow-ups` section is unchanged, plus the E2E id.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check (a docs and backlog phase).

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests:

- `match.ts`: every rule, the NIP veto and the legacy fallback, built from the dump's real pairs.
- `normalizeNip`, the extractor sanitiser and `receiptDecision`.

### Integration Tests:

- Candidate SQL against the 5435 DB: inclusion and exclusion filters.
- `decideExpenseDraft`: accept and reject writing `duplicate_of`, and restore clearing it.
- `createBulkTransferAction`: the identity columns persist.

### Manual Testing Steps:

1. Local 5433 with `spike-seed.sql`: Castorama pair → red match.
2. Mark one of two paragony as „Duplikat", accept, then check the queue label and the worker view.
3. Edit-transakcja form: change the NIP; it persists.
4. 390px width: the fields stack.

## Performance Considerations

There are three statements per dialog open, each filtering in SQL on about 5k transakcje and a few
pending drafts. Draft reads are expanded once in a CTE, which avoids the JIT trap of a correlated
`jsonb_array_elements`. No index is needed at this size.

## Migration Notes

- The migration is additive, so a human runs `pnpm db:migrate:prod` **before** the push that ships it.
  Staging needs `pnpm db:migrate:preview` after the merge.
- There is no backfill. Legacy rows match through the fallback parse.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit + DOM suite passes: `pnpm test`
- DB integration suite passes: `pnpm test:integration`

## References

- Research: `context/changes/2026-10-07-invoice-duplicate-detection/research.md`
- Rulings: `context/changes/2026-10-07-invoice-duplicate-detection/change.md`
- Spike: commit `f4c4153a2`
- Pattern for a client-invoked read: `src/lib/queries/investment-asset-ids.ts`
- Telmak-style table: `src/components/tables/telmak-check.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model + document identity

#### Automated

- [x] 1.1 Migration applies on the local DB after the stale spike row is removed
- [ ] 1.2 nip.test.ts passes
- [ ] 1.3 extract-receipt-sanitize.test.ts passes
- [ ] 1.4 draft-prefill.test.ts passes with new-field and legacy-read cases

### Phase 2: Form fields + persistence

#### Automated

- [ ] 2.1 bulk-expense-schema.test.ts passes
- [ ] 2.2 create-bulk-transfer-document-identity.db.test.ts passes

### Phase 3: Matcher + candidate queries

#### Automated

- [ ] 3.1 match.test.ts passes
- [ ] 3.2 expense-duplicate-candidates.db.test.ts passes

### Phase 4: Decision-time „Duplikat"

#### Automated

- [ ] 4.1 receipt-decision.test.ts passes
- [ ] 4.2 worker-expense-drafts.db.test.ts passes with duplicate_of cases
- [ ] 4.3 expense-draft-duplicate-mark.test.tsx passes
- [ ] 4.4 pending-expense-drafts.test.tsx passes
- [ ] 4.5 worker-expense-drafts-table.test.tsx passes
- [ ] 4.6 expense-drafts-data-table.test.tsx passes
