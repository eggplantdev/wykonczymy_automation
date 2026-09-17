import { describe, it, expect, beforeEach } from 'vitest'
import type { Where } from 'payload'
import {
  buildTransferFilters,
  scopeAuditThroughOriginal,
  scopeNarrowsByOriginalOnlyField,
  stripCancelledFilters,
  stripOriginalScopedFilters,
} from '@/lib/queries/transfer-filters'
import { sumFilteredByType } from '@/lib/db/sum-transfers'
import { buildSqlConditions } from '@/lib/db/where-to-sql'
import { fakePayload, lastSql, resetFakePayload } from '@/__tests__/helpers/fake-payload-sql'

/**
 * Assert the EMITTED SQL, never the intermediate Where: a Where-shape assertion stays green
 * when the translator silently drops an operator (EX-574). Translation itself is covered per-operator
 * in `lib/db/where-to-sql.test.ts`; these cases pin the whole URL → SQL chain.
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

  it('matches a cash register on either side of the transfer', async () => {
    expect(await sqlForSearchParams({ sourceRegister: '3,5' })).toContain(
      '(source_register_id IN (3, 5) OR target_register_id IN (3, 5))',
    )
  })
})

/**
 * These assert the Where, not emitted SQL — deliberately, and against the rule at the top of this
 * file. The audit list is the one path that does NOT go through where-to-sql: it is handed to
 * Payload, which resolves the dotted relationship path itself. The Where is therefore the whole
 * contract, and there is no SQL of ours to pin instead.
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

  // The method stopped being copied onto the audit row when it became a two-type field, so the
  // scope has to reach the original — otherwise „anulowania przelewem" answers „Brak danych".
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

  // The Typ filter used to be skipped outright in this mode, so „pokaż tylko anulowania wydatków"
  // silently listed anulowania of everything — and „nic nie zaznaczone" listed everything too.
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

  // Exported, so a composed Where can carry original-only fields under `and` — unrewritten, the list
  // reads „Brak danych".
  it('recurses into `and` as well as `or`', () => {
    const where = scopeAuditThroughOriginal({
      and: [{ investment: { equals: 31 } }, { or: [{ worker: { equals: 25 } }] }],
    })

    expect(where.and).toEqual([
      { 'cancelledTransaction.investment': { equals: 31 } },
      { or: [{ 'cancelledTransaction.worker': { equals: 25 } }] },
    ])
  })

  // Why the sum tile above the list keeps the un-rewritten where: where-to-sql knows columns of
  // `transactions` and refuses anything else rather than silently dropping it (EX-574).
  it('produces a where the stats SQL translator refuses', () => {
    expect(() => buildSqlConditions(auditWhere({ investment: { equals: 31 } }))).toThrow(
      /unmapped field/,
    )
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
