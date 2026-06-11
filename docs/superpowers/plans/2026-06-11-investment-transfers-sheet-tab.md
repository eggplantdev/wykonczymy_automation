# Investment "Transfery" Sheet Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second app-managed, read-only tab `'transfery (tylko do odczytu)'` to each linked investment sheet, mirroring the six investment-linked transfer types (all except `INVESTMENT_EXPENSE`), with per-type SUMIF subtotals and no grand total — by generalizing the existing single-tab sheet primitives into config-driven ones.

**Architecture:** Thread a static `SheetTabConfigT` (tab name, header, field matchers, grand-total flag, column widths) through the four sheet primitives in `src/lib/google/sheets.ts`; summary keys stay a runtime parameter (expenses keys come from the DB). Row builders move to a new pure module `src/lib/google/tab-rows.ts` so they are unit-testable (`sheets-sync.ts` is `'use server'` — it cannot export sync helpers). `sheets-sync.ts` entry points become tab-aware and write both tabs; hooks pass the transfer type through for tab routing. A golden characterization test snapshot, written on current code FIRST, locks the expenses tab's emitted Google API requests byte-identical.

**Tech Stack:** Next.js server actions, Payload CMS, googleapis (`sheets_v4`), Vitest (mocked `googleapis`), Playwright MCP for live verification.

**Spec:** `docs/superpowers/specs/2026-06-11-investment-transfers-sheet-tab-design.md`

**Deviations from spec (deliberate):**
- `summaryKeys` is NOT in `SheetTabConfigT` — it's a runtime parameter of `setupTab`/`ensureTab`, because expenses summary keys are DB data (expense-category names) while the config is a static module constant. `includeGrandTotal` stays in the config.
- `previewMaterialSync` is also made tab-aware (spec lists only the four write entry points). Reason: the confirm button is disabled when `pendingChanges === 0`; if the preview ignored the transfers tab, a pending transfers-only change would be unreachable through the Sync button (extension of review T3.1).

**File map:**
- Modify: `src/lib/constants/transfers.ts` — add `SHEET_TRANSFER_TAB_TYPES`
- Modify: `src/lib/google/sheets.ts` — config-driven primitives, both tab configs
- Create: `src/lib/google/tab-rows.ts` — pure row builders (`expenseRow`, `transferRow`) + shared coercion helpers
- Modify: `src/lib/actions/sheets-sync.ts` — dual-tab wiring (preview/apply/single/bulk/remove)
- Modify: `src/hooks/transfers/sync-sheet.ts` — fire for the six types, pass `type` through
- Modify: `src/lib/actions/investments.ts` — `setupSheetAction` + `linkSheetAction` handle both tabs
- Modify: `src/lib/actions/sheets.ts` — `addUnlinkedSheetAction` stamps both tabs
- Modify: `src/components/sheets/sync-button.tsx` — preview shows transfers-tab pending changes; reset dialog copy mentions both tabs
- Create: `src/__tests__/lib/google/sheets-golden.test.ts` — characterization snapshot (criterion 1)
- Create: `src/__tests__/lib/google/tab-rows.test.ts` — row builders + totals parity (criterion 2)
- Modify: `src/__tests__/lib/google/sheets.test.ts`, `src/__tests__/lib/actions/sheets-sync.test.ts`, `src/__tests__/hooks/sync-sheet.test.ts` — call-site/config updates + new transfers-tab cases

**Repo rules in force:** stage by explicit path only (other agents share this tree); never `git push`; no destructive SQL on the local DB; use the two existing kosztorys rows (id 1, id 3 "Testy") for live verification — do NOT register new sheets.

---

### Task 1: Golden characterization test on CURRENT code (criterion 1 baseline)

**Files:**
- Create: `src/__tests__/lib/google/sheets-golden.test.ts`

The point: capture every Google API request the CURRENT expenses-tab code emits, snapshot it, commit. After the refactor only the test's call sites change (config arg) — the snapshot must remain byte-identical.

- [x] **Step 1: Write the characterization test against current exports**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN CHARACTERIZATION TEST (regression lock, spec criterion 1).
// Captures the exact Google Sheets API payloads the EXPENSES tab code emits.
// The snapshot is the contract: the config-driven refactor may change function
// signatures (this file's call sites), but the captured requests must stay
// byte-identical. Do NOT update the snapshot to make a refactor pass — a diff
// here means the expenses tab output changed, which the spec forbids.
// ─────────────────────────────────────────────────────────────────────────────

const getMock = vi.fn()
const valuesBatchUpdateMock = vi.fn()
const valuesClearMock = vi.fn()
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
        values: {
          get: getMock,
          batchUpdate: valuesBatchUpdateMock,
          clear: valuesClearMock,
        },
      },
    }),
  },
}))

const HEADER = ['id', 'data', 'typ wydatku inwestycyjnego', 'opis', 'kwota', 'kategoria', 'notatka']

// Every captured call in order: [apiMethod, requestArg]
function captured() {
  const calls: Array<[string, unknown]> = []
  for (const [name, mock] of [
    ['spreadsheets.get', spreadsheetsGetMock],
    ['spreadsheets.batchUpdate', batchUpdateMock],
    ['values.get', getMock],
    ['values.batchUpdate', valuesBatchUpdateMock],
    ['values.clear', valuesClearMock],
  ] as const) {
    for (const call of mock.mock.calls) calls.push([name, call[0]])
  }
  return calls
}

