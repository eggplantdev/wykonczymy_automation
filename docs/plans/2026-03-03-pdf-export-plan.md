# PDF Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "PDF" download button to the transfer export toolbar that generates a PDF matching the print page content (header fields + transfer table).

**Architecture:** Client-side PDF generation via jsPDF + jspdf-autotable. A new server action `fetchPdfExportData` returns both transfer rows and header fields in one round-trip. The existing `buildHeaderFields` function is extracted from the print page into a shared module. The PDF builder reuses `TRANSFER_EXPORT_COLUMNS` for column labels/values.

**Tech Stack:** jspdf, jspdf-autotable, existing TRANSFER_EXPORT_COLUMNS config

---

### Task 1: Install dependencies

**Step 1: Install jspdf and jspdf-autotable**

Run: `pnpm add jspdf jspdf-autotable`

**Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add jspdf and jspdf-autotable for PDF export"
```

---

### Task 2: Extract buildHeaderFields into shared module

**Files:**

- Create: `src/lib/export/header-fields.ts`
- Modify: `src/app/(print)/drukuj/transfery/page.tsx`

The print page currently defines `buildHeaderFields` locally (lines 125-186). Extract it to a shared module so both the print page and the new server action can use it.

**Step 1: Create `src/lib/export/header-fields.ts`**

```ts
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import type { RoleT } from '@/lib/auth/roles'
import {
  fetchReferenceData,
  fetchInvestmentFinancials,
  fetchRegisterBalances,
  fetchWorkerSaldos,
} from '@/lib/queries/reference-data'
import { formatPLN } from '@/lib/format-currency'
import type { ExportContextT, HeaderFieldT } from '@/types/export'

/** Builds context-specific header fields (stats) for export/print views. */
export async function buildHeaderFields(
  context: ExportContextT,
  contextId: number,
  refData: Awaited<ReturnType<typeof fetchReferenceData>>,
  userRole: RoleT,
): Promise<HeaderFieldT[]> {
  switch (context) {
    case 'investment': {
      const investment = refData.investments.find((inv) => inv.id === contextId)
      if (!investment) return []

      const fields: HeaderFieldT[] = [{ label: 'Inwestycja', value: investment.name }]

      if (isAdminOrOwnerRole(userRole)) {
        const financials = await fetchInvestmentFinancials()
        const fin = financials[String(contextId)]
        const totalCosts = fin?.totalCosts ?? 0
        const totalIncome = fin?.totalIncome ?? 0
        const laborCosts = investment.laborCosts ?? 0

        fields.push(
          { label: 'Koszty inwestycji', value: formatPLN(totalCosts) },
          { label: 'Wpłaty od inwestora', value: formatPLN(totalIncome) },
          { label: 'Koszty robocizny', value: formatPLN(laborCosts) },
          { label: 'Bilans', value: formatPLN(totalIncome - totalCosts - laborCosts) },
        )
      }

      return fields
    }

    case 'register': {
      const register = refData.cashRegisters.find((cr) => cr.id === contextId)
      if (!register) return []

      const balances = await fetchRegisterBalances()
      const balance = balances[String(contextId)] ?? 0
      const ownerName = register.ownerId
        ? (refData.workers.find((w) => w.id === register.ownerId)?.name ?? '—')
        : '—'

      return [
        { label: 'Kasa', value: register.name },
        { label: 'Właściciel', value: ownerName },
        { label: 'Saldo', value: formatPLN(balance) },
      ]
    }

    case 'worker': {
      const worker = refData.workers.find((w) => w.id === contextId)
      if (!worker) return []

      const saldos = await fetchWorkerSaldos()
      const saldo = saldos[String(contextId)] ?? 0

      return [
        { label: 'Pracownik', value: worker.name },
        { label: 'Saldo', value: formatPLN(saldo) },
      ]
    }
  }
}
```

**Step 2: Update the print page to import from shared module**

In `src/app/(print)/drukuj/transfery/page.tsx`:

- Remove the local `buildHeaderFields` function (lines 125-186)
- Remove now-unused imports: `isAdminOrOwnerRole`, `type RoleT`, `fetchInvestmentFinancials`, `fetchRegisterBalances`, `fetchWorkerSaldos`, `formatPLN`
- Add import: `import { buildHeaderFields } from '@/lib/export/header-fields'`

The print page should still import `fetchReferenceData` (used for the `refData` variable passed to `buildHeaderFields`).

**Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: Same pre-existing errors only (settlement-actions.test.ts)

**Step 4: Commit**

```bash
git add src/lib/export/header-fields.ts src/app/(print)/drukuj/transfery/page.tsx
git commit -m "refactor: extract buildHeaderFields into shared module"
```

---

### Task 3: Add fetchPdfExportData server action

**Files:**

- Modify: `src/lib/actions/export.ts`

**Step 1: Add the server action**

Append to `src/lib/actions/export.ts`:

```ts
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { buildHeaderFields } from '@/lib/export/header-fields'
import type { ExportContextT, HeaderFieldT } from '@/types/export'

type PdfExportDataT = {
  readonly rows: TransferRowT[]
  readonly headerFields: HeaderFieldT[]
}

