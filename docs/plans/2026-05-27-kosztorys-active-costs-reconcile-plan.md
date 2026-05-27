# Kosztorys Active-Costs Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the kosztorys sheet a 1:1 mirror of an investment's non-cancelled `INVESTMENT_EXPENSE` rows — matching ids, count, and totals with the investment table.

**Architecture:** Drop the cancellation `+/−` row model. The sheet holds one row per non-cancelled expense (its own id). Cancelling an expense removes its row; the reconciler appends/overwrites active rows and removes orphan rows that are real transactions (cancelled / moved / deleted) while preserving manually-added rows.

**Tech Stack:** Next.js server actions, Payload, googleapis Sheets v4, Vitest.

**Design doc:** `docs/plans/2026-05-27-kosztorys-active-costs-reconcile-design.md`

---

## File Structure

- `src/lib/actions/sheets-sync.ts` — `syncSingleTransferToSheet` CANCELLATION branch (remove original's row); `loadAppMaterialRows` (non-cancelled only); delete `cancellationRow` + `cancellationReason`; `applyMaterialSync` orphan-removal + `removed` count.
- `src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx` — toasts surface `removed`.
- Tests: `src/__tests__/lib/actions/sheets-sync.test.ts`.

Sequencing note: Task 1 stops `syncSingleTransferToSheet` from using `cancellationRow`/`cancellationReason`; Task 2 stops `loadAppMaterialRows` from using them and deletes them in the same commit (so no commit leaves an unused-function lint error).

---

### Task 1: Cancellation removes the original's sheet row

**Files:**

- Modify: `src/lib/actions/sheets-sync.ts` (`syncSingleTransferToSheet`, the `CANCELLATION` branch ~L316-335)
- Modify: `src/lib/actions/transfers.ts` (`cancelTransferAction` stale comment ~L245-247)
- Test: `src/__tests__/lib/actions/sheets-sync.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `syncSingleTransferToSheet` describe block in `src/__tests__/lib/actions/sheets-sync.test.ts`:

```ts
it('removes the original expense row from its sheet when a CANCELLATION is synced', async () => {
  // 1st transactions lookup: the cancellation; 2nd: the original expense; then investment
  findByIDMock.mockImplementation(({ collection, id }: { collection: string; id: number }) => {
    if (collection === 'investments') return Promise.resolve({ id: 31, googleSheetId: 'sheet-1' })
    if (id === 2460)
      return Promise.resolve({ id: 2460, type: 'CANCELLATION', cancelledTransaction: 2459 })
    return Promise.resolve({ id: 2459, type: 'INVESTMENT_EXPENSE', investment: 31 })
  })
  sheetColIReturns([2459]) // original sits on row 2 of the sheet
  spreadsheetsGetMock.mockResolvedValueOnce({
    data: {
      sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
    },
  })

  await syncSingleTransferToSheet({ transferId: 2460 })

  // It deletes the ORIGINAL's row (#2459 at row 2), and appends nothing.
  expect(batchUpdateMock).toHaveBeenCalledTimes(1)
  expect(batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteDimension.range).toEqual({
    sheetId: 5,
    dimension: 'ROWS',
    startIndex: 1,
    endIndex: 2,
  })
  expect(valuesBatchUpdateMock).not.toHaveBeenCalled() // no append/update
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts -t "removes the original expense row"`
Expected: FAIL — current code appends a `−` row (`valuesBatchUpdateMock` called), no `deleteDimension`.

- [ ] **Step 3: Replace the CANCELLATION branch**

In `src/lib/actions/sheets-sync.ts`, add `removeMaterialRow` to the `@/lib/google/sheets` import (it's already imported in this file for `removeTransferFromSheet`, so no change if present; otherwise add it). Then rewrite `syncSingleTransferToSheet` so the CANCELLATION case removes the original's row and returns, and the rest of the function only handles the expense case:

```ts
export async function syncSingleTransferToSheet(params: { transferId: number }): Promise<void> {
  try {
    const payload = await getPayload({ config })

    const transfer = await payload.findByID({
      collection: 'transactions',
      id: params.transferId,
      depth: 1,
      overrideAccess: true,
    })
    if (!transfer) return

    // A cancellation no longer adds a reversing row — the sheet mirrors ACTIVE
    // expenses, so cancelling an expense removes its row from the sheet.
    if (transfer.type === 'CANCELLATION') {
      const origId = relId((transfer as { cancelledTransaction?: unknown }).cancelledTransaction)
      if (origId === undefined) return
      const original = await payload.findByID({
        collection: 'transactions',
        id: origId,
        depth: 1,
        overrideAccess: true,
      })
      if (!original || original.type !== 'INVESTMENT_EXPENSE') return
      const investmentId = relId(original.investment)
      if (investmentId === undefined) return
      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        overrideAccess: true,
      })
      const sheetId = investment?.googleSheetId
      if (!sheetId) return
      await removeMaterialRow(sheetId, origId)
      console.log(`[sheets-sync] cancel #${origId}: removed row from sheet ${sheetId}`)
      return
    }

    if (transfer.type !== 'INVESTMENT_EXPENSE') return
    const investmentId = relId(transfer.investment)
    const row = expenseRow(transfer as unknown as TxDoc)
    if (!row || investmentId === undefined) return

    const investment = await payload.findByID({
      collection: 'investments',
      id: investmentId,
      overrideAccess: true,
    })
    const sheetId = investment?.googleSheetId
    if (!sheetId) {
      console.log(
        `[sheets-sync] skip transfer #${params.transferId}: investment #${investmentId} has no googleSheetId`,
      )
      return
    }

    const existing = await readMaterialyTransferIds(sheetId)
    const existingRow = existing.get(params.transferId)
    if (existingRow !== undefined) {
      await updateMaterialRow(sheetId, existingRow, row)
      console.log(
        `[sheets-sync] update transfer #${params.transferId} → sheet ${sheetId} row ${existingRow}`,
      )
      return
    }

    await appendMaterialRow(sheetId, row)
    console.log(
      `[sheets-sync] append transfer #${params.transferId} → sheet ${sheetId} (${row.typ})`,
    )
  } catch (err) {
    console.error('[sheets-sync] failed (non-fatal):', err)
  }
}
```

Also update the JSDoc above the function to: `Single-transfer sync from create/cancel/update actions. An INVESTMENT_EXPENSE appends or updates its row; a CANCELLATION removes the original expense's row. Never throws.`

> Note: this removes the only `syncSingleTransferToSheet` use of `cancellationRow`/`cancellationReason`. They are still used by `loadAppMaterialRows` until Task 2 — do not delete them yet.

Also fix the now-stale comment in `src/lib/actions/transfers.ts` `cancelTransferAction` (~L245-247). Replace:

```ts
// Append a reversing (−) row to the sheet for the cancellation, if the
// original was a synced investment expense. Post-response via `after()`;
// logged only.
after(() => syncSingleTransferToSheet({ transferId: cancellation.id }))
```

with:

```ts
// Remove the cancelled expense's row from its kosztorys sheet (the sheet
// mirrors ACTIVE expenses). syncSingleTransferToSheet routes the CANCELLATION
// to a row removal. Post-response via `after()`; logged only.
after(() => syncSingleTransferToSheet({ transferId: cancellation.id }))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts`
Expected: the new test passes; the `loadAppMaterialRows`/`previewMaterialSync` cancellation tests still pass (unchanged this task).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/sheets-sync.ts src/lib/actions/transfers.ts src/__tests__/lib/actions/sheets-sync.test.ts
git commit -m "feat(sheets-sync): cancellation removes the original's sheet row"
```

---

### Task 2: Sheet holds only non-cancelled expenses; delete cancellation row helpers

**Files:**

- Modify: `src/lib/actions/sheets-sync.ts` (`loadAppMaterialRows` ~L136-183; delete `cancellationRow` ~L102-131 and `cancellationReason` ~L63-67)
- Test: `src/__tests__/lib/actions/sheets-sync.test.ts`

- [ ] **Step 1: Update the tests first**

In `src/__tests__/lib/actions/sheets-sync.test.ts`:

(a) DELETE these now-obsolete `previewMaterialSync` tests (the `+/−` model is gone):

- `includes a cancellation as a negative reversing row`
- `leaves the note empty when a cancellation has no reason`

(b) DELETE the now-unused `makeCancellation` helper.

(c) ADD a test that the query excludes cancelled expenses — insert in the `previewMaterialSync` describe block:

```ts
it('queries only non-cancelled investment expenses', async () => {
  findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
  findReturns([])
  sheetColIReturns([])

  await previewMaterialSync(31)

  const whereArg = findMock.mock.calls[0][0].where
  expect(whereArg.and).toEqual(expect.arrayContaining([{ cancelled: { not_equals: true } }]))
})
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts -t "queries only non-cancelled"`
Expected: FAIL — the current `where.and` has only the investment + type conditions.

- [ ] **Step 3: Rewrite `loadAppMaterialRows` and delete dead helpers**

In `src/lib/actions/sheets-sync.ts`, replace `loadAppMaterialRows` with the non-cancelled-only version (drop the cancellation `find` + loop):

```ts
// Every row the sheet should hold: each NON-CANCELLED investment expense, one row
// keyed by its own id. The sheet mirrors active costs — cancelled expenses are
// excluded here (and their rows removed by the reconciler / on cancel).
async function loadAppMaterialRows(
  payload: Awaited<ReturnType<typeof getPayload>>,
  investmentId: number,
): Promise<AppRowT[]> {
  const expenses = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { investment: { equals: investmentId } },
        { type: { equals: 'INVESTMENT_EXPENSE' } },
        { cancelled: { not_equals: true } },
      ],
    },
    depth: 1,
    limit: 1000,
    overrideAccess: true,
  })

  const rows: AppRowT[] = []
  for (const t of expenses.docs as unknown as TxDoc[]) {
    const row = expenseRow(t)
    if (row) rows.push(row)
  }
  return rows
}
```

Then DELETE the now-unused `cancellationReason` function and the `cancellationRow` function entirely. (Verify nothing else references them: `grep -n "cancellationRow\|cancellationReason" src/lib/actions/sheets-sync.ts` should return no matches after deletion.)

- [ ] **Step 4: Run tests + lint to verify**

Run:

```bash
pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts
pnpm lint
```

Expected: tests pass; lint reports **0 errors** (no unused-function errors from the deleted helpers).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/sheets-sync.ts src/__tests__/lib/actions/sheets-sync.test.ts
git commit -m "feat(sheets-sync): sheet mirrors non-cancelled expenses; drop reversing-row model"
```

