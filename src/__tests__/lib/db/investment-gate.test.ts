import { describe, it, expect, beforeEach } from 'vitest'
import {
  investmentLockMessage,
  relatedInvestmentLockMessage,
  investmentGateForRow,
} from '@/lib/db/investment-gate'
import {
  INVESTMENT_LOCKED_MESSAGE,
  INVESTMENT_TRASHED_MESSAGE,
} from '@/lib/constants/investment-lock'
import { fakePayload, mockExecute, resetFakePayload } from '@/__tests__/helpers/fake-payload-sql'
import { getDb } from '@/lib/db/get-db'

describe('investment lock', () => {
  beforeEach(resetFakePayload)

  describe('investmentLockMessage', () => {
    it('locks only on completed', async () => {
      const db = await getDb(fakePayload)
      for (const [status, expected] of [
        ['completed', INVESTMENT_LOCKED_MESSAGE],
        ['active', undefined],
        ['planowana', undefined],
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

    // A nonexistent investment is the caller's problem to report — locked would answer „zakończona"
    // for an id that never existed.
    it('treats a missing row as unlocked', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [] })
      expect(await investmentLockMessage(db, 999)).toBeUndefined()
    })
  })

  describe('investmentGateForRow', () => {
    it('answers owner and lock together', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ id: 42, status: 'completed' }] })
      expect(await investmentGateForRow(db, 'item', 7)).toEqual({
        investmentId: 42,
        lockMessage: INVESTMENT_LOCKED_MESSAGE,
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

    it('answers „not locked" for an absent relationship without asking the DB', async () => {
      const db = await getDb(fakePayload)
      expect(await relatedInvestmentLockMessage(db, null)).toBeUndefined()
      expect(mockExecute).not.toHaveBeenCalled()
    })
  })
})