beforeEach(() => {
  getMock.mockReset()
  valuesBatchUpdateMock.mockReset()
  valuesBatchUpdateMock.mockResolvedValue({ data: {} })
  valuesClearMock.mockReset()
  valuesClearMock.mockResolvedValue({ data: {} })
  spreadsheetsGetMock.mockReset()
  batchUpdateMock.mockReset()
  batchUpdateMock.mockResolvedValue({ data: {} })
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
  })
})

describe('GOLDEN: expenses tab emitted requests', () => {
  it('setupMaterialyTab on a sheet where the tab already exists (reset path)', async () => {
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        properties: { locale: 'pl_PL' },
        sheets: [
          {
            properties: { sheetId: 777, title: 'wydatki inwestycyjne (tylko do odczytu)' },
            conditionalFormats: [{}, {}],
            protectedRanges: [{ protectedRangeId: 55 }],
            tables: [{ tableId: 'tbl-1' }],
          },
        ],
      },
    })
    const { setupMaterialyTab } = await import('@/lib/google/sheets')
    await setupMaterialyTab('golden-sheet', [
      'Materiały budowlane',
      'Materiały wykończeniowe',
      'Pozostałe koszty',
    ])
    expect(captured()).toMatchSnapshot()
  })

  it('setupMaterialyTab when the tab is missing (addSheet path)', async () => {
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: { properties: { locale: 'pl_PL' }, sheets: [] },
    })
    batchUpdateMock.mockResolvedValueOnce({
      data: { replies: [{ addSheet: { properties: { sheetId: 9 } } }] },
    })
    const { setupMaterialyTab } = await import('@/lib/google/sheets')
    await setupMaterialyTab('golden-sheet', ['Materiały budowlane'])
    expect(captured()).toMatchSnapshot()
  })

  it('applyMaterialRowsBatch: update + append + remove in one batch', async () => {
    // header r1, ids 101 r2, 102 r3, 103 r4
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102], [103]] } })
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [
          { properties: { sheetId: 777, title: 'wydatki inwestycyjne (tylko do odczytu)' } },
        ],
      },
    })
    const { applyMaterialRowsBatch } = await import('@/lib/google/sheets')
    const res = await applyMaterialRowsBatch(
      'golden-sheet',
      [
        {
          transferId: 102,
          date: '2026-06-01',
          typ: 'Materiały budowlane',
          description: 'cement "extra"',
          amount: 1234.56,
          category: 'Łazienka',
          note: 'FV/9',
        },
        {
          transferId: 200,
          date: '2026-06-02',
          typ: 'Pozostałe koszty',
          description: 'wywóz gruzu',
          amount: 0,
          category: '',
          note: '',
        },
      ],
      [101, 103],
    )
    expect(res).toEqual({ added: 1, updated: 1, removed: 2 })
    expect(captured()).toMatchSnapshot()
  })
})
```

- [x] **Step 2: Run it — must pass and write the snapshot** *(3 passed, 3 snapshots written — 1228 lines)*

Run: `pnpm exec vitest run src/__tests__/lib/google/sheets-golden.test.ts`
Expected: 3 passed, snapshot file `src/__tests__/lib/google/__snapshots__/sheets-golden.test.ts.snap` written.

- [x] **Step 3: Commit the golden baseline** *(e6bf2d7)*

```bash
git add src/__tests__/lib/google/sheets-golden.test.ts "src/__tests__/lib/google/__snapshots__/sheets-golden.test.ts.snap"
git commit -m "test: golden characterization of expenses-tab Google API requests"
```

---

### Task 2: Constants — `SHEET_TRANSFER_TAB_TYPES`

**Files:**
- Modify: `src/lib/constants/transfers.ts`
- Modify: `src/__tests__/transfer-constants.test.ts` (only if it asserts an exhaustive export list — check first)

- [x] **Step 1: Add the constant** (after `TRANSACTION_TRANSFER_TYPES`)

```ts
// Investment-linked types mirrored on the sheet's 'transfery (tylko do odczytu)'
// tab — every showInvestment type (src/collections/transfers.ts) EXCEPT
// INVESTMENT_EXPENSE (owns the expenses tab) and CANCELLATION (audit row).
// Order = summary-block column order on the tab.
export const SHEET_TRANSFER_TAB_TYPES = [
  'INVESTOR_DEPOSIT',
  'LABOR_COST',
  'RABAT',
  'PAYOUT',
  'CORRECTION',
  'LOSS',
] as const satisfies readonly TransferTypeT[]
export type SheetTransferTabTypeT = (typeof SHEET_TRANSFER_TAB_TYPES)[number]
```

- [x] **Step 2: Typecheck + commit** *(d135c3a; transfer-constants.test.ts has no exhaustive export assertion — untouched)*

Run: `pnpm exec tsc --noEmit` → Expected: clean.

```bash
git add src/lib/constants/transfers.ts
git commit -m "feat: define SHEET_TRANSFER_TAB_TYPES for the transfers sheet tab"
```

---

### Task 3: Refactor `sheets.ts` to config-driven primitives (golden must stay green)

**Files:**
- Modify: `src/lib/google/sheets.ts`
- Modify: `src/__tests__/lib/google/sheets.test.ts` (call sites get the config arg; assertions unchanged)
- Modify: `src/__tests__/lib/google/sheets-golden.test.ts` (call sites ONLY; snapshot untouched)
- Modify (compile-only, expenses config threaded): `src/lib/actions/sheets-sync.ts`, `src/lib/actions/sheets.ts`, `src/lib/actions/investments.ts`

Design — replace module constants with:

```ts
export type SheetTabConfigT = {
  tabName: string
  header: string[]
  // Invariant: Object.keys(fieldMatchers)[i] must be the field that matches header[i]
  // — field order drives cell-write order and column-letter derivation.
  fieldMatchers: Record<string, (h: string) => boolean>
  includeGrandTotal: boolean // RAZEM + =SUM(amount-col) — expenses only
  dataColWidths: number[]
}

