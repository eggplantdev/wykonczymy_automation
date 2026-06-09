import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// The action under test only needs `login`; `logout` is stubbed to satisfy the import.
const mockLogin = vi.fn()
vi.mock('@payloadcms/next/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  logout: vi.fn(),
}))

// Avoid loading the real Payload config / env validation in unit tests.
vi.mock('@payload-config', () => ({ default: {} }))

const { loginAction } = await import('@/lib/actions/auth')

describe('loginAction', () => {
  beforeEach(() => {
    mockLogin.mockReset()
  })

  // Payload locks the account after maxLoginAttempts and throws LockedAuth — the same 401 as a
  // wrong password. A locked user used to see the generic "wrong email/password" message with no
  // hint that waiting fixes it. The action must map LockedAuth to a distinct lockout message.
  it('maps a locked-account error to a distinct lockout message', async () => {
    const locked = new Error('This user is locked due to having too many failed login attempts.')
    locked.name = 'LockedAuth'
    mockLogin.mockRejectedValue(locked)

    const result = await loginAction({ email: 'a@b.pl', password: 'x' })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/zablokowane/i)
  })

  it('maps any other login failure to the generic message', async () => {
    mockLogin.mockRejectedValue(new Error('The email or password provided is incorrect.'))

    const result = await loginAction({ email: 'a@b.pl', password: 'wrong' })

    expect(result).toEqual({ success: false, error: 'Nieprawidłowy email lub hasło' })
  })

  it('returns success when login resolves', async () => {
    mockLogin.mockResolvedValue({ token: 'jwt' })

    const result = await loginAction({ email: 'a@b.pl', password: 'correct' })

    expect(result).toEqual({ success: true })
  })
})
