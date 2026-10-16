import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAuth = vi.fn()
// Throws, because the real `redirect()` throws NEXT_REDIRECT.
const redirect = vi.fn(() => {
  throw new Error('NEXT_REDIRECT')
})

vi.mock('@/lib/auth/require-auth', () => ({ requireAuth }))
vi.mock('next/navigation', () => ({ redirect }))

const { requireManagementPage } = await import('@/lib/auth/require-management-page')

const OWNER = { id: 1, role: 'OWNER' as const, email: 'o@x.pl', name: 'O' }

beforeEach(() => {
  requireAuth.mockReset()
  redirect.mockReset()
})

describe('requireManagementPage', () => {
  it.each([
    ['a session without the role', { success: false, error: 'Brak uprawnień' }],
    ['no session at all', { success: false, error: 'Nie jesteś zalogowany' }],
  ])('redirects to the login page on %s', async (_case, authResult) => {
    requireAuth.mockResolvedValue(authResult)

    await expect(requireManagementPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/zaloguj')
  })

  it('returns the session user on a management session, without redirecting', async () => {
    requireAuth.mockResolvedValue({ success: true, user: OWNER })

    await expect(requireManagementPage()).resolves.toEqual(OWNER)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('refuses an EMPLOYEE — the role set it asks for is the management one', async () => {
    requireAuth.mockResolvedValue({ success: false, error: 'Brak uprawnień' })

    await expect(requireManagementPage()).rejects.toThrow('NEXT_REDIRECT')

    const [allowedRoles] = requireAuth.mock.calls[0]
    expect(allowedRoles).not.toContain('EMPLOYEE')
  })
})
