# Kosztorys Edit Propagation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an edit to an already-synced `INVESTMENT_EXPENSE` reach its Google Sheet row, and make any resulting drift recoverable via manual re-sync.

**Architecture:** Two new sheet primitives (`updateMaterialRow`, `removeMaterialRow`). `syncSingleTransferToSheet` updates-in-place when the id is already present instead of skipping. `updateTransferAction` fires a post-response `after()` that removes the row from the old sheet on an investment reassignment, then syncs to the current sheet. The reconciler (`applyMaterialSync`) heals by overwrite-by-id: append absent rows, overwrite present ones — no field comparison.

**Tech Stack:** Next.js server actions, Payload, googleapis Sheets v4, Vitest.

**Design doc:** `docs/plans/2026-05-27-kosztorys-sync-edit-propagation-design.md`

---

## File Structure

- `src/lib/google/sheets.ts` — add `updateMaterialRow`, `removeMaterialRow` (sheet primitives).
- `src/lib/actions/sheets-sync.ts` — update-in-place in `syncSingleTransferToSheet`; overwrite-by-id in `applyMaterialSync`; new `removeTransferFromSheet`; result shape `{ added, updated, errors }`.
- `src/lib/actions/transfers.ts` — wire `after()` in `updateTransferAction`.
- `src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx` — toasts read `updated`; preview copy fixed.
- Tests: `src/__tests__/lib/google/sheets.test.ts`, `src/__tests__/lib/actions/sheets-sync.test.ts`, `src/__tests__/transfer-actions.test.ts`.

---

### Task 1: `updateMaterialRow` — write 7 cells to a known row

**Files:**

- Modify: `src/lib/google/sheets.ts` (add after `appendMaterialRow`, ~L216)
- Test: `src/__tests__/lib/google/sheets.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/lib/google/sheets.test.ts`:

```ts
describe('updateMaterialRow', () => {
  it('writes the seven mapped fields at the given row, leaving other rows untouched', async () => {
    // grid is read to resolve header columns; row 3 is the target
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102]] } })
    const { updateMaterialRow } = await import('@/lib/google/sheets')
    await updateMaterialRow('s', 3, {
      transferId: 102,
      date: '2026-05-27',
      typ: 'Materiały budowlane',
      description: 'cement',
      amount: 500,
      category: 'Łazienka',
      note: 'FV/1',
    })

    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
    const req = valuesBatchUpdateMock.mock.calls[0][0]
    expect(req.requestBody.valueInputOption).toBe('USER_ENTERED')
    expect(req.requestBody.data).toEqual([
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!A3", values: [[102]] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!B3", values: [['2026-05-27']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!C3", values: [['Materiały budowlane']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!D3", values: [['cement']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!E3", values: [[500]] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!F3", values: [['Łazienka']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!G3", values: [['FV/1']] },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/google/sheets.test.ts -t updateMaterialRow`
Expected: FAIL — `updateMaterialRow is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/google/sheets.ts`, add after `appendMaterialRow`:

