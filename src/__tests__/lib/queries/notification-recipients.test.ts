import { describe, it, expect, vi } from 'vitest'
import { RECIPIENT_LISTS } from '@/lib/email/recipients'

// A cached entry outlives the deploy that widened `RECIPIENT_LISTS`, so the shape coming back can
// be one key short of what the pages read. Asserted on the returned OBJECT rather than on the
// reader: `readRecipientLists` already fills every key, so a spec pointed at it passes green on the
// build that crashed — the gap only exists between the cache and its consumer.
const readRecipientLists = vi.fn()
vi.mock('@/lib/email/recipients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/recipients')>()),
  readRecipientLists: (...args: unknown[]) => readRecipientLists(...args),
}))
vi.mock('payload', () => ({ getPayload: vi.fn().mockResolvedValue({}) }))
vi.mock('@payload-config', () => ({ default: {} }))

describe('fetchRecipientLists', () => {
  it('fills a list the cached entry predates instead of handing back a hole', async () => {
    const { fetchRecipientLists } = await import('@/lib/queries/notification-recipients')
    const stale = { fleetDigest: ['flota@example.com'], newLead: [], opsAlerts: [] }
    readRecipientLists.mockResolvedValue(stale)

    const lists = await fetchRecipientLists()

    expect(Object.keys(lists).sort()).toEqual([...RECIPIENT_LISTS].sort())
    expect(lists.equipmentDigest).toEqual([])
    expect(lists.fleetDigest).toEqual(['flota@example.com'])
  })

  it('leaves a complete answer untouched', async () => {
    const { fetchRecipientLists } = await import('@/lib/queries/notification-recipients')
    const complete = {
      fleetDigest: ['flota@example.com'],
      equipmentDigest: ['sprzet@example.com'],
      newLead: ['sprzedaz@example.com'],
      opsAlerts: ['ops@example.com'],
    }
    readRecipientLists.mockResolvedValue(complete)

    expect(await fetchRecipientLists()).toEqual(complete)
  })
})
