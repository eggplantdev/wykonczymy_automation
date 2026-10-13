# Worker expense paragon decisions — Implementation Plan

## Overview

Harden the EX-1053 spike, which is merged to `main` (`4dd5a4ac8`, `c2b8c6824`, merge `f5ae4de53`), into a shippable change. The spike lets a manager accept or reject a worker's zgłoszenie wydatku paragon by paragon, and merge several zgłoszenia into one. This plan:

- makes Przyjmij / Odrzuć fast;
- makes a lost response or a clash resync the dialog instead of lying about it;
- moves the dialog's decision logic into tested pure modules;
- shares one counter badge between expense zgłoszenia and work reports;
- puts the pending queue, with „Połącz zgłoszenia”, on the „Zgłoszenia wydatków” page;
- covers the per-paragon DB paths with integration specs.

Shaping, owner rulings and the spike's open items are in `change.md`.

## Current State Analysis

- **Per-paragon decisions work, but with no DB coverage of the new paths.**
  - `decideExpenseParagons` (`src/lib/db/worker-expense-drafts.ts:513`) locks the zgłoszenie, books or skips the requested read rows, and calls `settleExpenseDraft` (`:483`), which derives pending → accepted → rejected.
  - It returns `null` for two different refusals: the zgłoszenie is no longer pending, or a requested read row is already decided.
  - `src/lib/actions/transfers.ts:205,214` turns both into `DRAFT_ALREADY_DECIDED` („To zgłoszenie zostało już rozpatrzone”). On a clash that is wrong, because the zgłoszenie is still pending.
  - `rejectPendingParagons` (`:588`), `reopenSkippedReceipt` (`:624`) and `mergeExpenseDrafts` (`:707`) have no DB spec.
- **A lost response desyncs the dialog** (`change.md` § draft 24).
  - `settleAction` returns `REQUEST_FAILED` while the server may have committed.
  - The dialog treats that as „not booked”. The next decision clashes.
  - The duplicate check flags the paragony as duplicates of their own transakcje, because `loadBookedTransactions` / `loadMergedParagony` (`src/lib/db/expense-duplicate-candidates.ts:84,121`) don't exclude the draft's own transfers.
- **Przyjmij takes 2.5–3.5 s for a ~55 ms handler.** Measured from the dev log in the spike session:
  - **Photo re-upload, 0.9–1.5 s per photo, per paragon.** The dialog downloads the worker's photos (`draft-prefill.ts`), renames them (`renamePages`), and books by uploading them again as new media.
  - **The action's response re-renders the dashboard, 0.7–1.7 s.** `findTransfersRaw` alone takes 340–570 ms. The bulk booking runs without `deferRefresh`.
  - **A second render from `router.refresh()` after every decision, ~0.5 s each** (`use-expense-draft-acceptance.tsx:214`). Lessons :682-707 (EX-908) already rule this out: the action's response IS the render.
- **The dialog's decision logic lives inside components.**
  - `expense-form.tsx` threads a three-way paragon/merge/plain flag through its children and reuses `onReset` for a paragon-mode meaning.
  - `isReceiptOf` uses an `every` that is vacuously true on an empty list.
  - A row is booked after only a subset check against `bulkExpenseFormSchema`, so an invalid row fails with a toast instead of a field error.
  - `ReceiptSelectionActions` lost its `> 1` gate for the non-paragon form.
- **Two progress badges.** `DraftProgressBadge` (expense zgłoszenia) and the work-report „Do sprawdzenia · X z Y” badge (`tables/worker-reports.tsx:72`, `report-preview-dialog.tsx:49`, `worker-reports-list.tsx:77`, `worker-report-review.tsx:274-283`) say the same thing differently.
- **The pending queue is on the manager dashboard only** (`manager-dashboard.tsx:43,54`, via `fetchPendingExpenseDrafts`). `/zgloszenia-wydatkow` renders only the history, ordered by `QUEUE_ORDER` (pending first, `worker-expense-drafts.ts:340`).

## Desired End State

