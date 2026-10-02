import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { getPayoutTransactionsForInvestment } from '@/lib/db/get-payout-transactions'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The client DataTable re-sorts these rows lexically on the emitted `date` string, so that string MUST
// be lexically == chronologically ordered or the „Wg daty" sort scrambles. The driver returns timestamptz
// as a year-first string ("2026-07-18 09:00:00+00"), which satisfies this — the regression this guards is
// a future remap to a non-sortable form (a dd.mm.yyyy reformat, or a JS-Date `.toString()` = "Thu Jul 16
// …"). Insert rows directly to bypass the balance-recalc hooks; we assert the query's mapped output.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('getPayoutTransactionsForInvestment (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number

  // Three PAYOUTs on distinct weekdays whose weekday-alphabetical order differs from their chronological
  // order, so a weekday-first date string would sort them wrong: 2026-07-13 Mon, 07-15 Wed, 07-18 Sat.
  const DATES = ['2026-07-13T09:00:00Z', '2026-07-15T09:00:00Z', '2026-07-18T09:00:00Z']

  async function insertTx(opts: {
    date: string
    type?: string
    investmentId: number
    cancelled?: boolean
    amount?: number
  }): Promise<void> {
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, worker_id, cancelled)
      VALUES ('test', ${opts.amount ?? 100}, ${opts.date}::timestamptz,
        ${opts.type ?? 'PAYOUT'}::enum_transactions_type, 'TRANSFER', ${opts.investmentId}, NULL,
        ${opts.cancelled ?? false})
    `)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'get-payout-transactions-test')
    otherInvestmentId = await createTestInvestment(payload, 'get-payout-transactions-other')

    for (const date of DATES) await insertTx({ date, investmentId })
    // Each must be excluded by a different predicate in the WHERE; 999 marks them so a leak is
    // visible in the amounts, not only in the row count.
    await insertTx({ date: DATES[0], investmentId, cancelled: true, amount: 999 })
    await insertTx({ date: DATES[0], investmentId, type: 'INVESTMENT_EXPENSE', amount: 999 })
    await insertTx({ date: DATES[0], investmentId: otherInvestmentId, amount: 999 })
    await insertTx({ date: DATES[1], investmentId, type: 'BONUS', amount: 250 })
    await insertTx({ date: DATES[1], investmentId, type: 'BONUS', cancelled: true, amount: 999 })
  })

  afterAll(async () => {
    for (const id of [investmentId, otherInvestmentId]) {
      if (id) await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${id}`)
    }
    for (const id of [investmentId, otherInvestmentId]) {
      if (id) await deleteTestInvestment(payload, id)
    }
  })

  // This WHERE feeds BOTH the wypłaty list and, summed off the same rows, „Pozostało do wypłaty" —
  // so a dropped predicate moves money on two surfaces at once, and nothing else asserts it.
  it('excludes cancelled rows, other types and other investments’ payouts', async () => {
    const rows = await getPayoutTransactionsForInvestment(payload, investmentId)

    expect(rows).toHaveLength(4)
    expect(rows.map((row) => row.amount)).not.toContain(999)
  })

  // A premia rides the same read as the wypłaty, so its type is what keeps it out of „Wypłacone".
  it('tags each row with its type, so a premia never sums as a wypłata', async () => {
    const rows = await getPayoutTransactionsForInvestment(payload, investmentId)

    expect(rows.filter((row) => row.type === 'PAYOUT')).toHaveLength(3)
    expect(rows.filter((row) => row.type === 'BONUS').map((row) => row.amount)).toEqual([250])
  })

  it('emits year-first date strings that sort lexically in chronological order', async () => {
    const rows = (await getPayoutTransactionsForInvestment(payload, investmentId)).filter(
      (row) => row.type === 'PAYOUT',
    )
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
