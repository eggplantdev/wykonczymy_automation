import { describe, it, expect } from 'vitest'
import type { Where } from 'payload'
import { buildSqlConditions, isNoResultsSentinel } from '@/lib/db/where-to-sql'

describe('buildSqlConditions — Where → SQL', () => {
  it('renders an in list', () => {
    expect(buildSqlConditions({ type: { in: ['PAYOUT', 'OTHER'] } })).toContain(
      "type IN ('PAYOUT', 'OTHER')",
    )
  })

  it('renders a not_in list', () => {
    expect(buildSqlConditions({ type: { not_in: ['CANCELLATION'] } })).toContain(
      "type NOT IN ('CANCELLATION')",
    )
  })

  it('maps a relation field to its foreign-key column', () => {
    expect(buildSqlConditions({ investment: { in: [5] } })).toContain('investment_id IN (5)')
    expect(buildSqlConditions({ worker: { equals: 5 } })).toContain('worker_id = 5')
    expect(buildSqlConditions({ paymentMethod: { in: ['CASH'] } })).toContain(
      "payment_method IN ('CASH')",
    )
  })

  it('renders both ends of a range as one parenthesised condition', () => {
    expect(
      buildSqlConditions({ amount: { greater_than_equal: 500, less_than: 500.01 } }),
    ).toContain('(amount >= 500 AND amount < 500.01)')
  })

  it('renders a prefix match as a text LIKE', () => {
    expect(buildSqlConditions({ amount: { like: '500' } })).toContain("amount::text LIKE '500'")
  })

  it('joins independent fields with AND', () => {
    const sql = buildSqlConditions({
      worker: { equals: 3 },
      date: { greater_than_equal: '2024-06-01', less_than_equal: '2024-12-31' },
    })
    expect(sql).toContain('worker_id = 3')
    expect(sql).toContain("date >= '2024-06-01'")
    expect(sql).toContain("date <= '2024-12-31'")
  })

  it('renders an or branch as a parenthesised alternation', () => {
    expect(
      buildSqlConditions({
        or: [{ sourceRegister: { in: [3] } }, { targetRegister: { in: [3] } }],
      }),
    ).toContain('(source_register_id IN (3) OR target_register_id IN (3))')
  })

  it('keeps a range intact inside an or branch', () => {
    // Unparenthesised, `a >= 1 AND a < 2 OR b = 3` would bind the wrong way round.
    expect(
      buildSqlConditions({
        or: [{ amount: { greater_than_equal: 1, less_than: 2 } }, { worker: { equals: 3 } }],
      }),
    ).toContain('((amount >= 1 AND amount < 2) OR worker_id = 3)')
  })

  it('renders an and branch as a parenthesised conjunction', () => {
    expect(
      buildSqlConditions({ and: [{ worker: { equals: 3 } }, { type: { in: ['PAYOUT'] } }] }),
    ).toContain("(worker_id = 3 AND type IN ('PAYOUT'))")
  })

  it('nests an or inside an and, next to a top-level field', () => {
    const sql = buildSqlConditions({
      investment: { in: [5] },
      and: [
        {
          or: [
            { worker: { equals: 3 } },
            { sourceRegister: { in: [7] } },
            { targetRegister: { in: [7] } },
          ],
        },
      ],
    })
    expect(sql).toContain('AND investment_id IN (5)')
    expect(sql).toContain(
      'AND ((worker_id = 3 OR source_register_id IN (7) OR target_register_id IN (7)))',
    )
  })

  it('escapes a single quote by doubling it', () => {
    expect(buildSqlConditions({ paymentMethod: { equals: "o'brien" } })).toContain(
      "payment_method = 'o''brien'",
    )
  })

  it('renders a boolean instead of degrading it to NULL', () => {
    // `col != NULL` is NULL for every row, so a degraded boolean matches nothing silently.
    expect(buildSqlConditions({ cancelled: { not_equals: true } })).toContain('cancelled != TRUE')
  })

  it('produces no conditions for an empty where', () => {
    expect(buildSqlConditions({})).toBe('')
  })
})

/**
 * Every Where reaching this module is built in-repo, so anything unrecognised means a caller grew
 * something the translator wasn't taught. Skipping it silently is how a filter stops narrowing
 * without anyone noticing (EX-574) — each of these must throw instead.
 */
describe('buildSqlConditions — refuses what it cannot translate', () => {
  it('refuses an unknown operator', () => {
    expect(() => buildSqlConditions({ amount: { exists: true } })).toThrow(/exists/)
  })

  it('refuses an operator name inherited from Object.prototype', () => {
    expect(() => buildSqlConditions({ amount: { isPrototypeOf: 5 } } as unknown as Where)).toThrow(
      /isPrototypeOf/,
    )
  })

  it('refuses an unmapped field', () => {
    expect(() => buildSqlConditions({ nickname: { equals: 'x' } } as unknown as Where)).toThrow(
      /unmapped field "nickname"/,
    )
  })

  it('refuses a non-array value for in', () => {
    expect(() => buildSqlConditions({ type: { in: 'PAYOUT' } } as unknown as Where)).toThrow(
      /expects an array/,
    )
  })

  it('refuses a value type it cannot render', () => {
    expect(() => buildSqlConditions({ date: { equals: new Date() } } as unknown as Where)).toThrow(
      /unsupported value type/,
    )
  })

  it('refuses a field carrying no operator', () => {
    expect(() => buildSqlConditions({ date: {} })).toThrow(/no operator/)
  })

  it('refuses an empty or list', () => {
    expect(() => buildSqlConditions({ or: [] })).toThrow(/non-empty array/)
  })

  it('refuses an empty or non-array and', () => {
    expect(() => buildSqlConditions({ and: [] })).toThrow(/"and" expects a non-empty array/)
    expect(() =>
      buildSqlConditions({ and: { worker: { equals: 3 } } } as unknown as Where),
    ).toThrow(/"and" expects a non-empty array/)
  })

  it('refuses an empty branch rather than rendering ()', () => {
    expect(() => buildSqlConditions({ and: [{}] })).toThrow(/branch carries no field/)
    expect(() => buildSqlConditions({ or: [{}, { worker: { equals: 3 } }] })).toThrow(
      /branch carries no field/,
    )
  })
})

describe('isNoResultsSentinel', () => {
  it('detects the sentinel', () => {
    expect(isNoResultsSentinel({ id: { equals: -1 } })).toBe(true)
  })

  it('leaves a real id filter alone', () => {
    expect(isNoResultsSentinel({ id: { equals: 42 } })).toBe(false)
    expect(isNoResultsSentinel({})).toBe(false)
  })
})