- **Przyjmij of one paragon** costs the handler plus one render, with no photo upload: the transakcja links the zgłoszenie's existing media rows and the camera filename is kept.
- **Odrzuć** stays server-cheap, and the dialog no longer refreshes the route per decision. The route refreshes once, when the dialog closes.
- **A failed or ambiguous decision resyncs the dialog.** On `REQUEST_FAILED`, or a per-paragon clash, the dialog re-reads the zgłoszenie's decided read rows and skipped receipts from the server:
  - decided paragony leave the waiting list;
  - a clash names the paragony, not the zgłoszenie;
  - a zgłoszenie that is no longer pending closes the dialog with the existing notice.
- **The duplicate check never matches a paragon against its own zgłoszenie's transakcje.**
- **One `DecisionProgressBadge`** shows „Przyjęte X · Odrzucone Y · Do sprawdzenia Z” wherever expense zgłoszenia or work reports show progress (queue, history, dialog headers, work-report list and review), with only the parts above 0. The status badge shows only where there are no counts.
- **`/zgloszenia-wydatkow`** shows the pending queue table, with selection and „Połącz zgłoszenia”, above the history filters. The history lists every status, ordered by „Data wysłania” descending.
- **Integration specs on the 5435 `db-test`** pin the per-paragon status derivation, refusals, reopen, and every merge refusal. Unit specs pin the extracted dialog logic.

### Key Discoveries:

- **`createBulkTransferAction` already takes `invoiceMediaIds: number[][]`** (`src/lib/actions/transfers.ts:115,170,187`), so linking existing media is a client change plus orphan-cleanup awareness, not a new action.
- **Sharing a media row between the draft and the transakcja is safe:** the app never deletes a transakcja — it only cancels it, and the cancelled row keeps its invoice. Deletion exists only in the unused Payload panel. The one path that can drop the shared row is the orphan cleanup after a failed booking (see Critical Implementation Details).
- **The refetch-on-`REQUEST_FAILED` pattern exists** in kosztorys `settle-tree-replace.ts`. Mirror it rather than inventing a second shape.
- **`revalidateCollections(…, { deferRefresh: true })` (EX-597)** is the established way for an action not to re-render its calling route.
- **The status derivation must stay in `settleExpenseDraft`.** That is the only place, and both decision paths call it inside the `FOR UPDATE` lock.
- **The DB spec template** is `src/__tests__/lib/db/worker-expense-drafts.db.test.ts:192`, marked `describe.skipIf(!ENV_READY)`. `scripts/test-integration.sh` discovers specs by that marker, so a new spec needs no registration.
- **Fixtures out of date:** `ExpenseDraftRowT` fixtures lack `acceptedReadRows` / `rejectedReceipts` in `components/tables/expense-drafts.test.tsx:15,33`, `worker-expenses/worker-expense-drafts-table.test.tsx:18`, `expense-drafts-data-table.test.tsx:27`, `pending-expense-drafts.test.tsx:30`.

## What We're NOT Doing

- **Photos without a read row.** Every read now saves a row per photo, and the local prod dump has 0 pending zgłoszenia with an uncovered photo.
- **Translating the paragon dialog.** The whole expense form is untranslated; the badge, queue and merge are translated.
- **Undoing an accepted paragon.** Owner ruling: cancel the transakcja the normal way.
- **Combining zgłoszenia automatically on send.** Discussed and not taken (`change.md`).
- **Any schema change.** The spike needed none, and neither does this.
- **An E2E spec.** The risks route to DB integration and DOM layers. Manual checks cover the browser flow (registry § 2026-10-13 already holds 7).

## Implementation Approach

1. **Server first.** The refusal union, the resync query and the duplicate exclusion are what the dialog hardening consumes. The DB specs pin the derivation before anything around it moves.
2. **Speed.** A self-contained client/action change that mostly deletes code (rename, re-upload, extra refresh).
3. **Dialog hardening.** Extract first, then change behaviour, so the extracted pure functions are under test before the resync logic leans on them.
4. **Badge and page.** UI-only phases on top of stable data.
5. **Docs** close it.

## Critical Implementation Details

- **Timing & lifecycle.**
  - Today the orphan cleanup (`withOrphanCleanup`, `submit-with-uploads.ts:13-40`) deletes every media id it uploaded when the booking fails.
  - Once existing draft media ids ride along in `invoiceMediaIds`, they must be kept out of `discardOrphanedUploads`. Otherwise a failed booking deletes the worker's photo.
  - Pass existing ids separately and clean up only the fresh uploads.
- **State sequencing.** After a resync, apply the server's decided set before clearing `isDeciding`. Otherwise a re-click in between re-sends an already-decided read row and hits the clash again.

