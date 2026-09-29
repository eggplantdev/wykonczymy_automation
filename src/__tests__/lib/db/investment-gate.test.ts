import { describe, it, expect, beforeEach } from 'vitest'
import {
  investmentLockMessage,
  relatedInvestmentLockMessage,
  investmentGateForRow,
} from '@/lib/db/investment-gate'
import {
  INVESTMENT_LOCKED_MESSAGE,
  INVESTMENT_TRASHED_MESSAGE,
  TEMPLATE_TRASHED_MESSAGE,
} from '@/lib/constants/investment-lock'
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

describe('investment lock', () => {
  beforeEach(resetFakePayload)

  describe('investmentLockMessage', () => {
    it('locks only on completed', async () => {
      const db = await getDb(fakePayload)
      for (const [status, expected] of [
        ['completed', INVESTMENT_LOCKED_MESSAGE],
        ['active', undefined],
        ['planowana', undefined],
        // A szablon is editable on purpose — it is unbookable, not locked.
        ['szablon', undefined],
      ] as const) {
        mockExecute.mockResolvedValueOnce({ rows: [{ status, trashed_at: null }] })
        expect(await investmentLockMessage(db, 1)).toBe(expected)
      }
    })

    it('locks a trashed investment with its own sentence, whatever its status', async () => {
      const db = await getDb(fakePayload)
      for (const status of ['active', 'completed'] as const) {
        mockExecute.mockResolvedValueOnce({ rows: [{ status, trashed_at: new Date() }] })
        expect(await investmentLockMessage(db, 1)).toBe(INVESTMENT_TRASHED_MESSAGE)
      }
    })

    // An editor tab left open on a szablon trashed meanwhile must not tell the user about an investment.
    it('locks a trashed szablon with the szablon sentence', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ status: 'szablon', trashed_at: new Date() }] })
      expect(await investmentLockMessage(db, 1)).toBe(TEMPLATE_TRASHED_MESSAGE)
    })

    // A nonexistent investment is the caller's problem to report — locked would answer „zakończona"
    // for an id that never existed.
    it('treats a missing row as unlocked', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [] })
      expect(await investmentLockMessage(db, 999)).toBeUndefined()
    })
  })

  describe('investmentGateForRow', () => {
    it.each([
      ['item', 'kosztorys_items'],
      ['section', 'kosztorys_sections'],
      ['stage', 'kosztorys_stages'],
    ] as const)('reads %s from %s', async (kind, table) => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ id: 42, status: 'active' }] })
      expect(await investmentGateForRow(db, kind, 7)).toEqual({
        investmentId: 42,
        lockMessage: undefined,
        isTemplate: false,
      })
      expect(lastSqlChunks()).toContain(table)
    })

    // Both facts in one round trip: the delete handlers take the owner id straight off this answer
    // rather than asking the same row a second time.
    it('answers owner and lock together', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ id: 42, status: 'completed' }] })
      expect(await investmentGateForRow(db, 'item', 7)).toEqual({
        investmentId: 42,
        lockMessage: INVESTMENT_LOCKED_MESSAGE,
        isTemplate: false,
      })
    })

    it('refuses a row whose investment is in the trash', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({
        rows: [{ id: 42, status: 'active', trashed_at: new Date() }],
      })
      expect((await investmentGateForRow(db, 'item', 7))?.lockMessage).toBe(
        INVESTMENT_TRASHED_MESSAGE,
      )
    })

    // The third fact the same row already carries: a write into a szablon moves its „ostatnio
    // edytowany", and asking for the status separately would double the round trip.
    it('marks a szablon row as a template', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ id: 42, status: 'szablon' }] })
      expect(await investmentGateForRow(db, 'item', 7)).toEqual({
        investmentId: 42,
        lockMessage: undefined,
        isTemplate: true,
      })
    })

    // Distinguishable from „locked" on purpose — the caller reports this one as NOT_FOUND.
    it('returns undefined for a row that does not exist', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [] })
      expect(await investmentGateForRow(db, 'item', 999)).toBeUndefined()
    })
  })

  describe('relatedInvestmentLockMessage', () => {
    it.each([42, '42', { id: 42 }])('resolves a relationship sent as %o', async (relation) => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ status: 'completed' }] })
      expect(await relatedInvestmentLockMessage(db, relation)).toBe(INVESTMENT_LOCKED_MESSAGE)
    })

    // A row naming no investment moves no investment's money — and it must not cost a query.
    it('answers „not locked" for an absent relationship without asking the DB', async () => {
      const db = await getDb(fakePayload)
      expect(await relatedInvestmentLockMessage(db, null)).toBeUndefined()
      expect(mockExecute).not.toHaveBeenCalled()
    })
  })
})
