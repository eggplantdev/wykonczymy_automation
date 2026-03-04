# PDF Export Design

## Context

The app has two export paths: **Print** (opens `/drukuj/transfery` page, browser print dialog) and **CSV** (client-side download). The user wants a third path: **PDF download** that produces the same content as the print page — header fields + transfer table — as a downloadable PDF file.

## Constraints

- Deployed on **Vercel** (serverless, 50MB bundle limit)
- No existing PDF libraries installed

## Decision: jsPDF + jspdf-autotable (client-side)

Chosen over:

- `@sparticuz/chromium` + puppeteer-core — too heavy for Vercel (~45MB, slow cold starts)
- `@react-pdf/renderer` — separate layout DSL to maintain

jsPDF + autotable is ~300KB, runs in the browser, reuses the existing `fetchFilteredTransfers` data pipeline.

## Data Flow

```
User clicks 'PDF' button in TransferExportToolbar
  -> calls fetchPdfData(serializedWhere, context, contextId) [server action]
  -> server returns { rows: TransferRowT[], headerFields: HeaderFieldT[] }
  -> client builds PDF with jsPDF + jspdf-autotable
  -> triggerDownload(blob, 'transfery-YYYY-MM-DD.pdf')
```

Single server round-trip returns both rows and header fields.

## Files

### New

| File                              | Purpose                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `src/lib/export/pdf.ts`           | `buildTransferPdf(rows, columns, headerFields)` — builds PDF blob                      |
| `src/lib/export/header-fields.ts` | Extracted `buildHeaderFields()` from print page — shared by print page + server action |

### Modified

| File                                                   | Change                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `src/lib/actions/export.ts`                            | Add `fetchPdfData` server action returning `{ rows, headerFields }` |
| `src/components/transfers/transfer-export-toolbar.tsx` | Add PDF button + `handlePdf` handler                                |
| `src/app/(print)/drukuj/transfery/page.tsx`            | Import `buildHeaderFields` from shared module                       |

### Dependencies

`jspdf` + `jspdf-autotable`

## PDF Layout

1. Header fields as key-value text at top (e.g., "Inwestycja: Osiedle Sloneczne")
2. Table via jspdf-autotable using `TRANSFER_EXPORT_COLUMNS` (same labels/getValue as CSV and print)
3. A4 landscape orientation
4. Cancelled rows rendered in lighter gray