## Phase 1: Server and DB tests

### Overview

Distinct refusals, a resync read, a duplicate check that ignores the draft's own transakcje, and DB specs for every per-paragon path.

### Changes Required:

#### 1. Refusal union from `decideExpenseParagons`

**File**: `src/lib/db/worker-expense-drafts.ts`

**Intent**: Tell „no longer pending” apart from „these read rows are already decided”, so the action can say which.

**Contract**: The function returns its success value, or `{ refusal: 'not-pending' } | { refusal: 'clash'; readRows: number[] }`. The clash branch replaces the `SELECT 1 EXISTS` with a query that returns the clashing read-row indices. Do the same for `rejectPendingParagons` if it shares the check.

#### 2. Map refusals to notices

**Files**: `src/lib/actions/transfers.ts:197-214`, the reject action in `src/lib/actions/worker-expense-drafts.ts`, `src/lib/constants/worker-expense-drafts.ts`, the notice keys plus pl/uk/ru translations

**Intent**:

- Not-pending keeps `draftAlreadyDecided`.
- A clash returns a new notice that names the paragony („Paragony N, M zostały już rozpatrzone”) through `noticeFailure(key, messageParams)`.

**Contract**:

- `DraftAlreadyDecided` carries the refusal.
- The bare `DRAFT_ALREADY_DECIDED` string return becomes `noticeFailure(...)`.
- Clients render it with `failureMessage(locale, result)`.
- The result carries a machine-readable discriminator (a failure code), so the dialog can trigger the resync without parsing text.

#### 3. Resync read

**Files**: `src/lib/db/worker-expense-drafts.ts` (new `findExpenseDraftDecisions`), `src/lib/queries/worker-expense-drafts.ts` (new `'use server'` `fetchExpenseDraftDecisions`)

**Intent**: One statement that returns what the dialog needs to resync after an ambiguous outcome.

**Contract**: `(draftId) → { status, acceptedReadRows: number[], rejectedReceipts: … } | undefined`, in the same shapes `ExpenseDraftRowT` already carries. It is management-only, like the dialog.

#### 4. Duplicate check excludes the draft's own transakcje

**File**: `src/lib/db/expense-duplicate-candidates.ts:84,121`

**Intent**: A paragon booked from this zgłoszenie must not flag its siblings, or itself after a resync, as duplicates.

**Contract**: Both loaders take the draft id and exclude transfers linked through `worker_expense_draft_transfers` for that draft.

#### 5. DB specs

**File**: `src/__tests__/lib/db/worker-expense-drafts.db.test.ts` (extend; template `:192`)

**Intent**: Pin the derivation and refusals against a real Postgres.

**Contract**: One case each:

- Booking a subset leaves the zgłoszenie pending.
- Rejecting the rest gives rejected, or accepted when anything is booked.
- A second decision on a decided read row is refused as `clash` with its indices.
- A decision on a non-pending zgłoszenie is refused as `not-pending`.
- `reopenSkippedReceipt` returns the zgłoszenie to pending.
- Each `MergeRefusalT` (`not-pending`, `mixed`, `decided`, `unread`) is refused.
- A merge chains read rows and media in send order.
- `findExpenseDraftDecisions` reflects the decisions.

Duplicate-exclusion case: `src/__tests__/lib/db/expense-duplicate-candidates.db.test.ts`.

#### 6. Fixture repair

**Files**: the four specs listed in Key Discoveries

**Intent**: Bring the `ExpenseDraftRowT` fixtures up to the spike's shape.

### Success Criteria:

#### Automated Verification:

- Draft DB spec passes: `NO_TEST_LOCK=1 bash scripts/test-integration.sh`, or a single spec via `DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec vitest run src/__tests__/lib/db/worker-expense-drafts.db.test.ts` after exporting `.env`
- Duplicate-candidates DB spec passes: `src/__tests__/lib/db/expense-duplicate-candidates.db.test.ts`
- The four fixture specs pass: `pnpm exec vitest run <file>` each

#### Manual Verification:

- In the „Przyjmij” dialog, deciding a paragon that another tab already decided shows a notice naming the paragon, not „To zgłoszenie zostało już rozpatrzone”.
- A paragon whose sibling is already booked from the same zgłoszenie shows no „Duplikat” hint pointing at that sibling's transakcja.

