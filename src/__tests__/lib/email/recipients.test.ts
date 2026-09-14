import { describe, it, expect, vi } from 'vitest'
import type { Payload } from 'payload'
import { readRecipientLists, requireRecipients } from '@/lib/email/recipients'

const fakePayload = (global: Record<string, { email: string }[]>) =>
  ({ findGlobal: vi.fn().mockResolvedValue(global) }) as unknown as Payload

const seeded = {
  fleetDigest: [{ email: 'flota@example.com' }, { email: 'ops@example.com' }],
  equipmentDigest: [{ email: 'sprzet@example.com' }],
  newLead: [{ email: 'sprzedaz@example.com' }],
  opsAlerts: [{ email: 'ops@example.com' }],
}

describe('readRecipientLists', () => {
  it('flattens each list to bare addresses, in stored order', async () => {
    expect(await readRecipientLists(fakePayload(seeded))).toEqual({
      fleetDigest: ['flota@example.com', 'ops@example.com'],
      equipmentDigest: ['sprzet@example.com'],
      newLead: ['sprzedaz@example.com'],
      opsAlerts: ['ops@example.com'],
    })
  })

  // findGlobal on a global whose row was never created returns defaults, so a missing
  // list arrives as undefined rather than as an error.
  it('reads an absent list as empty rather than throwing', async () => {
    expect(await readRecipientLists(fakePayload({}))).toEqual({
      fleetDigest: [],
      equipmentDigest: [],
      newLead: [],
      opsAlerts: [],
    })
  })
})

describe('requireRecipients', () => {
  it('returns the addresses for the requested list only', async () => {
    expect(await requireRecipients(fakePayload(seeded), 'fleetDigest')).toEqual([
      'flota@example.com',
      'ops@example.com',
    ])
  })

  // The throw is what stops a cron reporting a healthy run it never delivered.
  it('throws when the list is empty, naming which stream is unconfigured', async () => {
    const payload = fakePayload({ ...seeded, opsAlerts: [] })

    await expect(requireRecipients(payload, 'opsAlerts')).rejects.toThrow(/alerty techniczne/)
  })

  it('does not throw for a populated list when a sibling list is empty', async () => {
    const payload = fakePayload({ ...seeded, opsAlerts: [] })

    await expect(requireRecipients(payload, 'newLead')).resolves.toEqual(['sprzedaz@example.com'])
  })
})
