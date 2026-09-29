import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  expireCollectionsAfterResponse,
  revalidateCollections,
} from '@/__tests__/stubs/cache-revalidate'

// The wrapper is the kosztorys plane's only chokepoint (raw SQL bypasses hooks and `access`), so
// three things are asserted: it refuses on a locked investment, it resolves a row id to its
// investment before asking, and it forwards `revalidate`/`opts` untouched — `ownerOnlyAction`, the
// shape this was copied from, drops both, and losing them here would silently kill cache
// invalidation in ~28 actions.
vi.mock('server-only', () => ({}))

const lockState = vi.hoisted(() => ({
  lockMessage: undefined as string | undefined,
  isTemplate: false,
  rowOwner: undefined as
    | { investmentId: number; lockMessage: string | undefined; isTemplate: boolean }
    | undefined,
}))
const markPresetEdited = vi.hoisted(() => vi.fn())

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
  investmentGateFor: vi.fn(async () => ({
    lockMessage: lockState.lockMessage,
    isTemplate: lockState.isTemplate,
  })),
  investmentGateForRow: vi.fn(async () => lockState.rowOwner),
}))
vi.mock('@/lib/db/presets', () => ({ markPresetEdited }))

const { investmentAction } = await import('@/lib/actions/investment-action')
const { INVESTMENT_LOCKED_MESSAGE, INVESTMENT_TRASHED_MESSAGE } =
  await import('@/lib/constants/investment-lock')
const { investmentGateFor, investmentGateForRow } = await import('@/lib/db/investment-gate')

describe('investmentAction', () => {
  beforeEach(() => {
    lockState.lockMessage = undefined
    lockState.isTemplate = false
    lockState.rowOwner = { investmentId: 5, lockMessage: undefined, isTemplate: false }
    revalidateCollections.mockClear()
    expireCollectionsAfterResponse.mockClear()
    markPresetEdited.mockClear()
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
    lockState.rowOwner = {
      investmentId: 5,
      lockMessage: INVESTMENT_LOCKED_MESSAGE,
      isTemplate: false,
    }
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

  // The szablon list sorts by „ostatnio edytowany", so a write into a szablon owes it a fresh stamp —
  // and an ordinary investment must not pay for that on every mutation in the app.
  it('stamps the szablon as edited only when the target is a szablon', async () => {
    await investmentAction('t', { investmentId: 5 }, async () => ({ success: true }))
    expect(markPresetEdited).not.toHaveBeenCalled()
    expect(expireCollectionsAfterResponse).not.toHaveBeenCalled()

    lockState.isTemplate = true
    await investmentAction('t', { investmentId: 5 }, async () => ({ success: true }))
    expect(markPresetEdited).toHaveBeenCalledWith(expect.anything(), 5)
    expect(expireCollectionsAfterResponse).toHaveBeenCalledWith(['presets'])
  })

  it('stamps the owning szablon of a row write', async () => {
    lockState.rowOwner = { investmentId: 9, lockMessage: undefined, isTemplate: true }
    await investmentAction('t', { kind: 'item', id: 3 }, async () => ({ success: true }))
    expect(markPresetEdited).toHaveBeenCalledWith(expect.anything(), 9)
  })

  it('does not stamp a handler that failed', async () => {
    lockState.isTemplate = true
    await investmentAction('t', { investmentId: 5 }, async () => ({
      success: false,
      error: 'nie',
    }))
    expect(markPresetEdited).not.toHaveBeenCalled()
  })

  it('does not revalidate when the lock refuses', async () => {
    lockState.lockMessage = INVESTMENT_LOCKED_MESSAGE
    await investmentAction('t', { investmentId: 5 }, async () => ({ success: true }), [
      'kosztorysItems',
    ])
    expect(revalidateCollections).not.toHaveBeenCalled()
  })
})