**Implementation Note**: When this phase's automated verification passes, commit and continue. Do **not** pause for per-phase manual confirmation.

---

## Phase 2: Speed

### Overview

Book against the zgłoszenie's existing photos, stop re-rendering the route twice per decision.

### Changes Required:

#### 1. Link existing media instead of re-uploading

**Files**: `src/components/forms/expense-form/expense-form.tsx` (`bookRows` :321-350, whole-zgłoszenie `onSubmit` :285-293), `src/components/forms/expense-form/submit-with-uploads.ts:13-40`

**Intent**: A row's pages that came from the zgłoszenie are sent as their existing media ids; only Files the manager added are uploaded.

**Contract**:

- Each row resolves to `{ existingMediaIds: number[]; newFiles: File[] }`.
- `invoiceMediaIds[i] = [...existingMediaIds, ...uploadedIds]`.
- `withOrphanCleanup` receives the existing ids and never passes them to `discardOrphanedUploads`.

#### 2. Stop renaming draft pages

**Files**: `src/components/worker-expenses/draft-prefill.ts`, `src/components/forms/expense-form/use-draft-receipts.ts`, `src/components/forms/expense-form/use-invoice-files.ts:121`

**Intent**: The transakcja shows the camera filename (owner ruling).

**Contract**:

- Remove `renamePages` from the draft path.
- `pagesByMediaId` stays only as the preview source.
- `downloadPages` stays, for preview.
- Rewrite the comment at `use-expense-draft-acceptance.tsx:95-96` to say what the download is for now.
- Keep `renamePages` for manager-added Files if that path still renames.

#### 3. No double render

**Files**: `src/lib/actions/transfers.ts` (bulk create from a draft), `src/components/worker-expenses/use-expense-draft-acceptance.tsx:169,187,214`

**Intent**: A paragon decision costs one cheap response. The route refreshes once, when the dialog closes.

**Contract**:

- The draft booking path revalidates with `{ deferRefresh: true }`. Plain bulk booking keeps its current behaviour.
- `onDecided` no longer calls `router.refresh()`.
- Closing the dialog after ≥1 decision calls it once.

#### 4. Reverse the EX-1048 attachment-name check

**File**: `context/foundation/manual-checks.md`

**Intent**: The registry box that expects renamed attachments contradicts the owner ruling. Rewrite it to expect the camera filename.

### Success Criteria:

#### Automated Verification:

- New unit spec for the existing-vs-new split and the orphan-cleanup exclusion passes: `pnpm exec vitest run src/__tests__/components/forms/expense-form/submit-with-uploads.test.ts`

#### Manual Verification:

- Przyjmij one paragon in the dialog: it leaves the list in well under a second on local dev. The dev log shows no media upload and one render.
- The booked transakcja shows the worker's photo under its camera filename, and the zgłoszenie in Historia still shows the same photo.
- Close the dialog after deciding two paragony: the queue counter updates once.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Dialog hardening

### Overview

Extract the decision logic into tested pure modules, split paragon mode into its own component, and resync after a failure.

### Changes Required:

#### 1. Pure decision logic

**File**: `src/lib/worker-expenses/` (beside `receipt-decision.ts`; one concern per file)

**Intent**: Make the logic the dialog depends on testable without rendering.

**Contract**: Move these out of components, with unit specs under `src/__tests__/lib/worker-expenses/`:

- `isReceiptOf` — fix the vacuous `every` on an empty list;
- `initialDecisions`;
- the progress count;
- `readRowOf`;
- `orderedEntries`;
- `toBulkData`.

#### 2. Paragon mode as its own component

**Files**: `src/components/forms/expense-form/expense-form.tsx`, plus a new sibling component

**Intent**: Replace the three-way flag threading and the `onReset` reuse. The plain form stays as it was before the spike.

**Contract**:

- `isParagonMode` (`!!prefill && prefill.aiReadRows.length > 0`) picks the component at the top.
- Shared pieces stay shared.
- Restore `ReceiptSelectionActions`' `> 1` gate in the plain form.
- Fix the stale comment at `expense-form.tsx:144`.

#### 3. Resync on failure

**Files**: the `useFormSubmit` hook, `use-draft-receipts.ts`, the new paragon component

**Intent**: An ambiguous or refused decision re-reads the truth instead of guessing.

