import { describe, it, expect, beforeEach } from 'vitest'
import type { Where } from 'payload'
import {
  buildPayoutFilters,
  buildTransferFilters,
  narrowToTransferIds,
  scopeAuditThroughOriginal,
  scopeNarrowsByOriginalOnlyField,
  stripCancelledFilters,
  stripOriginalScopedFilters,
  withDateRange,
} from '@/lib/queries/transfer-filters'
import { sumFilteredByType } from '@/lib/db/sum-transfers'
import { buildSqlConditions } from '@/lib/db/where-to-sql'
import { buildWorkerTransferWhere, workerTransferScope } from '@/lib/queries/worker-transfers'
import { fakePayload, lastSql, resetFakePayload } from '@/__tests__/helpers/fake-payload-sql'

/**
 * Assert the EMITTED SQL, never the intermediate Where: a Where-shape assertion stays green
 * when the translator silently drops an operator (EX-574).
 */

beforeEach(resetFakePayload)

async function sqlForSearchParams(searchParams: Record<string, string>): Promise<string> {
  const where = buildTransferFilters(searchParams, { id: 1 })
  await sumFilteredByType(fakePayload, stripCancelledFilters(where))
  return lastSql()
}

describe('transfer filters → stats SQL', () => {
  it('excludes CANCELLATION rows from the default view', async () => {
    expect(await sqlForSearchParams({})).toContain("type NOT IN ('CANCELLATION')")
  })

  it('keeps a user-selected type filter', async () => {
    expect(await sqlForSearchParams({ type: 'PAYOUT,OTHER' })).toContain(
      "type IN ('PAYOUT', 'OTHER')",
    )
  })

  it('applies no type condition when cancelled rows are shown', async () => {
    const sql = await sqlForSearchParams({ showCancelled: '1' })
    expect(sql).not.toContain('AND type')
  })

  it('keeps audit mode restricted to CANCELLATION rows', async () => {
    expect(await sqlForSearchParams({ cancelledTransactionAudit: '1' })).toContain(
      "type IN ('CANCELLATION')",
    )
  })

  it('applies both ends of an amount range', async () => {
    const sql = await sqlForSearchParams({ amount: '500,00' })
    expect(sql).toContain('amount >= 500')
    expect(sql).toContain('amount < 500.01')
  })

  it('applies a prefix amount search as a text LIKE', async () => {
    expect(await sqlForSearchParams({ amount: '500' })).toContain("amount::text LIKE '500'")
  })

  it('applies an id search', async () => {
    expect(await sqlForSearchParams({ id: '42' })).toContain('id = 42')
  })

  it('applies both ends of a date range', async () => {
    const sql = await sqlForSearchParams({ from: '2026-03-01', to: '2026-03-31' })
    expect(sql).toContain("date >= '2026-03-01'")
    expect(sql).toContain("date <= '2026-03-31'")
  })

  it('applies a worker search', async () => {
    expect(await sqlForSearchParams({ worker: '5' })).toContain('worker_id IN (5)')
  })

  it('applies a multi-worker search', async () => {
    expect(await sqlForSearchParams({ worker: '3,7' })).toContain('worker_id IN (3, 7)')
  })

  it('applies a payout status search', async () => {
    expect(await sqlForSearchParams({ payoutStatus: 'rejected,pending' })).toContain(
      "payout_status IN ('rejected', 'pending')",
    )
  })

  it('empties the list when the status select names nothing valid', () => {
    expect(buildTransferFilters({ payoutStatus: '__none__' }, { id: 1 }).id).toEqual({ equals: -1 })
  })

  it('matches a cash register on either side of the transfer', async () => {
    expect(await sqlForSearchParams({ sourceRegister: '3,5' })).toContain(
      '(source_register_id IN (3, 5) OR target_register_id IN (3, 5))',
    )
  })
})

describe('worker transfer scope → stats SQL', () => {
  async function workerSql(searchParams: Record<string, string>): Promise<string> {
    const where = buildWorkerTransferWhere(
      buildTransferFilters(searchParams, { id: 1 }),
      workerTransferScope(25, [37]),
    )
    await sumFilteredByType(fakePayload, stripCancelledFilters(where))
    return lastSql()
  }

  const SCOPE_SQL = '((worker_id = 25 OR source_register_id IN (37) OR target_register_id IN (37)))'

  it('applies the scope with no URL filter', async () => {
    const sql = await workerSql({})
    expect(sql).toContain(SCOPE_SQL)
    expect(sql).toContain("type NOT IN ('CANCELLATION')")
  })

  it('ANDs a foreign kasa filter with the scope instead of replacing it', async () => {
    const sql = await workerSql({ sourceRegister: '99' })
    expect(sql).toContain(
      '(source_register_id IN (99) OR target_register_id IN (99)) AND (worker_id = 25 OR source_register_id IN (37) OR target_register_id IN (37))',
    )
  })

  // The list goes through Payload, whose parseParams keeps only the LAST of a top-level `or` and
  // `and`.
  it('never leaves the kasa filter as a top-level `or` beside the scope', () => {
    const where = buildWorkerTransferWhere(
      buildTransferFilters({ sourceRegister: '99' }, { id: 1 }),
      workerTransferScope(25, [37]),
    )
    expect(where.or).toBeUndefined()
  })
})