---

### Task 3: Reconciler scoped orphan-removal + `removed` count

**Files:**

- Modify: `src/lib/actions/sheets-sync.ts` (`ApplyMaterialSyncResultT` type ~L23-27; `applyMaterialSync` loop ~L237-259)
- Test: `src/__tests__/lib/actions/sheets-sync.test.ts`

- [ ] **Step 1: Update existing apply tests + add the orphan-removal test**

In `src/__tests__/lib/actions/sheets-sync.test.ts`:

(a) Update the two existing `applyMaterialSync` result assertions to include `removed: 0`:

- `overwrites an expense already present in the sheet (drift heal)` → `expect(result.data).toEqual({ added: 0, updated: 1, removed: 0, errors: [] })`
- `appends an expense that the DB has but the sheet is missing` → `expect(result.data).toEqual({ added: 1, updated: 0, removed: 0, errors: [] })`

(b) ADD the orphan-removal test in the `applyMaterialSync` describe block:

```ts
it('removes orphan rows that are real transactions but keeps manual rows', async () => {
  findByIDMock.mockResolvedValue({ id: 31, name: 'X', googleSheetId: 'sheet-1' })
  // loadApp expenses (1st find) → active expense #7; orphan lookup (2nd find) → #8 is a real tx
  findMock
    .mockResolvedValueOnce({
      docs: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
    })
    .mockResolvedValueOnce({ docs: [{ id: 8 }] })
  // sheet has the active #7, a real-but-orphan #8 (e.g. cancelled), and a manual #9999
  sheetColIReturns([7, 8, 9999])
  // removeMaterialRow needs the tab gid
  spreadsheetsGetMock.mockResolvedValue({
    data: {
      sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
    },
  })

  const result = await applyMaterialSync(31)

  expect(result.success).toBe(true)
  if (!result.success) throw new Error('expected success')
  expect(result.data).toEqual({ added: 0, updated: 1, removed: 1, errors: [] })
  // exactly one row deleted, and it is #8's row (sheet row 3), never #9999 (manual)
  expect(batchUpdateMock).toHaveBeenCalledTimes(1)
  expect(
    batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteDimension.range.startIndex,
  ).toBe(2)
})
```

