import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'

const SECRET = 'test-secret'

const { cookieJar, isSessionAlive, unstableCache } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  isSessionAlive: vi.fn(),
  unstableCache: vi.fn(<FnT>(fn: FnT) => fn),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
  }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ unstable_cache: unstableCache }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ secret: SECRET })) }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({})) }))
vi.mock('@/lib/db/user-sessions', () => ({ isSessionAlive }))
vi.mock('@/lib/utils/log-error', () => ({ logError: vi.fn() }))

const { logError } = await import('@/lib/utils/log-error')

const { getCurrentUserJwt, getSession } = await import('@/lib/auth/get-current-user-jwt')

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
  it('returns the user of a live session, checked by its own id, sid and role', async () => {
    cookieJar.set('payload-token', await signToken(CLAIMS))

    expect(await getCurrentUserJwt()).toEqual({
      id: 7,
      email: 'w@t.pl',
      name: 'Pracownik',
      role: 'EMPLOYEE',
    })
    expect(isSessionAlive).toHaveBeenCalledWith(expect.anything(), 7, 'sid-1', 'EMPLOYEE')
    expect((await getSession())?.issuedAt).toBe(ISSUED_AT)
  })

  // Every write to `users` — the „Aktywny" box in „Edytuj pracownika" included — must reach the
  // cached answer, or a deactivated worker stays in until the backstop.
  it('caches the check under the users collection tag', async () => {
    cookieJar.set('payload-token', await signToken(CLAIMS))

    await getCurrentUserJwt()

    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      expect.anything(),
      expect.objectContaining({ tags: ['collection:users'] }),
    )
  })

  it('refuses a validly signed token whose session was ended', async () => {
    isSessionAlive.mockResolvedValue(false)
    cookieJar.set('payload-token', await signToken(CLAIMS))

    expect(await getCurrentUserJwt()).toBeUndefined()
    expect(await getSession()).toBeUndefined()
  })

  it('refuses the session when the check cannot reach the DB', async () => {
    isSessionAlive.mockRejectedValue(new Error('connection refused'))
    cookieJar.set('payload-token', await signToken(CLAIMS))

    expect(await getCurrentUserJwt()).toBeUndefined()
    expect(logError).toHaveBeenCalledWith('[getCurrentUserJwt] session check failed:', expect.any(Error))
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
