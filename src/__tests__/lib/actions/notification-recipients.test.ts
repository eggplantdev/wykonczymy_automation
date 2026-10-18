import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { authState } from '@/__tests__/stubs/require-auth'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/require-auth', () => import('@/__tests__/stubs/require-auth'))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { saveRecipientListAction } = await import('@/lib/actions/notification-recipients')
const { readRecipientLists } = await import('@/lib/email/recipients')

const BASELINE = {
  fleetDigest: [{ email: 'flota@example.com' }],
  equipmentDigest: [{ email: 'sprzet@example.com' }],
  newLead: [{ email: 'sprzedaz@example.com' }],
  opsAlerts: [{ email: 'ops@example.com' }],
}

describe.skipIf(!ENV_READY)('saveRecipientListAction (DB)', () => {
  let payload: Payload

  const resetGlobal = () =>
    payload.updateGlobal({ slug: 'notification-recipients', data: BASELINE })

  beforeAll(async () => {
    payload = await bootTestPayload()
    await resetGlobal()
  }, 30000)

  // Firm-wide state, not this spec's own row: left mutated it decides who a later spec mails.
  afterAll(async () => {
    authState.role = 'OWNER'
    await resetGlobal()
  })

  it('rewrites the named list and leaves its siblings intact', async () => {
    await resetGlobal()
    const result = await saveRecipientListAction('fleetDigest', ['a@example.com', 'b@example.com'])

    expect(result.success).toBe(true)
    expect(await readRecipientLists(payload)).toEqual({
      fleetDigest: ['a@example.com', 'b@example.com'],
      equipmentDigest: ['sprzet@example.com'],
      newLead: ['sprzedaz@example.com'],
      opsAlerts: ['ops@example.com'],
    })
  })

  it('refuses an empty list and writes nothing', async () => {
    await resetGlobal()
    const result = await saveRecipientListAction('opsAlerts', [])

    expect(result.success).toBe(false)
    expect((await readRecipientLists(payload)).opsAlerts).toEqual(['ops@example.com'])
  })

  it('refuses a malformed address and writes nothing', async () => {
    await resetGlobal()
    const result = await saveRecipientListAction('newLead', ['ok@example.com', 'not-an-email'])

    expect(result.success).toBe(false)
    expect((await readRecipientLists(payload)).newLead).toEqual(['sprzedaz@example.com'])
  })

  it('trims surrounding whitespace rather than storing an address nobody can mail', async () => {
    await resetGlobal()
    await saveRecipientListAction('newLead', ['  spaced@example.com  '])

    expect((await readRecipientLists(payload)).newLead).toEqual(['spaced@example.com'])
  })

  it('stores one entry per address when the same one is typed twice', async () => {
    await resetGlobal()
    await saveRecipientListAction('newLead', ['dup@example.com', 'dup@example.com'])

    expect((await readRecipientLists(payload)).newLead).toEqual(['dup@example.com'])
  })

  it('rejects a MANAGER without touching the row', async () => {
    await resetGlobal()
    authState.role = 'MANAGER'
    const result = await saveRecipientListAction('fleetDigest', ['manager@example.com'])
    authState.role = 'OWNER'

    expect(result.success).toBe(false)
    expect((await readRecipientLists(payload)).fleetDigest).toEqual(['flota@example.com'])
  })
})