export async function fetchPdfExportData(
  serializedWhere: string,
  context: ExportContextT,
  contextId: number,
): Promise<ActionResultT<PdfExportDataT>> {
  const elapsed = perfStart()

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const where: Where = JSON.parse(serializedWhere)
    const [rows, refData] = await Promise.all([fetchAllTransferRows(where), fetchReferenceData()])
    const headerFields = await buildHeaderFields(context, contextId, refData, session.user.role)

    console.log(`[PERF] fetchPdfExportData ${elapsed()}ms (${rows.length} rows)`)
    return { success: true, data: { rows, headerFields } }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
```

Note: `fetchReferenceData` import may already exist — deduplicate if so. The existing imports for `Where`, `requireAuth`, `MANAGEMENT_ROLES`, `fetchAllTransferRows`, `ActionResultT`, `getErrorMessage`, `perfStart` are already in the file.

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`

**Step 3: Commit**

```bash
git add src/lib/actions/export.ts
git commit -m "feat: add fetchPdfExportData server action"
```

---

### Task 4: Create PDF builder

**Files:**

- Create: `src/lib/export/pdf.ts`

**Step 1: Create the PDF builder**

```ts
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { TRANSFER_EXPORT_COLUMNS, EXPORT_EXCLUDED_COLUMNS } from '@/lib/export/transfer-columns'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { HeaderFieldT } from '@/types/export'

/** Builds a PDF blob from transfer rows, visible columns, and header fields. */
export function buildTransferPdf(
  rows: readonly TransferRowT[],
  visibleColumnIds: string[],
  headerFields: readonly HeaderFieldT[],
): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const columns = visibleColumnIds
    .filter((id) => !EXPORT_EXCLUDED_COLUMNS.has(id) && TRANSFER_EXPORT_COLUMNS[id])
    .map((id) => ({ id, ...TRANSFER_EXPORT_COLUMNS[id]! }))

  let startY = 15

  // Header fields
  if (headerFields.length > 0) {
    doc.setFontSize(10)
    for (const field of headerFields) {
      doc.setFont('helvetica', 'normal')
      doc.text(`${field.label}: `, 14, startY)
      const labelWidth = doc.getTextWidth(`${field.label}: `)
      doc.setFont('helvetica', 'bold')
      doc.text(field.value, 14 + labelWidth, startY)
      startY += 5
    }
    startY += 3
  }

  // Table
  autoTable(doc, {
    startY,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => c.getValue(row))),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    bodyStyles: { textColor: [30, 30, 30] },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const row = rows[data.row.index]
        if (row?.cancelled) {
          data.cell.styles.textColor = [160, 160, 160]
        }
      }
    },
  })

  return doc.output('blob')
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`

**Step 3: Commit**

```bash
git add src/lib/export/pdf.ts
git commit -m "feat: add PDF builder using jsPDF + autotable"
```

---

### Task 5: Add PDF button to export toolbar

**Files:**

- Modify: `src/components/transfers/transfer-export-toolbar.tsx`

**Step 1: Add PDF handler and button**

Changes to `transfer-export-toolbar.tsx`:

1. Add imports:

   ```ts
   import { FileText } from 'lucide-react'
   import { fetchPdfExportData } from '@/lib/actions/export'
   import { buildTransferPdf } from '@/lib/export/pdf'
   ```

2. Add state for PDF loading (next to existing `isCsvLoading`):

   ```ts
   const [isPdfLoading, setIsPdfLoading] = useState(false)
   ```

3. Add `handlePdf` callback (next to `handleCsv`):

   ```ts
   const handlePdf = useCallback(async () => {
     setIsPdfLoading(true)
     try {
       const result = await fetchPdfExportData(serializedWhere, context, contextId)
       if (!result.success) {
         console.error('PDF export failed:', result.error)
         return
       }
       const blob = buildTransferPdf(result.data.rows, visibleColumnIds, result.data.headerFields)
       const date = new Date().toISOString().slice(0, 10)
       triggerDownload(blob, `transfery-${date}.pdf`)
     } finally {
       setIsPdfLoading(false)
     }
   }, [serializedWhere, visibleColumnIds, context, contextId])
   ```

4. Add PDF button in JSX (between Print and CSV buttons):
   ```tsx
   <Button
     variant="outline"
     size="sm"
     className="gap-1.5"
     onClick={handlePdf}
     disabled={isPdfLoading}
     aria-label="Pobierz PDF"
   >
     {isPdfLoading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
     PDF
   </Button>
   ```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`

**Step 3: Verify lint passes**

Run: `pnpm lint`

**Step 4: Commit**

```bash
git add src/components/transfers/transfer-export-toolbar.tsx
git commit -m "feat: add PDF download button to transfer export toolbar"
```

---

### Task 6: Manual verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test PDF download from each context**

1. Go to an investment detail page (`/inwestycje/[id]`) → click PDF → verify download with header fields + table
2. Go to a cash register page (`/kasa/[id]`) → click PDF → verify download
3. Go to a worker page (`/uzytkownicy/[id]`) → click PDF → verify download

**Step 3: Compare PDF vs print page**

Open the print page side-by-side with the downloaded PDF. Verify:

- Same header fields appear
- Same columns visible
- Cancelled rows appear lighter
- Table data matches

**Step 4: Test column visibility**

Toggle some columns off in the table → click PDF → verify only visible columns appear in PDF.