**Contract**:

- `useFormSubmit` gains `onFailed(result)`.
- On `REQUEST_FAILED`, or the clash code from Phase 1, the paragon component calls `fetchExpenseDraftDecisions`, applies it through `useDraftReceipts.resync` plus `setRejected`, then clears `isDeciding`.
- If the zgłoszenie is no longer pending, the dialog closes with the not-pending notice.
- `undoReject` handles a partial failure the same way.

#### 4. Validation in paragon mode

**Intent**:

- `isSaveBlocked` gates paragon-mode buttons.
- An invalid row shows its field errors inline, instead of the subset-check toast.

### Success Criteria:

#### Automated Verification:

- Unit specs for the extracted functions pass: `pnpm exec vitest run src/__tests__/lib/worker-expenses/`
- `expense-form-merge.test.tsx` passes after the split
- New DOM spec: a refused decision triggers the resync and removes the decided paragony from the list (action and query mocked)

#### Manual Verification:

- Take the network offline (DevTools) during Przyjmij, then come back online: the dialog resyncs, and a paragon that was booked leaves the list rather than staying as waiting.
- A row with an empty kwota: „Przyjmij” on it shows the field error, not a toast.
- The plain expense form (Transakcje → dodaj wydatek) behaves as before, and its selection actions appear only with more than one row.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Shared badge

### Overview

One `DecisionProgressBadge` for expense zgłoszenia and work reports.

### Changes Required:

#### 1. The badge

**File**: `src/components/ui/decision-progress-badge.tsx` (new)

**Intent**: A domain-free primitive.

**Contract**:

- Props `{ accepted: number; rejected: number; pending: number }`.
- Labels from the `common` i18n namespace (pl/uk/ru).
- Shows only the parts above 0.
- The three-status type is defined in `ui/`, and `collapsible-line-item.tsx`'s `LineItemStatusT` imports it.
- Tone: rejected uses the negative tone, matching the „Odrzucone” status badge.

#### 2. Adopt it everywhere

**Files**: `tables/expense-drafts.tsx`, `expense-form.tsx:633` (or its Phase 3 successor), `tables/worker-reports.tsx:72`, `report-preview-dialog.tsx:49`, `worker-reports-list.tsx:77`, `worker-report-review.tsx:274-283`

**Intent**: Every progress display uses the badge. The status badge shows only when a row has no counts.

**Contract**:

- Delete `DraftProgressBadge`.
- Delete the i18n keys `expenseDrafts.progress*`, `workerReports.pendingProgress` and `acceptedPartial` (pl/uk/ru).

### Success Criteria:

#### Automated Verification:

- DOM spec for the badge (zero parts hidden, all three shown) passes: `pnpm exec vitest run src/__tests__/components/ui/decision-progress-badge.test.tsx`
- Existing work-report and expense-draft table specs pass with updated expectations

#### Manual Verification:

- A work report with some lines accepted and some waiting shows „Przyjęte X · Do sprawdzenia Z” in the list, the preview dialog and the review header.
- A fully accepted work report and a fully rejected expense zgłoszenie show their counts, not an empty badge.
- Switch the account language to Українська: the badge labels translate.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: „Zgłoszenia wydatków” page

### Overview

The pending queue, with merge, above the history. The history shows all statuses, newest first.

### Changes Required:

#### 1. Queue on the page

**File**: `src/app/(frontend)/zgloszenia-wydatkow/page.tsx`

**Intent**: Render `PendingExpenseDrafts` (selection, „Połącz zgłoszenia”, Przyjmij) above `ExpenseDraftsDataTable`, like the dashboard does.

**Contract**:

- Fetch `fetchPendingExpenseDrafts()` alongside the page data.
- Reuse the same `referenceData`.
- Give the page its own `storageKey`, so its collapsed state is independent of the dashboard.

#### 2. History order

**Files**: `src/lib/db/worker-expense-drafts.ts:340-359`, `src/lib/queries/expense-draft-sort.ts`

**Intent**: With no `?sort=`, the history orders by „Data wysłania” descending, not pending first.

**Contract**:

- `QUEUE_ORDER` becomes `d.sent_at DESC, ${PARAGON_ORDER}` (rename it to match).
- `validExpenseDraftSort`'s doc comment and the header state reflect `-sentAt` as the default, so the arrow shows on „Data wysłania”.