> Sheet layout from `sheetColIReturns([7,8,9999])`: header row 1, #7 row 2, #8 row 3, #9999 row 4. `removeMaterialRow('sheet-1', 8)` deletes row 3 → `startIndex: 2`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts -t applyMaterialSync`
Expected: FAIL — result lacks `removed`; no orphan deletion happens.

- [ ] **Step 3: Add `removed` to the result type**

In `src/lib/actions/sheets-sync.ts`:

```ts
export type ApplyMaterialSyncResultT = {
  added: number
  updated: number
  removed: number
  errors: Array<{ transferId: number; message: string }>
}
```

- [ ] **Step 4: Add orphan-removal to `applyMaterialSync`**

Replace the loop + return inside `applyMaterialSync` (from `let added = 0` through `return { success: true, data: { added, updated, errors } }`) with:

```ts
let added = 0
let updated = 0
let removed = 0
const errors: ApplyMaterialSyncResultT['errors'] = []

// Overwrite-by-id heal: append rows the sheet lacks, overwrite present ones to
// match the DB. The id is the join key, not a content fingerprint — an edit
// never changes the id — so we overwrite unconditionally rather than compare.
// Appends go to the bottom and don't shift existing rows, so the row numbers in
// `current` stay valid for the overwrites.
for (const row of appRows) {
  const existingRow = current.get(row.transferId)
  try {
    if (existingRow !== undefined) {
      await updateMaterialRow(sheetId, existingRow, row)
      updated++
    } else {
      await appendMaterialRow(sheetId, row)
      added++
    }
  } catch (err) {
    errors.push({ transferId: row.transferId, message: String(err) })
  }
}

// Scoped orphan-removal: drop sheet rows whose id is no longer an active expense
// for this investment BUT only when that id is a real transaction (a cancelled
// expense, one moved to another investment, or a deleted row). Sheet ids that
// aren't real transactions are the owner's own manual rows — leave them alone.
const appIds = new Set(appRows.map((r) => r.transferId))
const orphanIds = [...current.keys()].filter((id) => !appIds.has(id))
if (orphanIds.length > 0) {
  const realTx = await payload.find({
    collection: 'transactions',
    where: { id: { in: orphanIds } },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  })
  const realIds = new Set(realTx.docs.map((d) => d.id as number))
  for (const id of orphanIds) {
    if (!realIds.has(id)) continue // owner's manual row — keep
    try {
      await removeMaterialRow(sheetId, id)
      removed++
    } catch (err) {
      errors.push({ transferId: id, message: String(err) })
    }
  }
}

return { success: true, data: { added, updated, removed, errors } }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts`
Expected: PASS (all, including the updated apply assertions and the orphan-removal test).

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/sheets-sync.ts src/__tests__/lib/actions/sheets-sync.test.ts
git commit -m "feat(sheets-sync): reconciler removes orphan rows (scoped), reports removed count"
```

---

### Task 4: Surface `removed` in the sync toasts

**Files:**

- Modify: `src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx`

- [ ] **Step 1: Update the reset-path toast (`onSetupConfirm`)**

Replace the `const { added, updated, errors } = applied.data` block with:

```tsx
const { added, updated, removed, errors } = applied.data
toastMessage(
  `Zakładka zresetowana i zsynchronizowana: +${added} / zaktualizowano ${updated} / usunięto ${removed}${
    errors.length ? ` · błędy: ${errors.length}` : ''
  }`,
  errors.length ? 'warning' : 'success',
)
```

- [ ] **Step 2: Update the manual-sync toast (`onConfirm`)**

Replace the `const { added, updated, errors } = res.data` block with:

```tsx
const { added, updated, removed, errors } = res.data
toastMessage(
  `Synchronizacja: +${added} / zaktualizowano ${updated} / usunięto ${removed}${
    errors.length ? ` · błędy: ${errors.length}` : ''
  }`,
  errors.length ? 'warning' : 'success',
)
```

- [ ] **Step 3: Verify typecheck + the affected suite**

Run:

```bash
pnpm typecheck
pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts
```

Expected: typecheck clean; tests pass.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx"
git commit -m "feat(kosztorys): sync toasts report removed count"
```