```ts
// Overwrite the seven mapped cells of an EXISTING row (located by readMaterialy-
// TransferIds). Mirrors appendMaterialRow but targets a known rowNumber instead of
// the next empty row — used to push an edit, or to heal drift on re-sync. Touches
// only the mapped columns; summary/formatting/protected range are untouched.
export async function updateMaterialRow(
  spreadsheetId: string,
  rowNumber: number,
  input: MaterialRowInputT,
): Promise<void> {
  const sheets = getClient()
  const grid = await readGrid(spreadsheetId)
  const { cols } = resolveHeaders(grid)

  const valueByField: Record<FieldT, string | number> = {
    id: input.transferId,
    date: input.date,
    typ: input.typ,
    description: input.description,
    amount: input.amount,
    category: input.category,
    note: input.note,
  }
  const data = FIELDS.map((field) => ({
    range: `'${MATERIALY_TAB}'!${columnLetter(cols[field])}${rowNumber}`,
    values: [[valueByField[field]]],
  }))
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/lib/google/sheets.test.ts -t updateMaterialRow`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/sheets.ts src/__tests__/lib/google/sheets.test.ts
git commit -m "feat(sheets): updateMaterialRow — overwrite a known row's mapped cells"
```

---

### Task 2: `removeMaterialRow` — delete one row by transferId

**Files:**

- Modify: `src/lib/google/sheets.ts` (add after `updateMaterialRow`)
- Test: `src/__tests__/lib/google/sheets.test.ts` (extend the googleapis mock)

- [ ] **Step 1: Extend the googleapis mock to expose `spreadsheets.get` + `spreadsheets.batchUpdate`**

In `src/__tests__/lib/google/sheets.test.ts`, replace the mock setup block (top of file) so the spreadsheets object also has `get` and `batchUpdate`:

```ts
const getMock = vi.fn()
const valuesBatchUpdateMock = vi.fn()
const spreadsheetsGetMock = vi.fn()
const batchUpdateMock = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(function (this: object) {
        return this
      }),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        get: spreadsheetsGetMock,
        batchUpdate: batchUpdateMock,
        values: { get: getMock, batchUpdate: valuesBatchUpdateMock },
      },
    }),
  },
}))
```

And add resets to the existing `beforeEach`:

```ts
spreadsheetsGetMock.mockReset()
batchUpdateMock.mockReset()
batchUpdateMock.mockResolvedValue({ data: {} })
```

- [ ] **Step 2: Write the failing test**

Add to `src/__tests__/lib/google/sheets.test.ts`:

```ts
describe('removeMaterialRow', () => {
  it('deletes the row carrying the transferId via deleteDimension', async () => {
    // id 102 sits on sheet row 3 (header row 1, 101 on row 2, 102 on row 3)
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102]] } })
    // tab gid lookup
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [
          { properties: { sheetId: 777, title: 'wydatki inwestycyjne (tylko do odczytu)' } },
        ],
      },
    })
    const { removeMaterialRow } = await import('@/lib/google/sheets')
    await removeMaterialRow('s', 102)

    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(batchUpdateMock.mock.calls[0][0].requestBody.requests).toEqual([
      {
        deleteDimension: {
          range: { sheetId: 777, dimension: 'ROWS', startIndex: 2, endIndex: 3 },
        },
      },
    ])
  })

  it('no-ops when the transferId is not on the sheet', async () => {
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101]] } })
    const { removeMaterialRow } = await import('@/lib/google/sheets')
    await removeMaterialRow('s', 999)
    expect(spreadsheetsGetMock).not.toHaveBeenCalled()
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/google/sheets.test.ts -t removeMaterialRow`
Expected: FAIL — `removeMaterialRow is not a function`.

- [ ] **Step 4: Write minimal implementation**

In `src/lib/google/sheets.ts`, add after `updateMaterialRow`:

```ts
// Delete the single row carrying `transferId` (the only deletion path in this
// otherwise append-only model). Used when an edit reassigns an expense to a
// different investment: the row is removed from the OLD sheet. No-op if the id
// isn't on this sheet, or the tab is missing.
export async function removeMaterialRow(spreadsheetId: string, transferId: number): Promise<void> {
  const ids = await readMaterialyTransferIds(spreadsheetId)
  const rowNumber = ids.get(transferId)
  if (rowNumber === undefined) return

  const sheets = getClient()
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  })
  const gid = (meta.data.sheets ?? []).find((s) => s.properties?.title === MATERIALY_TAB)
    ?.properties?.sheetId
  if (gid == null) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: gid,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/lib/google/sheets.test.ts`
Expected: PASS (all describe blocks, including the existing ones with the extended mock).

- [ ] **Step 6: Commit**

```bash
git add src/lib/google/sheets.ts src/__tests__/lib/google/sheets.test.ts
git commit -m "feat(sheets): removeMaterialRow — delete one row by transferId"
```

---

### Task 3: `syncSingleTransferToSheet` updates in place when present

**Files:**

- Modify: `src/lib/actions/sheets-sync.ts` (~L318-321, the `existing.has` early-return + append)
- Test: `src/__tests__/lib/actions/sheets-sync.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/lib/actions/sheets-sync.test.ts`. First import the function (top of file, extend the existing import):

```ts
const { previewMaterialSync, applyMaterialSync, syncSingleTransferToSheet } =
  await import('@/lib/actions/sheets-sync')
