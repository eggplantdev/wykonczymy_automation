import { sql } from '@payloadcms/db-vercel-postgres'
import type { TelmakAppRowT } from '@/lib/telmak/compare-telmak'
import type { DbExecutorT } from './get-db'
import { normalizedNumber, noteLine1 } from './document-number-sql'
import { transactionInvoicesJson } from './media-json'
import { inList } from './sql-list'

// Mirrors `normalizeDocNumber(firstNoteLine(note))`, so a number matches in SQL when it would match
// in the browser.
const NOTE_NUMBER = normalizedNumber(noteLine1(sql`t.invoice_note`))

// The month of slack: a document is booked up to ~4 weeks after it was issued, and the issue date
// only lives in the description.
export async function loadTelmakCheckRows(
  db: DbExecutorT,
  {
    registerId,
    from,
    to,
    numbers,
  }: { registerId: number; from: string; to: string; numbers: string[] },
): Promise<TelmakAppRowT[]> {
  const byNumber = inList(NOTE_NUMBER, numbers) ?? sql`false`

  const { rows } = await db.execute(sql`
    SELECT t.id, t.amount, t.description, t.invoice_note, t.cancelled,
           t.source_register_id, cr.name AS register_name, i.name AS investment_name,
           ${transactionInvoicesJson(sql`t.id`)} AS invoices
    FROM transactions t
    LEFT JOIN cash_registers cr ON cr.id = t.source_register_id
    LEFT JOIN investments i ON i.id = t.investment_id
    WHERE t.type <> 'CANCELLATION'
      AND (
        (t.source_register_id = ${registerId}
          AND t.date >= ${from}::date - interval '1 month'
          AND t.date < ${to}::date + interval '1 month 1 day')
        OR ${byNumber}
      )
    ORDER BY t.id
  `)

  return rows.map((r) => ({
    id: Number(r.id),
    amount: Number(r.amount),
    description: (r.description as string | null) ?? '',
    invoiceNote: (r.invoice_note as string | null) ?? '',
    cancelled: r.cancelled === true,
    registerId: r.source_register_id == null ? null : Number(r.source_register_id),
    registerName: (r.register_name as string | null) ?? null,
    investmentName: (r.investment_name as string | null) ?? null,
    invoices: r.invoices as TelmakAppRowT['invoices'],
  }))
}