---

### Task 5: Full verification + docs

- [ ] **Step 1: Full suite + typecheck + lint**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: typecheck clean; lint 0 errors; all tests pass.

- [ ] **Step 2: Update the review-findings doc**

In `docs/plans/2026-05-27-kosztorys-sync-review-findings.md`, add a note under the status line that the cancellation `+/−` model was replaced by the active-costs mirror (see `2026-05-27-kosztorys-active-costs-reconcile-{design,plan}.md`), so #7's reasoning (lone `+` row for a cancelled expense) is now moot — cancelled expenses are not synced at all.

- [ ] **Step 3: Commit**

```bash
git add docs/plans/2026-05-27-kosztorys-sync-review-findings.md
git commit -m "docs: record active-costs reconciliation supersedes the +/- cancellation model"
```

- [ ] **Step 4: Live verification (manual / Playwright)**

On investment 6: click **Synchronizuj wydatki inwestycyjne** (or **Zresetuj zakładkę materiały**). Confirm:

- The 7 cancellation rows (2460, 2458, 2457, 2456, 2409, 1346, 1227) are gone.
- The 7 cancelled originals (2459, 2452, 2447, 2441, 1345, 1228, 1226) are gone.
- Remaining sheet ids = the non-cancelled investment expenses, matching `/inwestycje/6`.
- Per-type totals populate and RAZEM = 48 243,57 (matches the app).

Fold these assertions into the end-to-end Playwright verification (Task 8 of the prior plan).
