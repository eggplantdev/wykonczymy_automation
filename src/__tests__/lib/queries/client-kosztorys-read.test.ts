import { describe, it, expect, vi, beforeEach } from 'vitest'

// The preview route serves the same projection a share link does, minus the token — so its ONLY
// gate is requireAuth. This spec asserts the gate holds by observable effect: on a rejected session
// the read never reaches the DB at all, rather than reaching it and discarding the result.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

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
vi.mock('@payload-config', () => ({ default: {} }))

const { getClientKosztorysPreview } = await import('@/lib/queries/client-kosztorys')

describe('getClientKosztorysPreview auth gate', () => {
  beforeEach(() => {
    buildKosztorysTree.mockReset()
  })

  it('rejects an unauthenticated read without touching the kosztorys', async () => {
    authState.result = { success: false, error: 'Brak autoryzacji' }

    await expect(getClientKosztorysPreview(42)).rejects.toThrow('Brak autoryzacji')
    expect(buildKosztorysTree).not.toHaveBeenCalled()
  })

  it('rejects a role below MANAGEMENT_ROLES the same way — requireAuth owns the role check', async () => {
    authState.result = { success: false, error: 'Brak uprawnień' }

    await expect(getClientKosztorysPreview(42)).rejects.toThrow('Brak uprawnień')
    expect(buildKosztorysTree).not.toHaveBeenCalled()
  })
})
