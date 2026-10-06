import { sql } from '@payloadcms/db-vercel-postgres'
import type { TelmakAppRowT } from '@/lib/telmak/compare-telmak'
import type { DbExecutorT } from './get-db'
import { inList } from './sql-list'

// Mirrors `normalizeDocNumber(firstNoteLine(note))`, so a number matches in SQL when it would match
// in the browser.
const NOTE_NUMBER = sql`upper(regexp_replace(split_part(btrim(t.invoice_note, E' \t\r\n'), E'\n', 1), '\\s', '', 'g'))`

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
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', m.id, 'url', m.url, 'filename', m.filename, 'mimeType', m.mime_type
             ) ORDER BY r."order")
             FROM transactions_rels r JOIN media m ON m.id = r.media_id
             WHERE r.parent_id = t.id AND r.path = 'invoice' AND m.url IS NOT NULL
           ), '[]'::json) AS invoices
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