export const EXPENSES_TAB_CONFIG: SheetTabConfigT = {
  tabName: 'wydatki inwestycyjne (tylko do odczytu)',
  header: ['id', 'data', 'typ wydatku inwestycyjnego', 'opis', 'kwota', 'kategoria', 'notatka'],
  fieldMatchers: {
    id: (h) => h === 'id',
    date: (h) => h.includes('data'),
    typ: (h) => h.includes('typ'),
    description: (h) => h.includes('opis'),
    amount: (h) => h.includes('kwota'),
    category: (h) => h.includes('kategoria'),
    note: (h) => h.includes('notatka'),
  },
  includeGrandTotal: true,
  dataColWidths: [60, 100, 200, 240, 110, 140, 180],
}

// No grand total: summing money-in with money-out with billing figures and a
// signed CORRECTION produces a number with no financial meaning (spec).
export const TRANSFERS_TAB_CONFIG: SheetTabConfigT = {
  tabName: 'transfery (tylko do odczytu)',
  header: ['id', 'data', 'typ', 'opis', 'kwota', 'pracownik', 'kategoria', 'notatka'],
  fieldMatchers: {
    id: (h) => h === 'id',
    date: (h) => h.includes('data'),
    typ: (h) => h.includes('typ'),
    description: (h) => h.includes('opis'),
    amount: (h) => h.includes('kwota'),
    worker: (h) => h.includes('pracownik'),
    category: (h) => h.includes('kategoria'),
    note: (h) => h.includes('notatka'),
  },
  includeGrandTotal: false,
  dataColWidths: [60, 100, 160, 240, 110, 140, 140, 180],
}
```

Row input becomes flat-generic (keeps `expenseRow` output shape and all existing test expectations unchanged):

```ts
export type TabRowInputT = { transferId: number } & Record<string, string | number>
```

Generalized signatures (old name → new):

```ts
buildMaterialySummary(types, argSep)        → buildTabSummary(cfg, summaryKeys, argSep)
readMaterialyTransferIds(id)                → readTabTransferIds(id, cfg, opts?: { emptyIfMissing?: boolean })
applyMaterialRowsBatch(id, upserts, rm)     → applyTabRowsBatch(id, cfg, upserts, rm)
removeMaterialRow(id, transferId)           → removeTabRow(id, cfg, transferId)
setupMaterialyTab(id, types)                → setupTab(id, cfg, summaryKeys)
ensureMaterialyTab(id, types)               → ensureTab(id, cfg, summaryKeys)
```

- [x] **Step 1: Rewrite `sheets.ts`** — mechanical generalization, code structure and request order PRESERVED. The constant-to-config substitutions:
  - `MATERIALY_TAB` → `cfg.tabName`; `TAB_RANGE` → `` `'${cfg.tabName}'!A:Z` `` (helper `tabRange(cfg)`)
  - `MATERIALY_HEADER` → `cfg.header`; `FIELD_MATCHERS`/`FIELDS` → `cfg.fieldMatchers` / `const fieldsOf = (cfg) => Object.keys(cfg.fieldMatchers)`
  - `SUMMARY_START_COL` (7) → `cfg.header.length`
  - typ/amount column letters in `buildTabSummary` and the conditional-format formula: derive `const colOf = (cfg, field) => columnLetter(fieldsOf(cfg).indexOf(field))` → expenses stays `C`/`E`
  - `valuesByField` → inline `const vals = { ...input, id: input.transferId }`
  - In `setupTab`: header repeatCell `endColumnIndex: 7` → `cfg.header.length`; currency repeatCell `startColumnIndex: 4` → amount field index; `tableEndColIdx = SUMMARY_START_COL + 1 + expenseTypes.length` → `cfg.header.length + labels.length` (labels from `buildTabSummary` — includes RAZEM only when `includeGrandTotal`); RAZEM swatch block wrapped in `if (cfg.includeGrandTotal)`; per-type label column `labelColIdx = SUMMARY_START_COL + 1 + i` → `cfg.header.length + (cfg.includeGrandTotal ? 1 : 0) + i`; summary widths loop `1 + expenseTypes.length` → `labels.length`, width `i === 0 ? 150 : 190` → `cfg.includeGrandTotal && i === 0 ? 150 : 190`; `DATA_COL_WIDTHS` → `cfg.dataColWidths`
  - `buildTabSummary`: `labels = cfg.includeGrandTotal ? ['RAZEM', ...summaryKeys] : [...summaryKeys]`; `totals` starts with `=SUM(E:E)` only when `includeGrandTotal` (E = derived amount column)
  - `readGrid`: throw `class MissingTabError extends Error` for "Unable to parse range" (message text unchanged, parametrized with `cfg.tabName`); `readTabTransferIds` with `emptyIfMissing` catches `MissingTabError` → `new Map()`
  - `resolveHeaders` error messages: parametrize tab name; field list → `fieldsOf(cfg).join(', ')`
  - Keep `formulaArgSeparator` exported unchanged. Type `MaterialRowInputT` → replaced by `TabRowInputT`.

- [x] **Step 2: Update callers compile-only** (still expenses-only behavior — dual-tab wiring is Task 5):
  - `sheets-sync.ts`: `readMaterialyTransferIds(sheetId)` → `readTabTransferIds(sheetId, EXPENSES_TAB_CONFIG)`; `applyMaterialRowsBatch(sheetId, rows, ids)` → `applyTabRowsBatch(sheetId, EXPENSES_TAB_CONFIG, rows, ids)`; `removeMaterialRow(sheetId, id)` → `removeTabRow(sheetId, EXPENSES_TAB_CONFIG, id)`; `AppRowT` → `TabRowInputT` (shape identical)
  - `actions/investments.ts`: `setupMaterialyTab(sheetId, types)` → `setupTab(sheetId, EXPENSES_TAB_CONFIG, types)`; `ensureMaterialyTab(sheetId, types)` → `ensureTab(sheetId, EXPENSES_TAB_CONFIG, types)`
  - `actions/sheets.ts`: same `setupTab` substitution

- [x] **Step 3: Update test call sites** in `sheets.test.ts` and `sheets-golden.test.ts` — import new names, pass `EXPENSES_TAB_CONFIG`. Do NOT touch assertions or the snapshot. `buildMaterialySummary` tests → `buildTabSummary(EXPENSES_TAB_CONFIG, [...], ';')`.

- [x] **Step 4: Run the full suite — golden snapshot must be UNCHANGED** *(601 passed, snapshot byte-identical, tsc clean)*

Run: `pnpm exec vitest run`
Expected: all pass; `sheets-golden` passes WITHOUT `--update`. If the snapshot diffs, the refactor changed emitted requests — fix the refactor, never the snapshot.

Run: `pnpm exec tsc --noEmit` → clean.

- [x] **Step 5: Commit** *(c5fc9b6)*

```bash
git add src/lib/google/sheets.ts src/lib/actions/sheets-sync.ts src/lib/actions/sheets.ts src/lib/actions/investments.ts src/__tests__/lib/google/sheets.test.ts src/__tests__/lib/google/sheets-golden.test.ts
git commit -m "refactor: thread SheetTabConfigT through sheet primitives (expenses output byte-identical)"
```

---

### Task 4: Pure row builders in `tab-rows.ts` + criterion-2 tests

**Files:**
- Create: `src/lib/google/tab-rows.ts`
- Create: `src/__tests__/lib/google/tab-rows.test.ts`
- Modify: `src/lib/actions/sheets-sync.ts` (delete local `isoDate`/`finiteAmount`/`expenseRow`/`TxDoc`, import from tab-rows)

- [x] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { expenseRow, transferRow } from '@/lib/google/tab-rows'
import { SHEET_TRANSFER_TAB_TYPES, TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'

const base = { date: '2026-06-01T00:00:00.000Z', description: 'x', invoiceNote: '' }

describe('transferRow', () => {
  it('maps each of the six types to the 8-column shape with the PL type label', () => {
    for (const type of SHEET_TRANSFER_TAB_TYPES) {
      const row = transferRow({ ...base, id: 7, type, amount: 100 })
      expect(row).toEqual({
        transferId: 7,
        date: '2026-06-01',
        typ: TRANSFER_TYPE_LABELS[type],
        description: 'x',
        amount: 100,
        worker: '',
        category: '',
        note: '',
      })
    }
  })

  it('fills pracownik from the worker relation (PAYOUT)', () => {
    const row = transferRow({ ...base, id: 7, type: 'PAYOUT', amount: 50, worker: { name: 'Jan' } })
    expect(row?.worker).toBe('Jan')
  })

  it('fills kategoria from expenseCategory (CORRECTION) and preserves a negative amount', () => {
    const row = transferRow({
      ...base,
      id: 7,
      type: 'CORRECTION',
      amount: -120.5,
      expenseCategory: { name: 'Materiały budowlane' },
    })
    expect(row?.amount).toBe(-120.5)
    expect(row?.category).toBe('Materiały budowlane')
  })

  it('returns undefined for types outside the six (never a row on this tab)', () => {
    for (const type of ['INVESTMENT_EXPENSE', 'CANCELLATION', 'COMPANY_FUNDING', 'OTHER']) {
      expect(transferRow({ ...base, id: 7, type, amount: 10 })).toBeUndefined()
    }
  })

  it('skips a non-finite amount (would corrupt SUMIF totals)', () => {
    expect(transferRow({ ...base, id: 7, type: 'PAYOUT', amount: '' })).toBeUndefined()
    expect(transferRow({ ...base, id: 7, type: 'PAYOUT', amount: 'x' })).toBeUndefined()
  })
})

// Criterion 2: per-type SUMIF over emitted rows must equal the filtered-view
// totals 1:1. sumFilteredByType sums amount AS-IS with `cancelled IS NOT TRUE`,
// scoped to the investment — replicate that selection over a seeded dataset and
// compare against the sum of the rows transferRow() emits.
describe('sheet totals == filtered view (criterion 2)', () => {
  const docs = [
    { id: 1, type: 'INVESTOR_DEPOSIT', amount: 1000, investment: 31, ...base },
    { id: 2, type: 'LABOR_COST', amount: 400, investment: 31, ...base },
    { id: 3, type: 'RABAT', amount: 50, investment: 31, ...base },
    { id: 4, type: 'PAYOUT', amount: 300, investment: 31, worker: { name: 'Jan' }, ...base },
    { id: 5, type: 'PAYOUT', amount: 999, investment: 31, cancelled: true, ...base }, // excluded
    { id: 6, type: 'CORRECTION', amount: -120, investment: 31, ...base }, // sign preserved
    { id: 7, type: 'CORRECTION', amount: 80, investment: 31, ...base },
    { id: 8, type: 'LOSS', amount: 60, investment: 31, ...base },
    { id: 9, type: 'LOSS', amount: 77 }, // no investment → never on any tab
    { id: 10, type: 'INVESTMENT_EXPENSE', amount: 500, investment: 31, ...base }, // other tab
    { id: 11, type: 'PAYOUT', amount: 111, investment: 32, ...base }, // other investment
  ]

  // The desired row set for investment 31 (mirrors loadAppTransferRows' where).
  const desired = docs.filter(
    (d) =>
      d.investment === 31 &&
      (SHEET_TRANSFER_TAB_TYPES as readonly string[]).includes(d.type) &&
      d.cancelled !== true,
  )

  // What sumFilteredByType would return for investment 31, per type.
  const dbTotal = (type: string) =>
    docs
      .filter((d) => d.investment === 31 && d.type === type && d.cancelled !== true)
      .reduce((s, d) => s + Number(d.amount), 0)

  it('per-type sum of emitted kwota equals the filtered-view total for every type', () => {
    const rows = desired.map((d) => transferRow(d)).filter(Boolean)
    for (const type of SHEET_TRANSFER_TAB_TYPES) {
      const label = TRANSFER_TYPE_LABELS[type]
      const sheetSum = rows
        .filter((r) => r!.typ === label)
        .reduce((s, r) => s + Number(r!.amount), 0)
      expect(sheetSum).toBe(dbTotal(type))
    }
  })

  it('unlinked LOSS and cancelled transfers emit no row', () => {
    const ids = desired.map((d) => d.id)
    expect(ids).not.toContain(5)
    expect(ids).not.toContain(9)
  })
})

describe('expenseRow (behavior unchanged by the refactor)', () => {
  it('maps an expense and slices the ISO date', () => {
    expect(
      expenseRow({
        id: 3,
        amount: 250,
        date: '2026-05-27T00:00:00.000Z',
        description: 'cement',
        invoiceNote: 'FV/1',
        expenseCategory: { name: 'Materiały budowlane' },
        otherCategory: { name: 'Łazienka' },
      }),
    ).toEqual({
      transferId: 3,
      date: '2026-05-27',
      typ: 'Materiały budowlane',
      description: 'cement',
      amount: 250,
      category: 'Łazienka',
      note: 'FV/1',
    })
  })

  it('skips a missing category and a non-finite amount', () => {
    expect(expenseRow({ id: 3, amount: 250, expenseCategory: null })).toBeUndefined()
    expect(
      expenseRow({ id: 3, amount: '', expenseCategory: { name: 'Materiały budowlane' } }),
    ).toBeUndefined()
  })
})
```