/**
 * The audit list is the one path that does NOT go through where-to-sql: it is handed to Payload,
 * which resolves the dotted relationship path itself.
 */
describe('audit mode → scope through the cancelled original', () => {
  const auditWhere = (extra: Where) =>
    scopeAuditThroughOriginal({
      ...buildTransferFilters({ cancelledTransactionAudit: '1' }, { id: 1 }),
      ...extra,
    })

  it('re-aims a kasa scope at both sides of the original transfer', () => {
    const where = auditWhere({
      or: [{ sourceRegister: { equals: 7 } }, { targetRegister: { equals: 7 } }],
    })

    expect(where.or).toEqual([
      { 'cancelledTransaction.sourceRegister': { equals: 7 } },
      { 'cancelledTransaction.targetRegister': { equals: 7 } },
    ])
  })

  it('re-aims an inwestycja and a pracownik scope the same way', () => {
    expect(auditWhere({ investment: { equals: 31 } })).toMatchObject({
      'cancelledTransaction.investment': { equals: 31 },
    })
    expect(auditWhere({ worker: { equals: 25 } })).toMatchObject({
      'cancelledTransaction.worker': { equals: 25 },
    })
  })

  it('re-aims a metoda scope at the original', () => {
    expect(auditWhere({ paymentMethod: { in: ['TRANSFER'] } })).toMatchObject({
      'cancelledTransaction.paymentMethod': { in: ['TRANSFER'] },
    })
  })

  it('leaves what the audit row itself carries alone', () => {
    const where = auditWhere({ date: { greater_than_equal: '2026-08-01' }, createdBy: { in: [3] } })

    expect(where.type).toEqual({ in: ['CANCELLATION'] })
    expect(where.date).toEqual({ greater_than_equal: '2026-08-01' })
    expect(where.createdBy).toEqual({ in: [3] })
  })

  it('re-aims a Typ scope at the transaction that was cancelled', () => {
    const where = buildTransferFilters(
      { cancelledTransactionAudit: '1', type: 'INVESTMENT_EXPENSE,PAYOUT' },
      { id: 1 },
    )

    expect(where.type).toEqual({ in: ['CANCELLATION'] })
    expect(where['cancelledTransaction.type']).toEqual({ in: ['INVESTMENT_EXPENSE', 'PAYOUT'] })
  })

  it('empties the list when the Typ select names nothing valid', () => {
    expect(
      buildTransferFilters({ cancelledTransactionAudit: '1', type: '__none__' }, { id: 1 }).id,
    ).toEqual({ equals: -1 })
  })

  it('drops the sum tile once Typ narrows through the original', () => {
    expect(
      scopeNarrowsByOriginalOnlyField(
        buildTransferFilters({ cancelledTransactionAudit: '1', type: 'PAYOUT' }, { id: 1 }),
      ),
    ).toBe(true)
  })

  // A page that builds its own tiles from the list's Where would otherwise hand where-to-sql a
  // relation path and crash on render.
  it('is dropped from a stats where rather than reaching the SQL translator', () => {
    const where = buildTransferFilters(
      { cancelledTransactionAudit: '1', type: 'PAYOUT' },
      { id: 1 },
    )

    expect(() => buildSqlConditions(where)).toThrow(/unmapped field/)
    expect(() => buildSqlConditions(stripOriginalScopedFilters(where))).not.toThrow()
  })

  it('changes nothing on the unscoped list, which already worked', () => {
    const plain = buildTransferFilters({ cancelledTransactionAudit: '1' }, { id: 1 })

    expect(scopeAuditThroughOriginal(plain)).toEqual(plain)
  })

  it('recurses into `and` as well as `or`', () => {
    const where = scopeAuditThroughOriginal({
      and: [{ investment: { equals: 31 } }, { or: [{ worker: { equals: 25 } }] }],
    })

    expect(where.and).toEqual([
      { 'cancelledTransaction.investment': { equals: 31 } },
      { or: [{ 'cancelledTransaction.worker': { equals: 25 } }] },
    ])
  })

  it('produces a where the stats SQL translator refuses', () => {
    expect(() => buildSqlConditions(auditWhere({ investment: { equals: 31 } }))).toThrow(
      /unmapped field/,
    )
  })
})

describe('buildPayoutFilters', () => {
  it('keeps the list on wypłaty whatever Typ the URL carries', () => {
    expect(buildPayoutFilters({ type: 'DEPOSIT' }, { id: 1 }).type).toEqual({ in: ['PAYOUT'] })
  })

  it('lists only the anulowania of wypłaty in audit mode', () => {
    const where = buildPayoutFilters({ cancelledTransactionAudit: '1' }, { id: 1 })

    expect(where.type).toEqual({ in: ['CANCELLATION'] })
    expect(where['cancelledTransaction.type']).toEqual({ in: ['PAYOUT'] })
  })
})

