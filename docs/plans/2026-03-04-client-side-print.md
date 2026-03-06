# Client-Side Print Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the slow server-rendered print page with client-side printing via iframe, eliminating the full-page reload and data re-fetch.

**Architecture:** Detail pages already have header field data (investment financials, register balance, worker saldo). Pass it through `TransferTableConfigT`. The export toolbar fetches all rows via the existing `fetchFilteredTransfers` server action (same as CSV), builds an HTML document, injects it into a hidden iframe, and calls `print()`. Delete the `(print)` route group entirely.

**Tech Stack:** No new dependencies. Uses existing `fetchFilteredTransfers` server action, `TRANSFER_EXPORT_COLUMNS` config, iframe `contentWindow.print()`.

---

### Task 1: Add `headerFields` to `TransferTableConfigT`

**Files:**
- Modify: `src/types/export.ts`

**Step 1: Update the type**

Add `headerFields` to `TransferTableConfigT`:

```typescript
export type TransferTableConfigT = {
  readonly query: TransferQueryT
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly context?: ExportContextT
  readonly contextId?: number
  readonly headerFields?: HeaderFieldT[]
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (new optional field, no breakage)

**Step 3: Commit**

```bash
git add src/types/export.ts
git commit -m "feat: add headerFields to TransferTableConfigT"
```

---

### Task 2: Pass header fields from detail pages through config

**Files:**
- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx`
- Modify: `src/app/(frontend)/kasa/[id]/page.tsx`
- Modify: `src/components/user-transfer-view.tsx`

Each page already computes the data shown in StatCards. Build `HeaderFieldT[]` from that data and add it to the config object.

**Step 1: Investment page**

In `src/app/(frontend)/inwestycje/[id]/page.tsx`, build header fields from existing variables (`investment`, `totalCosts`, `totalIncome`, `investment.laborCosts`). Only include financial fields for admin/owner (same logic as the StatCard conditional):

```typescript
import type { HeaderFieldT } from '@/types/export'

// After existing variable declarations (totalCosts, totalIncome, etc.)
const headerFields: HeaderFieldT[] = [{ label: 'Inwestycja', value: investment.name }]
if (isAdminOrOwnerRole(user.role)) {
  headerFields.push(
    { label: 'Koszty inwestycji', value: formatPLN(totalCosts) },
    { label: 'Wpłaty od inwestora', value: formatPLN(totalIncome) },
    { label: 'Koszty robocizny', value: formatPLN(investment.laborCosts ?? 0) },
    { label: 'Bilans', value: formatPLN(totalIncome - totalCosts - (investment.laborCosts ?? 0)) },
  )
}
```

Add `headerFields` to the config object:

```tsx
<TransfersSection
  config={{
    query: { where: transferWhere, page, limit },
    baseUrl: `/inwestycje/${id}`,
    excludeColumns: ['investment'],
    filters: {},
    context: 'investment',
    contextId: investmentId,
    headerFields,
  }}
/>
```

**Step 2: Register page**

In `src/app/(frontend)/kasa/[id]/page.tsx`, build from existing `register`, `balance`, `ownerName`:

```typescript
import type { HeaderFieldT } from '@/types/export'

const headerFields: HeaderFieldT[] = [
  { label: 'Kasa', value: register.name },
  { label: 'Właściciel', value: ownerName },
  { label: 'Saldo', value: formatPLN(balance) },
]
```

Add `headerFields` to config.

**Step 3: Worker page**

In `src/components/user-transfer-view.tsx`, build from existing `worker`, `saldo`:

```typescript
import type { HeaderFieldT } from '@/types/export'

const headerFields: HeaderFieldT[] = [
  { label: 'Pracownik', value: worker.name },
  { label: 'Saldo', value: formatPLN(saldo) },
]
```

Add `headerFields` to config.

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/\(frontend\)/inwestycje/\[id\]/page.tsx src/app/\(frontend\)/kasa/\[id\]/page.tsx src/components/user-transfer-view.tsx
git commit -m "feat: pass header fields through TransferTableConfigT"
```

---

### Task 3: Create `buildPrintHtml` utility with tests

**Files:**
- Create: `src/lib/export/print.ts`
- Create: `src/__tests__/build-print-html.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/build-print-html.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildPrintHtml } from '@/lib/export/print'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { HeaderFieldT } from '@/types/export'

const makeRow = (overrides: Partial<TransferRowT> = {}): TransferRowT => ({
  id: 1,
  description: 'Test transfer',
  amount: '100.00',
  type: 'INVESTMENT_EXPENSE',
  paymentMethod: 'CASH',
  date: '2026-01-15',
  sourceRegisterId: 1,
  sourceRegisterName: 'Kasa główna',
  targetRegisterId: null,
  targetRegisterName: '',
  investmentId: 1,
  investmentName: 'Inwestycja A',
  workerId: 1,
  workerName: 'Jan Kowalski',
  otherCategoryName: '',
  createdByName: 'Admin',
  createdAt: '2026-01-15T10:00:00Z',
  invoiceUrl: null,
  invoiceFilename: null,
  invoiceMimeType: null,
  invoiceNote: null,
  cancelled: false,
  ...overrides,
})

