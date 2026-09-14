import { describe, it, expect, beforeEach } from 'vitest'
import {
  isInvestmentLocked,
  isRelatedInvestmentLocked,
  lockStatusFor,
} from '@/lib/db/investment-lock'
import { fakePayload, mockExecute, resetFakePayload } from '@/__tests__/helpers/fake-payload-sql'
import { getDb } from '@/lib/db/get-db'

// `lastSql` reads only the first chunk; the table name arrives as a nested `sql.raw` chunk.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sqlText(node: any): string {
  if (Array.isArray(node?.value)) return node.value.join('')
  if (Array.isArray(node?.queryChunks)) return node.queryChunks.map(sqlText).join('')
  return ''
}

function lastSqlChunks(): string {
  const calls = mockExecute.mock.calls
  return sqlText(calls[calls.length - 1]?.[0])
}

// The lock is what makes „Zakończona" enforceable, so its two questions are asserted directly:
// which status counts as locked, and which investment a kosztorys row belongs to.
describe('investment lock', () => {
  beforeEach(resetFakePayload)

  describe('isInvestmentLocked', () => {
    it('locks only on completed', async () => {
      const db = await getDb(fakePayload)
      for (const [status, expected] of [
        ['completed', true],
        ['active', false],
        ['planowana', false],
      ] as const) {
        mockExecute.mockResolvedValueOnce({ rows: [{ status }] })
        expect(await isInvestmentLocked(db, 1)).toBe(expected)
      }
    })

    // A nonexistent investment is the caller's problem to report, not the lock's — reporting it as
    // locked would answer „zakończona" for an id that never existed.
    it('treats a missing row as unlocked', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [] })
      expect(await isInvestmentLocked(db, 999)).toBe(false)
    })
  })

  describe('lockStatusFor', () => {
    it.each([
      ['item', 'kosztorys_items'],
      ['section', 'kosztorys_sections'],
      ['stage', 'kosztorys_stages'],
    ] as const)('reads %s from %s', async (kind, table) => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ id: 42, status: 'active' }] })
      expect(await lockStatusFor(db, kind, 7)).toEqual({ investmentId: 42, locked: false })
      expect(lastSqlChunks()).toContain(table)
    })

    // Both facts in one round trip: the delete handlers take the owner id straight off this answer
    // rather than asking the same row a second time.
    it('answers owner and lock together', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ id: 42, status: 'completed' }] })
      expect(await lockStatusFor(db, 'item', 7)).toEqual({ investmentId: 42, locked: true })
    })

    // Distinguishable from „locked" on purpose — the caller reports this one as NOT_FOUND.
    it('returns undefined for a row that does not exist', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [] })
      expect(await lockStatusFor(db, 'item', 999)).toBeUndefined()
    })
  })

  describe('isRelatedInvestmentLocked', () => {
    it.each([42, '42', { id: 42 }])('resolves a relationship sent as %o', async (relation) => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ status: 'completed' }] })
      expect(await isRelatedInvestmentLocked(db, relation)).toBe(true)
    })

    // A row naming no investment moves no investment's money — and it must not cost a query.
    it('answers „not locked" for an absent relationship without asking the DB', async () => {
      const db = await getDb(fakePayload)
      expect(await isRelatedInvestmentLocked(db, null)).toBe(false)
      expect(mockExecute).not.toHaveBeenCalled()
    })
  })
})