- [x] **Step 2: Run to verify failure** — `pnpm exec vitest run src/__tests__/lib/google/tab-rows.test.ts` → FAIL (module missing).

- [x] **Step 3: Implement `src/lib/google/tab-rows.ts`** *(transferSummaryKeys landed in sheets.ts next to the configs instead)* — move `isoDate`, `finiteAmount`, `TxDoc` (rename `TxDocT`), `expenseRow` verbatim from `sheets-sync.ts`; add:

```ts
import { getRelationName } from '@/lib/get-relation-name'
import {
  SHEET_TRANSFER_TAB_TYPES,
  TRANSFER_TYPE_LABELS,
  type TransferTypeT,
} from '@/lib/constants/transfers'
import type { TabRowInputT } from './sheets'

// ... isoDate, finiteAmount, TxDocT, expenseRow moved verbatim ...

const isTransferTabType = (t: unknown): t is TransferTypeT =>
  (SHEET_TRANSFER_TAB_TYPES as readonly string[]).includes(String(t))

// Row for the transfers tab: one of the six mirrored types → the 8-column shape.
// `worker` is PAYOUT context, `category` is CORRECTION context — blank otherwise.
export function transferRow(t: TxDocT & { type?: string; worker?: unknown }): TabRowInputT | undefined {
  if (!isTransferTabType(t.type)) return undefined
  const amount = finiteAmount(t.amount)
  if (amount === undefined) {
    console.warn(`[sheets-sync] skip transfer #${t.id}: non-finite amount ${String(t.amount)}`)
    return undefined
  }
  return {
    transferId: t.id,
    date: isoDate(t.date),
    typ: TRANSFER_TYPE_LABELS[t.type],
    description: t.description ?? '',
    amount,
    worker: getRelationName(t.worker, ''),
    category: getRelationName(t.expenseCategory, '') || getRelationName(t.otherCategory, ''),
    note: t.invoiceNote ?? '',
  }
}

