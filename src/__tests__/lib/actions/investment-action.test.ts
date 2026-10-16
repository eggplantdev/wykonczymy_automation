import { describe, it, expect, vi, beforeEach } from 'vitest'
import { revalidateCollections } from '@/__tests__/stubs/cache-revalidate'

vi.mock('server-only', () => ({}))

const lockState = vi.hoisted(() => ({
  lockMessage: undefined as string | undefined,
  rowOwner: undefined as { investmentId: number; lockMessage: string | undefined } | undefined,
}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: vi.fn(async () => ({})),
}))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({ execute: vi.fn() })) }))
vi.mock('@/lib/db/investment-gate', () => ({
  investmentGateFor: vi.fn(async () => ({ lockMessage: lockState.lockMessage })),
  investmentGateForRow: vi.fn(async () => lockState.rowOwner),
}))

const { investmentAction } = await import('@/lib/actions/investment-action')
const { INVESTMENT_LOCKED_MESSAGE, INVESTMENT_TRASHED_MESSAGE } =
  await import('@/lib/constants/investment-lock')
const { investmentGateFor, investmentGateForRow } = await import('@/lib/db/investment-gate')

describe('investmentAction', () => {
  beforeEach(() => {
    lockState.lockMessage = undefined
    lockState.rowOwner = { investmentId: 5, lockMessage: undefined }
    revalidateCollections.mockClear()
    vi.mocked(investmentGateFor).mockClear()
    vi.mocked(investmentGateForRow).mockClear()
  })

  it('runs the handler on an unlocked investment', async () => {
    const handler = vi.fn(async () => ({ success: true as const }))
    const result = await investmentAction('t', { investmentId: 5 }, handler)
    expect(result).toEqual({ success: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('refuses on a locked investment without running the handler', async () => {
    lockState.lockMessage = INVESTMENT_LOCKED_MESSAGE
    const handler = vi.fn(async () => ({ success: true as const }))
    const result = await investmentAction('t', { investmentId: 5 }, handler)
    expect(result).toEqual({ success: false, error: INVESTMENT_LOCKED_MESSAGE })
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses with the gate’s own sentence, so a trashed investment says why', async () => {
    lockState.lockMessage = INVESTMENT_TRASHED_MESSAGE
    const result = await investmentAction('t', { investmentId: 5 }, async () => ({ success: true }))
    expect(result).toEqual({ success: false, error: INVESTMENT_TRASHED_MESSAGE })
  })

  // One join, not a lookup then a check: the editor fans a write out per changed cell, so the
  // second round trip would be multiplied by the size of a paste.
  it('reads the row owner status in a single query', async () => {
    const handler = vi.fn(async () => ({ success: true as const }))
    await investmentAction('t', { kind: 'item', id: 3 }, handler)
    expect(vi.mocked(investmentGateForRow).mock.calls[0]?.slice(1)).toEqual(['item', 3])
    expect(vi.mocked(investmentGateFor)).not.toHaveBeenCalled()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('refuses a row whose investment is completed', async () => {
    lockState.rowOwner = { investmentId: 5, lockMessage: INVESTMENT_LOCKED_MESSAGE }
    const handler = vi.fn(async () => ({ success: true as const }))
    const result = await investmentAction('t', { kind: 'item', id: 3 }, handler)
    expect(result).toEqual({ success: false, error: INVESTMENT_LOCKED_MESSAGE })
    expect(handler).not.toHaveBeenCalled()
  })

  // The code, not just the sentence: `use-stale-tree-recovery` keys the reseed off NOT_FOUND, so
  // dropping it leaves the editor holding a stale tree behind an unexplained toast.
  it('reports a row that does not exist as NOT_FOUND instead of silently allowing the write', async () => {
    lockState.rowOwner = undefined
    const handler = vi.fn(async () => ({ success: true as const }))
    const result = await investmentAction('t', { kind: 'section', id: 3 }, handler)
    expect(result).toEqual({ success: false, error: 'Sekcja nie istnieje.', code: 'NOT_FOUND' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards revalidate and opts to protectedAction', async () => {
    await investmentAction(
      't',
      { investmentId: 5 },
      async () => ({ success: true }),
      ['kosztorysItems'],
      { deferRefresh: true },
    )
    expect(revalidateCollections).toHaveBeenCalledWith(['kosztorysItems'], { deferRefresh: true })
  })

  it('does not revalidate when the lock refuses', async () => {
    lockState.lockMessage = INVESTMENT_LOCKED_MESSAGE
    await investmentAction('t', { investmentId: 5 }, async () => ({ success: true }), [
      'kosztorysItems',
    ])
    expect(revalidateCollections).not.toHaveBeenCalled()
  })
})