// The tile cannot be re-aimed the way the list is, so the caller drops it rather than render 0,00 zł
// beside a list full of rows.
describe('scopeNarrowsByOriginalOnlyField', () => {
  it('is true for a field only the original carries, at any nesting depth', () => {
    expect(scopeNarrowsByOriginalOnlyField({ investment: { equals: 31 } })).toBe(true)
    expect(
      scopeNarrowsByOriginalOnlyField({
        or: [{ sourceRegister: { equals: 7 } }, { targetRegister: { equals: 7 } }],
      }),
    ).toBe(true)
    expect(scopeNarrowsByOriginalOnlyField({ and: [{ or: [{ worker: { equals: 25 } }] }] })).toBe(
      true,
    )
  })

  it('is false for a scope the audit row itself carries, so the tile stays', () => {
    expect(
      scopeNarrowsByOriginalOnlyField(
        buildTransferFilters({ cancelledTransactionAudit: '1' }, { id: 1 }),
      ),
    ).toBe(false)
    expect(
      scopeNarrowsByOriginalOnlyField({
        date: { greater_than_equal: '2026-08-01' },
        createdBy: { in: [3] },
      }),
    ).toBe(false)
  })
})

describe('withDateRange → stats SQL', () => {
  const SEPTEMBER = { from: '2026-09-01', to: '2026-09-30' }

  async function sqlFor(where: Where): Promise<string> {
    await sumFilteredByType(fakePayload, stripCancelledFilters(where))
    return lastSql()
  }

  it('replaces the table window instead of intersecting with it', async () => {
    const tableWhere = buildTransferFilters({ from: '2026-03-01', to: '2026-03-31' }, { id: 1 })
    const sql = await sqlFor(withDateRange(tableWhere, SEPTEMBER))
    expect(sql).toContain("date >= '2026-09-01'")
    expect(sql).toContain("date <= '2026-09-30'")
    expect(sql).not.toContain('2026-03-')
  })

  it('adds the window when the table had none', async () => {
    const sql = await sqlFor(withDateRange(buildTransferFilters({}, { id: 1 }), SEPTEMBER))
    expect(sql).toContain("date >= '2026-09-01'")
    expect(sql).toContain("date <= '2026-09-30'")
  })

  it('keeps every other filter and the kasa scope', async () => {
    const tableWhere: Where = {
      ...buildTransferFilters({ type: 'INVESTMENT_EXPENSE', from: '2026-03-01' }, { id: 1 }),
      or: [{ sourceRegister: { equals: 7 } }, { targetRegister: { equals: 7 } }],
    }
    const sql = await sqlFor(withDateRange(tableWhere, SEPTEMBER))
    expect(sql).toContain("'INVESTMENT_EXPENSE'")
    expect(sql).toContain('source_register_id = 7 OR target_register_id = 7')
    expect(sql).not.toContain('2026-03-')
  })

  it('keeps the worker scope', async () => {
    const tableWhere = buildWorkerTransferWhere(
      buildTransferFilters({ from: '2026-03-01', to: '2026-03-31' }, { id: 1 }),
      workerTransferScope(25, [37]),
    )
    const sql = await sqlFor(withDateRange(tableWhere, SEPTEMBER))
    expect(sql).toContain('worker_id = 25')
    expect(sql).toContain("date >= '2026-09-01'")
    expect(sql).not.toContain('2026-03-')
  })

  it('reaches a date filter nested in a branch', async () => {
    const tableWhere: Where = {
      and: [{ date: { greater_than_equal: '2026-03-01' }, investment: { equals: 31 } }],
    }
    const sql = await sqlFor(withDateRange(tableWhere, SEPTEMBER))
    expect(sql).toContain('investment_id = 31')
    expect(sql).not.toContain('2026-03-')
  })
})

describe('narrowToTransferIds', () => {
  it('keeps the URL filters and adds the id list', () => {
    const where = narrowToTransferIds(buildTransferFilters({ investment: '31' }, { id: 0 }), [4, 9])
    const sql = buildSqlConditions(where)

    expect(sql).toContain('investment_id IN (31)')
    expect(sql).toContain('(id IN (4, 9))')
  })

  it('an empty list matches nothing', () => {
    expect(buildSqlConditions(narrowToTransferIds({}, []))).toContain('(id = -1)')
  })

  it('never leaves a top-level `or` beside the `and` it adds', () => {
    const where = narrowToTransferIds(
      buildTransferFilters({ sourceRegister: '50' }, { id: 0 }),
      [4],
    )

    expect(where.or).toBeUndefined()
    const sql = buildSqlConditions(where)
    expect(sql).toContain('source_register_id IN (50) OR target_register_id IN (50)')
    expect(sql).toContain('id IN (4)')
  })

  it('in audit mode narrows the CANCELLATION rows by the original they cancel', () => {
    const audit = buildTransferFilters({ cancelledTransactionAudit: '1' }, { id: 0 })
    const sql = buildSqlConditions(narrowToTransferIds(audit, [4], { throughOriginal: true }))

    expect(sql).toContain("type IN ('CANCELLATION')")
    expect(sql).toContain('(cancelled_transaction_id IN (4))')
    expect(sql).not.toContain('(id IN (4))')
  })
})