```

Then add a describe block:

```ts
describe('syncSingleTransferToSheet', () => {
  it('updates the existing row in place when the transfer is already on the sheet', async () => {
    // transaction lookup, then its investment lookup
    findByIDMock.mockImplementation(({ collection }: { collection: string }) =>
      collection === 'transactions'
        ? Promise.resolve({
            id: 101,
            type: 'INVESTMENT_EXPENSE',
            investment: 31,
            expenseCategory: { name: 'Materiały budowlane' },
            amount: 999,
            description: 'edited',
            date: '2026-05-27T00:00:00Z',
          })
        : Promise.resolve({ id: 31, googleSheetId: 'sheet-1' }),
    )
    sheetColIReturns([101]) // id already present → row 2

    await syncSingleTransferToSheet({ transferId: 101 })

    // exactly one write, and it targets the existing row 2 (update), not row 3 (append)
    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[0].range).toBe(
      "'wydatki inwestycyjne (tylko do odczytu)'!A2",
    )
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[4].values).toEqual([[999]])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts -t "updates the existing row"`
Expected: FAIL — current code returns early on `existing.has(...)`, so `valuesBatchUpdateMock` is never called (0 calls).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/actions/sheets-sync.ts`, import `updateMaterialRow` (extend the existing import from `@/lib/google/sheets`):

```ts
import { appendMaterialRow, readMaterialyTransferIds, updateMaterialRow } from '@/lib/google/sheets'
```

Replace the tail of `syncSingleTransferToSheet` (the `existing.has` early-return + append, ~L318-326) with:

```ts
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
  `[sheets-sync] append transfer #${params.transferId} → sheet ${sheetId} (${row.typ}${
    row.amount < 0 ? ', reversal' : ''
  })`,
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts`
Expected: PASS (new test + all existing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/sheets-sync.ts src/__tests__/lib/actions/sheets-sync.test.ts
git commit -m "feat(sheets-sync): update existing row in place instead of skipping"
```

---

### Task 4: Reconciler heals by overwrite-by-id; result gains `updated`

**Files:**

- Modify: `src/lib/actions/sheets-sync.ts` — `ApplyMaterialSyncResultT`, `applyMaterialSync` loop
- Test: `src/__tests__/lib/actions/sheets-sync.test.ts` — update two existing `applyMaterialSync` tests

- [ ] **Step 1: Update the existing apply tests to the new shape**

In `src/__tests__/lib/actions/sheets-sync.test.ts`, replace the test `does not append an expense already present in the sheet` with:

```ts
// Present rows are now OVERWRITTEN by id (drift heal), not skipped.
it('overwrites an expense already present in the sheet (drift heal)', async () => {
  findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
  findReturns([makeMaterialTransaction(5, 'Materiały budowlane', { amount: 100 })])
  sheetColIReturns([5]) // already synced → row 2

  const result = await applyMaterialSync(31)

  expect(result.success).toBe(true)
  if (!result.success) throw new Error('expected success')
  expect(result.data).toEqual({ added: 0, updated: 1, errors: [] })
  // one write, targeting the existing row 2
  expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
  expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[0].range).toBe(
    "'wydatki inwestycyjne (tylko do odczytu)'!A2",
  )
})
```

And update the `appends an expense that the DB has but the sheet is missing` assertion:

```ts
expect(result.data).toEqual({ added: 1, updated: 0, errors: [] })
expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts -t applyMaterialSync`
Expected: FAIL — result still has `skipped`, present rows aren't written.

- [ ] **Step 3: Update the result type and loop**

In `src/lib/actions/sheets-sync.ts`, change the result type:

```ts
export type ApplyMaterialSyncResultT = {
  added: number
  updated: number
  errors: Array<{ transferId: number; message: string }>
}
```

Replace the body of `applyMaterialSync`'s loop (from `const toAppend = ...` through the `for` loop, ~L231-248) with:

```ts
let added = 0
let updated = 0
const errors: ApplyMaterialSyncResultT['errors'] = []

// Overwrite-by-id heal: append rows the sheet lacks, overwrite present ones to
// match the DB. The id is the join key, not a content fingerprint — an edit
// never changes the id — so we overwrite unconditionally rather than compare.
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

return { success: true, data: { added, updated, errors } }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/sheets-sync.ts src/__tests__/lib/actions/sheets-sync.test.ts
git commit -m "feat(sheets-sync): reconciler heals drift by overwrite-by-id"
```

---

### Task 5: `removeTransferFromSheet` helper

**Files:**

- Modify: `src/lib/actions/sheets-sync.ts` (new exported function; import `removeMaterialRow`)
- Test: `src/__tests__/lib/actions/sheets-sync.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the import at the top of `src/__tests__/lib/actions/sheets-sync.test.ts`:

```ts
const {
  previewMaterialSync,
  applyMaterialSync,
  syncSingleTransferToSheet,
  removeTransferFromSheet,
} = await import('@/lib/actions/sheets-sync')
```

Add a describe block:

```ts
describe('removeTransferFromSheet', () => {
  it('removes the row from the given investment’s sheet', async () => {
    findByIDMock.mockResolvedValue({ id: 31, googleSheetId: 'sheet-old' })
    sheetColIReturns([55]) // id 55 on row 2 of the old sheet
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [{ properties: { sheetId: 12, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })

    await removeTransferFromSheet({ transferId: 55, investmentId: 31 })

    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteDimension.range).toEqual({
      sheetId: 12,
      dimension: 'ROWS',
      startIndex: 1,
      endIndex: 2,
    })
  })

  it('no-ops when the investment has no googleSheetId', async () => {
    findByIDMock.mockResolvedValue({ id: 31, googleSheetId: null })
    await removeTransferFromSheet({ transferId: 55, investmentId: 31 })
    expect(valuesGetMock).not.toHaveBeenCalled()
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts -t removeTransferFromSheet`
Expected: FAIL — `removeTransferFromSheet is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/actions/sheets-sync.ts`, extend the google import and add the function (near `syncSingleTransferToSheet`):

```ts
import {
  appendMaterialRow,
  readMaterialyTransferIds,
  removeMaterialRow,
  updateMaterialRow,
} from '@/lib/google/sheets'
```

```ts
/**
 * Remove a transfer's row from a SPECIFIC investment's sheet. Called when an edit
 * reassigns an expense to a different investment — the stale row is dropped from the
 * OLD sheet (the new sheet gets the row via syncSingleTransferToSheet). Never throws.
 */
export async function removeTransferFromSheet(params: {
  transferId: number
  investmentId: number
}): Promise<void> {
  try {
    const payload = await getPayload({ config })
    const investment = await payload.findByID({
      collection: 'investments',
      id: params.investmentId,
      overrideAccess: true,
    })
    const sheetId = investment?.googleSheetId
    if (!sheetId) return
    await removeMaterialRow(sheetId, params.transferId)
    console.log(`[sheets-sync] remove transfer #${params.transferId} from sheet ${sheetId}`)
  } catch (err) {
    console.error('[sheets-sync] removeTransferFromSheet failed (non-fatal):', err)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/sheets-sync.ts src/__tests__/lib/actions/sheets-sync.test.ts
git commit -m "feat(sheets-sync): removeTransferFromSheet — drop a row from a specific sheet"
```

---

### Task 6: Wire `updateTransferAction` to push edits + handle the move

**Files:**

- Modify: `src/lib/actions/transfers.ts` (`updateTransferAction`, ~L256-309; import `after`, `removeTransferFromSheet`)
- Test: `src/__tests__/transfer-actions.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/__tests__/transfer-actions.test.ts`, the global `next/server` mock no-ops `after()`. Add a focused spy mock so this test can observe the scheduled work. At the top, alongside the other module mocks, add:

```ts
const mockSyncSingle = vi.fn()
const mockRemoveFromSheet = vi.fn()
vi.mock('@/lib/actions/sheets-sync', () => ({
  syncSingleTransferToSheet: (...a: unknown[]) => mockSyncSingle(...a),
  removeTransferFromSheet: (...a: unknown[]) => mockRemoveFromSheet(...a),
}))
```

Change the `next/server` mock to RUN the callback so the scheduled work is observable:

```ts
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (fn: () => unknown) => fn() }
})
```

Add resets in `beforeEach`:

```ts
mockSyncSingle.mockReset()
mockRemoveFromSheet.mockReset()
```

Then add these tests inside the `updateTransferAction` describe block. They reuse the file's existing `makeOriginalTransfer` / `makeUpdateData` helpers. Note `makeOriginalTransfer` defaults to `type: 'INVESTMENT_EXPENSE'` and `createdBy: 3` (managerUser), and does NOT set `investment` unless overridden; `makeUpdateData` defaults `investment: 1`.

```ts
it('pushes the edit to the current sheet and does not remove when investment is unchanged', async () => {
  mockFindByID.mockResolvedValueOnce(
    makeOriginalTransfer({ createdBy: adminUser.id, investment: 2 }),
  )

  await updateTransferAction(10, makeUpdateData({ investment: 2 }))

  expect(mockSyncSingle).toHaveBeenCalledWith({ transferId: 10 })
  expect(mockRemoveFromSheet).not.toHaveBeenCalled()
})

it('removes from the old sheet then pushes to the new when investment changes', async () => {
  mockFindByID.mockResolvedValueOnce(
    makeOriginalTransfer({ createdBy: adminUser.id, investment: 2 }),
  )

  await updateTransferAction(10, makeUpdateData({ investment: 9 }))

  expect(mockRemoveFromSheet).toHaveBeenCalledWith({ transferId: 10, investmentId: 2 })
  expect(mockSyncSingle).toHaveBeenCalledWith({ transferId: 10 })
})