### Success Criteria:

#### Automated Verification:

- History-order DB case added to `worker-expense-drafts.db.test.ts` passes (a pending zgłoszenie older than a decided one lists below it)
- `pending-expense-drafts.test.tsx` and `expense-drafts-data-table.test.tsx` pass

#### Manual Verification:

- `/zgloszenia-wydatkow` shows „Do sprawdzenia” (the queue) above the filters, with checkboxes and „Połącz zgłoszenia (N)” once two are ticked.
- Merging there removes the merged rows from both the queue and the history.
- The history lists przyjęte, odrzucone and oczekujące mixed, newest „Data wysłania” first, with the arrow on that column.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 6: Documentation

### Overview

Extract the durable rationale, and record the closed risks.

### Changes Required:

#### 1. Lessons

**File**: `context/foundation/lessons.md`

**Intent**: Add an entry that supersedes EX-1009 (`:2563`): a refusal reopens in place, and skipped receipts live under a still-pending draft. Mark the old entry superseded.

#### 2. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Update risks #17, #24, #26 and #28 to name the new specs.

#### 3. Change notes

**File**: `context/changes/2026-10-13-worker-expense-paragon-decisions/change.md`

**Intent**: Strike the spike's open items this plan closed.

### Success Criteria:

#### Automated Verification:

- No dead links: every file path named in the new lessons entry exists (`ls`)

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests:

- The extracted dialog logic, including the empty-list edge in `isReceiptOf` and merged rows in `toBulkData`.
- The existing-vs-new media split, and the orphan-cleanup exclusion.

### Integration Tests:

- The per-paragon derivation, refusals, reopen, merge refusals and merge order, the resync read, the duplicate exclusion, and the history default order. All on the 5435 `db-test`, via the `skipIf(!ENV_READY)` marker.

### Manual Testing Steps:

1. Open a pending zgłoszenie with several paragony. Przyjmij one, Odrzuć one, „cofnij” the rejection, then close: the counter is right in the queue and in Historia.
2. Go offline mid-Przyjmij: the dialog resyncs.
3. Merge two one-photo zgłoszenia from `/zgloszenia-wydatkow`, then accept the result paragon by paragon.

## Performance Considerations

The target is one render per decision and zero uploads for draft photos. The remaining cost is the deferred revalidation plus the close-time refresh. Nothing here is sized for more than dozens of concurrent managers.

## Whole-tree Gate

Run **once**, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit and DOM suites pass: `pnpm test`
- DB integration suite passes: `pnpm test:integration`

## References

- Shaping and owner rulings: `context/changes/2026-10-13-worker-expense-paragon-decisions/change.md`
- Refetch-on-`REQUEST_FAILED` pattern: kosztorys `settle-tree-replace.ts`
- One render per action: `context/foundation/lessons.md:682-707` (EX-908)
- Deferred refresh: `revalidateCollections(…, { deferRefresh: true })` (EX-597)
- Linear: EX-1053

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server and DB tests

#### Automated

- [x] 1.1 Draft DB spec passes — 7e186eeba
- [x] 1.2 Duplicate-candidates DB spec passes — 7e186eeba
- [x] 1.3 The four fixture specs pass — 7e186eeba

### Phase 2: Speed

#### Automated

- [x] 2.1 Unit spec for the existing-vs-new split and orphan-cleanup exclusion passes — 2962e2cd9

### Phase 3: Dialog hardening

#### Automated

- [x] 3.1 Unit specs for the extracted functions pass — eb5f38015
- [x] 3.2 `expense-form-merge.test.tsx` passes after the split — eb5f38015
- [x] 3.3 DOM spec: a refused decision triggers the resync — eb5f38015

### Phase 4: Shared badge

#### Automated

- [x] 4.1 DOM spec for the badge passes — 5d8c18077
- [x] 4.2 Existing work-report and expense-draft table specs pass — 5d8c18077

### Phase 5: „Zgłoszenia wydatków” page

#### Automated

- [x] 5.1 History-order DB case passes — 74f0e1fff
- [x] 5.2 `pending-expense-drafts.test.tsx` and `expense-drafts-data-table.test.tsx` pass — 74f0e1fff

### Phase 6: Documentation

#### Automated

- [x] 6.1 No dead links in the new lessons entry