// PL labels for the transfers tab's per-type SUMIF summary, in tab order.
export const transferSummaryKeys = (): string[] =>
  SHEET_TRANSFER_TAB_TYPES.map((t) => TRANSFER_TYPE_LABELS[t])
```

`sheets-sync.ts` imports `{ expenseRow, transferRow, transferSummaryKeys }` and deletes its local copies (`relId` stays — it's about Payload relations, not rows).

- [x] **Step 4: Run** — 610 passed full-suite, tsc clean (one interim Number() coercion in sync-button.tsx).

- [x] **Step 5: Commit** *(see git log)*

```bash
git add src/lib/google/tab-rows.ts src/__tests__/lib/google/tab-rows.test.ts src/lib/actions/sheets-sync.ts
git commit -m "feat: transferRow builder + pure row module with totals-parity tests"
```

---

### Task 5: Dual-tab wiring in `sheets-sync.ts` + hooks

**Files:**
- Modify: `src/lib/actions/sheets-sync.ts`
- Modify: `src/hooks/transfers/sync-sheet.ts`
- Modify: `src/__tests__/lib/actions/sheets-sync.test.ts`, `src/__tests__/hooks/sync-sheet.test.ts`

- [x] **Step 1: Make the existing mocks range-aware, then write the new failing tests.** `valuesGetMock` must dispatch on the requested range (expenses grid vs transfers grid), e.g.:

```ts
const TRANSFERS_HEADER = ['id', 'data', 'typ', 'opis', 'kwota', 'pracownik', 'kategoria', 'notatka']
function sheetGrids(expensesIds: number[], transfersIds: number[]) {
  valuesGetMock.mockImplementation(({ range }: { range: string }) =>
    Promise.resolve({
      data: {
        values: range.startsWith("'transfery")
          ? [TRANSFERS_HEADER, ...transfersIds.map((id) => [id])]
          : [SHEET_HEADER, ...expensesIds.map((id) => [id])],
      },
    }),
  )
}
```

New test cases (exact behaviors):
- `applyMaterialSync` reconciles BOTH tabs: expenses upserts land on the expenses tab range, transfer upserts on the transfers tab range; returned counts are the sums across tabs.
- `applyMaterialSync` orphan guard for the transfers tab queries `{ type: { in: [...SHEET_TRANSFER_TAB_TYPES] } }` + `{ investment: { equals } }` (same id-collision rationale as T1.1).
- `applyMaterialSync` creates the transfers tab first when it is missing (spreadsheets.get shows no `'transfery (tylko do odczytu)'` → `ensureTab` setup requests fire before row writes; old sheets self-heal).
- `previewMaterialSync` returns `transfersToAppend` / `transfersToUpdateCount` / `transfersToRemoveCount`, and treats a missing transfers tab as "everything appends" (no throw).
- `syncSingleTransferToSheet` routes a `PAYOUT` to the transfers tab (writes hit `'transfery (tylko do odczytu)'!`).
- `syncSingleTransferToSheet` on `CANCELLATION` of a `LABOR_COST` removes the original's row from the TRANSFERS tab (deleteRange `endColumnIndex: 8`).
- `syncSingleTransferToSheet` still ignores types outside expenses+six (e.g. `REGISTER_TRANSFER`).
- `removeTransferFromSheet` routes by the new `type` param: `type: 'PAYOUT'` deletes from the transfers tab (`endColumnIndex: 8`), `type: 'INVESTMENT_EXPENSE'` from the expenses tab (`endColumnIndex: 7`).
- Hooks: `syncSheetAfterChange`/`syncSheetAfterDelete` fire for each of the six (replace the old "skips non-expense types" with "skips non-sheet types: REGISTER_TRANSFER, OTHER, COMPANY_FUNDING, OTHER_DEPOSIT, CANCELLATION"); `removeTransferFromSheet` calls now carry `type`.

- [x] **Step 2: Run new tests — verify they fail.** *(11 failed red)* `pnpm exec vitest run src/__tests__/lib/actions/sheets-sync.test.ts src/__tests__/hooks/sync-sheet.test.ts` → new cases FAIL.

- [x] **Step 3: Implement the wiring.** *(TabSyncSpecT bundles cfg + typeWhere + buildRow; tabSyncForType routes)* Shape:

```ts
// sheets-sync.ts — per-tab plumbing
import {
  applyTabRowsBatch, ensureTab, readTabTransferIds, removeTabRow,
  EXPENSES_TAB_CONFIG, TRANSFERS_TAB_CONFIG, type SheetTabConfigT, type TabRowInputT,
} from '@/lib/google/sheets'
import { expenseRow, transferRow, transferSummaryKeys } from '@/lib/google/tab-rows'
import { SHEET_TRANSFER_TAB_TYPES } from '@/lib/constants/transfers'

