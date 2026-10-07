import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'

const SECRET = 'test-secret'

const { cookieJar, isSessionAlive } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  isSessionAlive: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
  }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ secret: SECRET })) }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({})) }))
vi.mock('@/lib/db/user-sessions', () => ({ isSessionAlive }))
vi.mock('@/lib/utils/log-error', () => ({ logError: vi.fn() }))

const { getCurrentUserJwt, getSessionIssuedAt } = await import('@/lib/auth/get-current-user-jwt')

const ISSUED_AT = 1_790_000_000
const CLAIMS = { id: 7, email: 'w@t.pl', name: 'Pracownik', role: 'EMPLOYEE', sid: 'sid-1' }

const signToken = (claims: Record<string, unknown>) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(ISSUED_AT)
    .setExpirationTime('90d')
    .sign(new TextEncoder().encode(SECRET))

beforeEach(() => {
  cookieJar.clear()
  isSessionAlive.mockReset().mockResolvedValue(true)
})

describe('getCurrentUserJwt', () => {
  it('returns the user of a live session, checked by its own id and sid', async () => {
    cookieJar.set('payload-token', await signToken(CLAIMS))

    expect(await getCurrentUserJwt()).toEqual({
      id: 7,
      email: 'w@t.pl',
      name: 'Pracownik',
      role: 'EMPLOYEE',
    })
    expect(isSessionAlive).toHaveBeenCalledWith(expect.anything(), 7, 'sid-1')
    expect(await getSessionIssuedAt()).toBe(ISSUED_AT)
  })

  it('refuses a validly signed token whose session was ended', async () => {
    isSessionAlive.mockResolvedValue(false)
    cookieJar.set('payload-token', await signToken(CLAIMS))

    expect(await getCurrentUserJwt()).toBeUndefined()
    expect(await getSessionIssuedAt()).toBeUndefined()
  })

  it('refuses a token without a sid, without asking the DB', async () => {
    cookieJar.set('payload-token', await signToken({ ...CLAIMS, sid: undefined }))

    expect(await getCurrentUserJwt()).toBeUndefined()
    expect(isSessionAlive).not.toHaveBeenCalled()
  })

  it('returns nothing without a cookie', async () => {
    expect(await getCurrentUserJwt()).toBeUndefined()
    expect(isSessionAlive).not.toHaveBeenCalled()
  })
})
