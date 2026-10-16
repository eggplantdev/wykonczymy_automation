import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { deleteTrashedInvestment } from '@/lib/investments/delete-investment-forever'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/utils/log-error', () => ({ logError: vi.fn() }))

describe('deleteTrashedInvestment', () => {
  it('reports a failed read as an error, not as not-trashed', async () => {
    const del = vi.fn()
    const payload = {
      findByID: vi.fn().mockRejectedValue(new Error('Connection terminated unexpectedly')),
      delete: del,
    } as unknown as Payload

    const result = await deleteTrashedInvestment(payload, 42)

    expect(result).toMatchObject({ ok: false, reason: 'error' })
    expect(del).not.toHaveBeenCalled()
  })
})