const TRANSFER_TAB_TYPES = [...SHEET_TRANSFER_TAB_TYPES]
const isTransfersTabType = (t: unknown) => TRANSFER_TAB_TYPES.includes(t as never)
const tabConfigForType = (t: unknown): SheetTabConfigT | undefined =>
  t === 'INVESTMENT_EXPENSE' ? EXPENSES_TAB_CONFIG
  : isTransfersTabType(t) ? TRANSFERS_TAB_CONFIG
  : undefined

// loadAppTransferRows mirrors loadAppMaterialRows with
// { type: { in: TRANSFER_TAB_TYPES } } and transferRow().

// buildSyncPlan gains (cfg, types, loader) params; orphan where uses
// { type: { in: types } } (single-element array for expenses keeps semantics).

// previewMaterialSync: build both plans; transfers plan passes
// { emptyIfMissing: true } to readTabTransferIds.

// applyMaterialSync:
//   expenses: as today.
//   transfers: await ensureTab(sheetId, TRANSFERS_TAB_CONFIG, transferSummaryKeys())
//              then plan + applyTabRowsBatch. Combined counts returned.

// syncSingleTransferToSheet:
//   CANCELLATION → resolve original; cfg = tabConfigForType(original.type); if cfg →
//     removeTabRow(sheetId, cfg, origId).
//   else cfg = tabConfigForType(transfer.type); if !cfg → return.
//   row = cancelled ? undefined : cfg === EXPENSES_TAB_CONFIG ? expenseRow(t) : transferRow(t)
//   if !row → removeTabRow(sheetId, cfg, id); else:
//     if cfg === TRANSFERS_TAB_CONFIG → await ensureTab(...) first (self-heal old sheets)
//     applyTabRowsBatch(sheetId, cfg, [row], [])