describe('buildPrintHtml', () => {
  it('renders header fields when provided', () => {
    const fields: HeaderFieldT[] = [
      { label: 'Inwestycja', value: 'Test' },
      { label: 'Saldo', value: '1 000,00 zł' },
    ]
    const html = buildPrintHtml([], ['date'], fields)

    expect(html).toContain('Inwestycja')
    expect(html).toContain('Test')
    expect(html).toContain('Saldo')
    expect(html).toContain('1 000,00 zł')
  })

  it('renders table rows with visible columns only', () => {
    const rows = [makeRow({ description: 'Materiały budowlane' })]
    const html = buildPrintHtml(rows, ['date', 'description', 'amount'], [])

    expect(html).toContain('Data')
    expect(html).toContain('Opis')
    expect(html).toContain('Kwota')
    expect(html).toContain('Materiały budowlane')
    // 'worker' column not in visibleColumnIds — should not appear
    expect(html).not.toContain('Pracownik')
  })

  it('marks cancelled rows', () => {
    const rows = [makeRow({ cancelled: true })]
    const html = buildPrintHtml(rows, ['description'], [])

    expect(html).toContain('cancelled')
  })

  it('escapes HTML in cell values', () => {
    const rows = [makeRow({ description: '<script>alert("xss")</script>' })]
    const html = buildPrintHtml(rows, ['description'], [])

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('skips unknown column IDs', () => {
    const html = buildPrintHtml([], ['nonexistent', 'date'], [])

    expect(html).toContain('Data')
    expect(html).not.toContain('nonexistent')
  })

  it('returns valid HTML document', () => {
    const html = buildPrintHtml([], ['date'], [])

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="pl">')
    expect(html).toContain('@page')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/build-print-html.test.ts`
Expected: FAIL — module `@/lib/export/print` does not exist

**Step 3: Write the implementation**

Create `src/lib/export/print.ts`:

```typescript
import { TRANSFER_EXPORT_COLUMNS } from '@/lib/export/transfer-columns'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { HeaderFieldT } from '@/types/export'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildPrintHtml(
  rows: TransferRowT[],
  visibleColumnIds: string[],
  headerFields: HeaderFieldT[],
): string {
  const columns = visibleColumnIds
    .filter((id) => TRANSFER_EXPORT_COLUMNS[id])
    .map((id) => ({ id, ...TRANSFER_EXPORT_COLUMNS[id]! }))

  const headerHtml =
    headerFields.length > 0
      ? `<div class="fields">${headerFields
          .map(
            (f) =>
              `<div><span class="label">${escapeHtml(f.label)}: </span><span class="value">${escapeHtml(f.value)}</span></div>`,
          )
          .join('')}</div>`
      : ''

  const theadHtml = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')

  const tbodyHtml = rows
    .map(
      (row) =>
        `<tr${row.cancelled ? ' class="cancelled"' : ''}>${columns
          .map((c) => `<td>${escapeHtml(c.getValue(row))}</td>`)
          .join('')}</tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<style>
@page { margin: 10mm; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; margin: 0; padding: 16px; }
.fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 16px; margin-bottom: 16px; font-size: 12px; }
.label { color: #666; }
.value { font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-weight: 600; padding: 4px 6px; border-bottom: 2px solid #333; font-size: 11px; }
td { padding: 3px 6px; border-bottom: 1px solid #e5e5e5; }
tr:last-child td { border-bottom: none; }
.cancelled { text-decoration: line-through; opacity: 0.5; }
</style>
</head>
<body>${headerHtml}<table><thead><tr>${theadHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table></body>
</html>`
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/build-print-html.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add src/lib/export/print.ts src/__tests__/build-print-html.test.ts
git commit -m "feat: add buildPrintHtml utility with tests"
```

---

### Task 4: Create `printViaIframe` utility

**Files:**
- Create: `src/lib/export/print-iframe.ts`

**Step 1: Create the iframe print helper**

This is a DOM utility — not unit-testable without jsdom. Keep it minimal.

Create `src/lib/export/print-iframe.ts`:

```typescript
export function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.width = '0'
  iframe.style.height = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  // Wait for content to render before printing
  iframe.contentWindow?.addEventListener('afterprint', () => iframe.remove())

  // Small delay to ensure styles are applied
  setTimeout(() => {
    iframe.contentWindow?.print()
  }, 100)
}
```

**Step 2: Commit**

```bash
git add src/lib/export/print-iframe.ts
git commit -m "feat: add printViaIframe DOM utility"
```

---

### Task 5: Update `TransferExportToolbar` for client-side print

**Files:**
- Modify: `src/components/transfers/transfer-export-toolbar.tsx`

**Step 1: Replace `handlePrint` with client-side logic**

The new `handlePrint`:
1. Shows loading state (reuse pattern from CSV)
2. Fetches all rows via `fetchFilteredTransfers` (same server action as CSV)
3. Calls `buildPrintHtml` with rows, visible columns, and header fields from config
4. Calls `printViaIframe`

```typescript
'use client'

import { useCallback, useState } from 'react'
import type { VisibilityState } from '@tanstack/react-table'
import { Printer, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildTransferCsv } from '@/lib/export/csv'
import { buildPrintHtml } from '@/lib/export/print'
import { printViaIframe } from '@/lib/export/print-iframe'
import { triggerDownload } from '@/lib/export/download'
import { getTransferColumns } from '@/lib/tables/transfers'
import type { TransferTableConfigT } from '@/types/export'

type TransferExportToolbarPropsT = {
  readonly config: TransferTableConfigT
  readonly columnVisibility: VisibilityState
}

function getVisibleColumnIds(
  excludeColumns: string[],
  columnVisibility: VisibilityState,
): string[] {
  const columns = getTransferColumns(excludeColumns)
  return columns
    .filter((col) => col.id && columnVisibility[col.id] !== false)
    .map((col) => col.id as string)
}

export function TransferExportToolbar({
  config,
  columnVisibility,
}: TransferExportToolbarPropsT) {
  const { query, excludeColumns = [], headerFields = [] } = config
  const [isPrintLoading, setIsPrintLoading] = useState(false)
  const [isCsvLoading, setIsCsvLoading] = useState(false)

  const visibleColumnIds = getVisibleColumnIds(excludeColumns, columnVisibility)

  const handlePrint = useCallback(async () => {
    setIsPrintLoading(true)
    try {
      const result = await fetchFilteredTransfers(query.where)
      if (!result.success) {
        console.error('Print fetch failed:', result.error)
        return
      }
      const html = buildPrintHtml(result.data, visibleColumnIds, headerFields)
      printViaIframe(html)
    } finally {
      setIsPrintLoading(false)
    }
  }, [query.where, visibleColumnIds, headerFields])

  const handleCsv = useCallback(async () => {
    setIsCsvLoading(true)
    try {
      const result = await fetchFilteredTransfers(query.where)
      if (!result.success) {
        console.error('Export failed:', result.error)
        return
      }
      const csv = buildTransferCsv(result.data, visibleColumnIds)
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const date = new Date().toISOString().slice(0, 10)
      triggerDownload(blob, `transfery-${date}.csv`)
    } finally {
      setIsCsvLoading(false)
    }
  }, [query.where, visibleColumnIds])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handlePrint}
        disabled={isPrintLoading}
        aria-label="Drukuj transfery"
      >
        {isPrintLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Printer className="size-4" />
        )}
        Drukuj
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleCsv}
        disabled={isCsvLoading}
        aria-label="Pobierz CSV"
      >
        {isCsvLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        CSV
      </Button>
    </>
  )
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/transfers/transfer-export-toolbar.tsx
git commit -m "feat: client-side print via iframe instead of server page"
```

---

### Task 6: Delete `(print)` route group and `PrintTrigger`

**Files:**
- Delete: `src/app/(print)/layout.tsx`
- Delete: `src/app/(print)/drukuj/transfery/page.tsx`
- Delete: `src/components/transfers/print-trigger.tsx`

**Step 1: Verify no other imports reference these files**

Run: `grep -r "print-trigger\|/(print)\|/drukuj" src/ --include="*.tsx" --include="*.ts" -l`

Expected: Only the files being deleted (no other consumers).

**Step 2: Delete the files**

```bash
rm -rf src/app/\(print\)
rm src/components/transfers/print-trigger.tsx
```

**Step 3: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: Both PASS — no remaining references to deleted files.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove server-rendered print page and PrintTrigger"
```

---

### Task 7: Manual verification

**Steps:**
1. `pnpm dev` — start dev server
2. Navigate to an investment detail page → click "Drukuj"
   - Expected: Loading spinner on button → browser print dialog opens with header fields + transfer table
3. Navigate to a cash register detail page → click "Drukuj"
   - Expected: Same behavior, register-specific header fields (name, owner, balance)
4. Navigate to a worker page → click "Drukuj"
   - Expected: Same behavior, worker-specific header fields (name, saldo)
5. Dashboard → verify no print button appears (no context/contextId)
6. Test CSV still works on all pages
7. Verify cancelled rows show strikethrough in print preview
