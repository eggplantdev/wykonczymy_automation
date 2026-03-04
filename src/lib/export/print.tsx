import { renderToStaticMarkup } from 'react-dom/server'
import { TRANSFER_EXPORT_COLUMNS } from '@/lib/export/transfer-columns'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { HeaderFieldT } from '@/types/export'

const PRINT_STYLES = `
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
`

type ColumnT = {
  readonly id: string
  readonly label: string
  readonly getValue: (row: TransferRowT) => string
}

function HeaderFields({ fields }: { readonly fields: HeaderFieldT[] }) {
  if (fields.length === 0) return null

  return (
    <div className="fields">
      {fields.map((f) => (
        <div key={f.label}>
          <span className="label">{f.label}: </span>
          <span className="value">{f.value}</span>
        </div>
      ))}
    </div>
  )
}

function TransferTable({
  rows,
  columns,
}: {
  readonly rows: TransferRowT[]
  readonly columns: ColumnT[]
}) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.id}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={row.cancelled ? 'cancelled' : undefined}>
            {columns.map((c) => (
              <td key={c.id}>{c.getValue(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PrintDocument({
  title,
  headerFields,
  rows,
  columns,
}: {
  readonly title: string
  readonly headerFields: HeaderFieldT[]
  readonly rows: TransferRowT[]
  readonly columns: ColumnT[]
}) {
  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      </head>
      <body>
        <HeaderFields fields={headerFields} />
        <TransferTable rows={rows} columns={columns} />
      </body>
    </html>
  )
}

function resolveColumns(visibleColumnIds: string[]): ColumnT[] {
  return visibleColumnIds
    .filter((id) => TRANSFER_EXPORT_COLUMNS[id])
    .map((id) => ({ id, ...TRANSFER_EXPORT_COLUMNS[id]! }))
}

export function buildPrintHtml(
  rows: TransferRowT[],
  visibleColumnIds: string[],
  headerFields: HeaderFieldT[],
  title = 'Transfery',
): string {
  const columns = resolveColumns(visibleColumnIds)
  const markup = renderToStaticMarkup(
    <PrintDocument title={title} headerFields={headerFields} rows={rows} columns={columns} />,
  )

  return `<!DOCTYPE html>${markup}`
}