// removeTransferFromSheet params gain `type`; route via tabConfigForType, default
// EXPENSES_TAB_CONFIG when omitted (defensive).

// syncBulkExpensesToSheet: group rows per investment per tab (Map<invId, {expenses, transfers}>),
// route each doc via tabConfigForType + the matching row builder; one batch per tab per investment.
```

`MaterialSyncPreviewT` extension:

```ts
export type MaterialSyncPreviewT = {
  toAppend: TabRowInputT[]
  toUpdateCount: number
  toRemoveCount: number
  transfersToAppend: TabRowInputT[]
  transfersToUpdateCount: number
  transfersToRemoveCount: number
  spreadsheetId: string
}
```

Hook (`sync-sheet.ts`):

```ts
import { SHEET_TRANSFER_TAB_TYPES } from '@/lib/constants/transfers'
const SHEET_SYNCED_TYPES: readonly string[] = ['INVESTMENT_EXPENSE', ...SHEET_TRANSFER_TAB_TYPES]
// afterChange guard: if (!SHEET_SYNCED_TYPES.includes(doc.type)) return doc
// reassign path + afterDelete: removeTransferFromSheet({ transferId, investmentId, type: doc.type })
```

- [x] **Step 4: Run the full suite** *(620 passed, tsc clean)* — `pnpm exec vitest run` → all pass (golden untouched). `pnpm exec tsc --noEmit` → clean.

- [x] **Step 5: Commit**

```bash
git add src/lib/actions/sheets-sync.ts src/hooks/transfers/sync-sheet.ts src/__tests__/lib/actions/sheets-sync.test.ts src/__tests__/hooks/sync-sheet.test.ts
git commit -m "feat: mirror the six investment transfer types onto the transfery sheet tab"
```

---

### Task 6: Link/setup flow + Sync button UI

**Files:**
- Modify: `src/lib/actions/investments.ts` (`setupSheetAction`, `linkSheetAction`)
- Modify: `src/lib/actions/sheets.ts` (`addUnlinkedSheetAction`)
- Modify: `src/components/sheets/sync-button.tsx`

- [x] **Step 1: Actions — both tabs.**
  - `setupSheetAction` (explicit reset): `await setupTab(sheetId, EXPENSES_TAB_CONFIG, types)` then `await setupTab(sheetId, TRANSFERS_TAB_CONFIG, transferSummaryKeys())`.
  - `linkSheetAction` (create-if-missing on link): `await ensureTab(sheetId, EXPENSES_TAB_CONFIG, types)` then `await ensureTab(sheetId, TRANSFERS_TAB_CONFIG, transferSummaryKeys())` inside the existing try/catch.
  - `addUnlinkedSheetAction`: same two `setupTab` calls as `setupSheetAction` (registration stamps fresh tabs — existing destructive semantics, now consistent for both tabs).

- [x] **Step 2: `sync-button.tsx`.**
  - `pendingChanges` adds the three transfers fields.
  - Counts line shows both tabs; add a second `<Section>` `Transfery do dodania (N)` rendering `transfersToAppend` with the same row format (fields are flat: `r.typ`, `r.amount`, `r.description`, `r.date` — all `String()`/`Number()` coerced for TS).
  - Reset-dialog copy: mention both tabs — „wydatki inwestycyjne (tylko do odczytu)" **i „transfery (tylko do odczytu)"** zostaną zbudowane od nowa.
  - Sync toast: keep combined counts (one line).

- [x] **Step 3: Full suite + typecheck** *(620 passed, tsc clean)* — `pnpm exec vitest run && pnpm exec tsc --noEmit` → clean.

- [x] **Step 4: Commit**

```bash
git add src/lib/actions/investments.ts src/lib/actions/sheets.ts src/components/sheets/sync-button.tsx
git commit -m "feat: provision and preview the transfery tab in link/setup/sync flows"
```

---

### Task 7: Live verification (criterion 3) — Playwright + Sheets API read-back

Uses ONLY existing kosztorys records (id 3 "Testy" → Google sheet `1nYnqG5AoGsr_ShA7SsvZuNv6R22wZ89mn2sLe6OMG8g`); do NOT register new sheets. Local data is real — create clearly-named test records via the app UI and delete them afterwards (delete recalcs balances back; also exercises the removal path live).

- [x] **Step 1:** Snapshot the expenses tab of the test sheet BEFORE (Sheets API `values.get` on `'wydatki inwestycyjne (tylko do odczytu)'!A:Z`) → save to a temp file for the byte-identical comparison in Step 8.
- [x] **Step 2:** Start dev server (`pnpm dev`, background). Login via Playwright with `ADMIN`/`PASS` from `.env`.
- [x] **Step 3:** Create investment `TEST transfery — do usunięcia` (id 76); linked kosztorys "Testy" (id 3) via the listing's link flow. Post-link sync **self-created the transfers tab live**.
- [x] **Step 4:** Via the app UI created: INVESTOR_DEPOSIT 1000; LABOR_COST 400; RABAT 50; PAYOUT 300 (with a worker); CORRECTION −120; LOSS 60 (with the investment); LOSS 77 WITHOUT an investment; plus one extra PAYOUT 99 that is then CANCELLED via the UI.
- [x] **Step 5:** On the kosztorys page clicked „Synchronizuj wydatki inwestycyjne" → dialog must show the transfers-tab pending counts → confirm.
- [x] **Step 6:** Read back via Sheets API (node script, `set -a && source .env`):
  - tab `'transfery (tylko do odczytu)'` exists, is protected (protectedRanges editor = SA only)
  - rows = exactly the 6 active investment-linked transfers (no cancelled PAYOUT, no unlinked LOSS)
  - `valueRenderOption=UNFORMATTED_VALUE` on the summary row: SUMIF values equal 1000 / 400 / 50 / 300 / −120 / 60
  - no RAZEM cell in the transfers summary block
- [x] **Step 7:** Cross-check criterion 2 live (DB-filtered totals == evaluated SUMIFs 1:1; 1000/400/50/300/−120/60): investment view's filtered per-type totals (UI) match the SUMIF read-backs.
- [x] **Step 8:** Re-read the expenses tab — diff clean, byte-identical (also after the dual-tab reset). → byte-identical to Step 1's snapshot (criterion 1, live).
- [x] **Step 9:** Cleanup via UI/API (admin bulk delete raced per-row removals — pre-existing trait; healed via the dual-tab reset button, which was thereby live-tested too): cancel or delete the test transfers → verify their rows disappear from the transfers tab (live removal path); delete the unlinked LOSS; unlink kosztorys "Testy" from the investment; delete investment `TEST transfery — do usunięcia`. Verify register balances returned to their Step-2 values.
- [x] **Step 10:** Report results with screenshots (`sync-preview-dialog.png`, `reset-dialog-both-tabs.png` in `.playwright-mcp/`).

---

### Task 8: Final gates

- [x] **Step 1:** `pnpm exec vitest run` → 620/620 green (no pre-existing failures at run time).
- [x] **Step 2:** tsc clean; eslint clean on all touched files (repo-wide `pnpm lint` has 9 pre-existing errors in `scripts/inspect-template.mjs`, untouched).
- [x] **Step 3:** `simplify` run — 5 applied (commit 0997e3d), 2 proposed, 6 dismissed; report in tmp file.
- [x] **Step 4:** All work committed by explicit path; nothing pushed.

## Self-review notes

- Spec coverage: scope/six types (T2, T4, T5), cancellation semantics (T5), tab layout + protection + no-RAZEM (T3), sign convention (T4 tests), generalize-don't-fork (T3), wiring incl. all four entry points + hooks + link/setup (T5, T6), test plan criteria 1–3 (T1, T4, T7). Optional env-gated live integration test: SKIPPED deliberately — T7 covers it manually once; repo policy is cautious about live Google writes in CI.
- Open item from spec (seed strategy): resolved — mocked payload docs, same as `sheets-sync.test.ts`.
- Type consistency: `TabRowInputT` flat shape used consistently (T3 defines, T4 builders return it, T5 preview exposes it).
