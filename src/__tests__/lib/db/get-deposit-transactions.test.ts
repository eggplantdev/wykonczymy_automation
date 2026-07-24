import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { getDepositTransactionsForInvestment } from '@/lib/db/sum-transfers'

// Regression guard for the Podsumowanie „Wpłaty"/„Do zapłaty" base (code-review WARNING, 2026-07-24):
// the client wpłaty figure sums THIS query, which must stay INVESTOR_DEPOSIT-only. COMPANY_FUNDING
// („zasilenie z konta firmowego") and OTHER_DEPOSIT are legacy deposit types that raise Bilans
// inwestora but must never enter the client-facing wpłaty — a revert to the plane-blind `totalIncome`
// would silently fold them back in. Insert rows directly to bypass the balance-recalc hooks.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('getDepositTransactionsForInvestment (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  async function insertDeposit(opts: {
    type: 'INVESTOR_DEPOSIT' | 'COMPANY_FUNDING' | 'OTHER_DEPOSIT'
    amount: number
    vatPlane?: 'NET' | 'GROSS'
    cancelled?: boolean
  }): Promise<void> {
    const vatPlane = opts.vatPlane ?? null
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, vat_plane, cancelled)
      VALUES ('test', ${opts.amount}, '2026-07-18T09:00:00Z'::timestamptz,
        ${opts.type}::enum_transactions_type, 'TRANSFER', ${investmentId},
        ${vatPlane}::enum_transactions_vat_plane, ${opts.cancelled ?? false})
    `)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const inv = await payload.create({
      collection: 'investments',
      data: { name: 'get-deposit-transactions-test', status: 'active' },
      context: { skipRevalidation: true },
    })
    investmentId = Number(inv.id)

    // Two active INVESTOR_DEPOSITs (one plane-marked, one legacy-null) — the only rows the client
    // wpłaty base may include. Then the noise the query must reject: a cancelled INVESTOR_DEPOSIT,
    // a COMPANY_FUNDING, and an OTHER_DEPOSIT.
    await insertDeposit({ type: 'INVESTOR_DEPOSIT', amount: 5000, vatPlane: 'GROSS' })
    await insertDeposit({ type: 'INVESTOR_DEPOSIT', amount: 3000 })
    await insertDeposit({ type: 'INVESTOR_DEPOSIT', amount: 999, cancelled: true })
    await insertDeposit({ type: 'COMPANY_FUNDING', amount: 7000 })
    await insertDeposit({ type: 'OTHER_DEPOSIT', amount: 1000 })
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

  it('returns only non-cancelled INVESTOR_DEPOSIT rows — legacy planes never enter client wpłaty', async () => {
    const rows = await getDepositTransactionsForInvestment(payload, investmentId)

    // The two active INVESTOR_DEPOSITs only — cancelled, COMPANY_FUNDING, OTHER_DEPOSIT all excluded.
    expect(rows).toHaveLength(2)

    // The Σ the Podsumowanie „Wpłaty" figure sums: 5000 + 3000, NOT +7000 (company) or +1000 (other).
    const wplatyNet = rows.reduce((sum, row) => sum + row.amount, 0)
    expect(wplatyNet).toBe(8000)

    // vat_plane survives per row (GROSS marked, legacy null) for the tryb-mieszany split.
    expect([...rows].map((row) => row.vatPlane).sort()).toEqual(['GROSS', null])
  })
})
