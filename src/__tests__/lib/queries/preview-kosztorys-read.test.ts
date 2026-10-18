import { describe, it, expect, vi, beforeEach } from 'vitest'

const authState = vi.hoisted(() => ({
  result: { success: true, user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' } } as
    | { success: true; user: { id: number; email: string; name: string; role: string } }
    | { success: false; error: string },
}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => authState.result),
}))

const buildKosztorysTree = vi.fn()
vi.mock('@/lib/queries/kosztorys', () => ({ buildKosztorysTree }))
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ findByID: vi.fn(), find: vi.fn() })),
}))

const { requireAuth } = await import('@/lib/auth/require-auth')
const { MANAGEMENT_ROLES } = await import('@/lib/auth/roles')

const { getPreviewKosztorysById } = await import('@/lib/queries/preview-kosztorys')

describe('getPreviewKosztorysById auth gate', () => {
  beforeEach(() => {
    buildKosztorysTree.mockReset()
  })

  it('rejects an unauthenticated read without touching the kosztorys', async () => {
    authState.result = { success: false, error: 'Brak autoryzacji' }

    await expect(getPreviewKosztorysById(42)).rejects.toThrow('Brak autoryzacji')
    expect(buildKosztorysTree).not.toHaveBeenCalled()
    expect(requireAuth).toHaveBeenCalledWith(MANAGEMENT_ROLES)
  })
})