it('does not sync a non-expense type', async () => {
  mockFindByID.mockResolvedValueOnce(
    makeOriginalTransfer({ createdBy: adminUser.id, type: 'LABOR_COST' }),
  )

  await updateTransferAction(10, makeUpdateData())

  expect(mockSyncSingle).not.toHaveBeenCalled()
  expect(mockRemoveFromSheet).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/transfer-actions.test.ts -t updateTransferAction`
Expected: FAIL — `updateTransferAction` doesn't call the sync/remove functions yet.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/actions/transfers.ts`, `after` is already imported from `next/server` (L18). Extend the existing `./sheets-sync` import (L20) to add `removeTransferFromSheet`:

```ts
import { removeTransferFromSheet, syncSingleTransferToSheet } from './sheets-sync'
```

In `updateTransferAction`, after the `amount-edits` create block and the `console.log(...payload.update...)` line, before `return { success: true }`, add. (`fields` is the rest from `const { amount, ...fields } = parsed.data` at ~L277, so `fields.investment` is the post-update id, `number | undefined`. The `original.investment` guard mirrors the inline createdBy idiom at ~L191.)

```ts
// Post-response Materiały sync for synced expenses. If the investment changed,
// drop the stale row from the OLD sheet first, then push to the current sheet
// (append on the new sheet, or update in place if unchanged). after() keeps the
// work alive past the response on Vercel; failures are non-fatal.
if (original.type === 'INVESTMENT_EXPENSE') {
  const originalInvestment = (original as { investment?: number | { id?: number } }).investment
  const oldInvestmentId =
    typeof originalInvestment === 'number' ? originalInvestment : originalInvestment?.id
  const newInvestmentId = fields.investment
  after(async () => {
    if (
      oldInvestmentId !== undefined &&
      newInvestmentId !== undefined &&
      oldInvestmentId !== newInvestmentId
    ) {
      await removeTransferFromSheet({ transferId, investmentId: oldInvestmentId })
    }
    await syncSingleTransferToSheet({ transferId })
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/transfer-actions.test.ts`
Expected: PASS (the new tests + all existing — verify the `after: (fn) => fn()` change didn't break create/cancel tests; those now actually invoke the mocked sync functions, which is fine since the module is mocked).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/transfers.ts src/__tests__/transfer-actions.test.ts
git commit -m "feat(transfers): propagate expense edits + investment moves to the sheet"
```

---

### Task 7: UI — toasts read `updated`; fix preview copy

**Files:**

- Modify: `src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx`

- [ ] **Step 1: Update the reset-path toast (`onSetupConfirm`)**

Replace the `const { added, skipped, errors } = applied.data` block with:

```tsx
const { added, updated, errors } = applied.data
toastMessage(
  `Zakładka zresetowana i zsynchronizowana: +${added} / zaktualizowano ${updated}${
    errors.length ? ` · błędy: ${errors.length}` : ''
  }`,
  errors.length ? 'warning' : 'success',
)
```

- [ ] **Step 2: Update the manual-sync toast (`onConfirm`)**

Replace the `const { added, skipped, errors } = res.data` block with:

```tsx
const { added, updated, errors } = res.data
toastMessage(
  `Synchronizacja: +${added} / zaktualizowano ${updated}${
    errors.length ? ` · błędy: ${errors.length}` : ''
  }`,
  errors.length ? 'warning' : 'success',
)
```

- [ ] **Step 3: Fix the preview dialog copy (now overwrites present rows)**

Replace the preview `DialogDescription` text:

```tsx
<DialogDescription>
  Do arkusza zostaną dodane nowe wydatki inwestycyjne, a istniejące wiersze zostaną odświeżone, aby
  pasowały do danych z aplikacji. Wiersze dodane ręcznie (spoza aplikacji) pozostają bez zmian.
</DialogDescription>
```

- [ ] **Step 4: Verify typecheck + lint + the affected test suites pass**

Run:

```bash
pnpm typecheck
pnpm exec vitest run src/__tests__/lib/google/sheets.test.ts src/__tests__/lib/actions/sheets-sync.test.ts src/__tests__/transfer-actions.test.ts
pnpm lint
```

Expected: typecheck clean; all tests pass; lint 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/inwestycje/[id]/kosztorys/sync-button.tsx"
git commit -m "feat(kosztorys): sync toasts report updated count; fix preview copy"
```

---

## Final verification

- [ ] `pnpm typecheck` — clean
- [ ] `pnpm lint` — 0 errors
- [ ] `pnpm test` — full suite green
- [ ] Update `docs/plans/2026-05-27-kosztorys-sync-review-findings.md`: mark #4 as implemented (live push + overwrite-by-id reconciler heal + investment-move removal), and update the status line at the top.
