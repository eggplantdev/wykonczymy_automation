import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { getPayoutTransactionsForInvestment } from '@/lib/db/sum-transfers'

// The client DataTable re-sorts these rows lexically on the emitted `date` string, so that string MUST
// be lexically == chronologically ordered or the „Wg daty" sort scrambles. The driver returns timestamptz
// as a year-first string ("2026-07-18 09:00:00+00"), which satisfies this — the regression this guards is
// a future remap to a non-sortable form (a dd.mm.yyyy reformat, or a JS-Date `.toString()` = "Thu Jul 16
// …"). Insert rows directly to bypass the balance-recalc hooks; we assert the query's mapped output.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('getPayoutTransactionsForInvestment (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  // Three PAYOUTs on distinct weekdays whose weekday-alphabetical order differs from their chronological
  // order, so a weekday-first date string would sort them wrong: 2026-07-13 Mon, 07-15 Wed, 07-18 Sat.
  const DATES = ['2026-07-13T09:00:00Z', '2026-07-15T09:00:00Z', '2026-07-18T09:00:00Z']

  async function insertPayout(dateIso: string): Promise<void> {
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, worker_id, cancelled)
      VALUES ('test', 100, ${dateIso}::timestamptz, 'PAYOUT'::enum_transactions_type, 'TRANSFER',
        ${investmentId}, NULL, false)
    `)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const inv = await payload.create({
      collection: 'investments',
      data: { name: 'get-payout-transactions-test', status: 'active' },
      context: { skipRevalidation: true },
    })
    investmentId = Number(inv.id)

    for (const date of DATES) await insertPayout(date)
  })

  afterAll(async () => {
    if (investmentId) {
      await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${investmentId}`)
      await payload.delete({
        collection: 'investments',
        id: investmentId,
        context: { skipRevalidation: true },
      })
    }
  })

  it('emits year-first date strings that sort lexically in chronological order', async () => {
    const rows = await getPayoutTransactionsForInvestment(payload, investmentId)
    expect(rows).toHaveLength(3)

    // Year-first prefix ("2026-07-18…") — the property that makes a plain string lexical sort chronological.
    for (const row of rows) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}[ T]/)
    }

    // The query returns date DESC; re-sorting the emitted strings lexically desc — exactly what the client
    // DataTable does for „Wg daty" — must reproduce that chronological order, not scramble it.
    const lexicalDesc = [...rows].sort((first, second) => second.date.localeCompare(first.date))
    expect(lexicalDesc.map((row) => row.date)).toEqual(rows.map((row) => row.date))
    expect(rows.map((row) => row.date.slice(0, 10))).toEqual([
      '2026-07-18',
      '2026-07-15',
      '2026-07-13',
    ])
  })
})
