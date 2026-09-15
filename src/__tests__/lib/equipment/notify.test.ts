import { describe, it, expect, vi } from 'vitest'
import type { Payload } from 'payload'
import type { EquipmentDigestT, WarrantyEntryT } from '@/lib/equipment/digest'

vi.mock('@/lib/env', () => ({ FRONTEND_URL: 'https://example.test' }))

const { notifyEquipmentDigest } = await import('@/lib/equipment/notify')

const EMPTY_DIGEST: EquipmentDigestT = { within7: [], within30: [], stamps: [] }

const entry = (overrides: Partial<WarrantyEntryT> = {}): WarrantyEntryT => ({
  equipmentId: 1,
  name: 'Wiertarka udarowa',
  make: 'Bosch',
  model: 'GSB 18V',
  serialNumber: 'SN-0001',
  warrantyUntil: '2026-09-20',
  daysLeft: 5,
  ...overrides,
})

const payloadWith = (equipmentDigest: { email: string }[]) => {
  const sendEmail = vi.fn(
    async (_message: { to: string[]; subject: string; html: string }) => undefined,
  )
  const payload = {
    sendEmail,
    findGlobal: async () => ({ equipmentDigest, fleetDigest: [], newLead: [], opsAlerts: [] }),
  } as unknown as Payload
  return { payload, sendEmail }
}

describe('notifyEquipmentDigest', () => {
  // One message with N addresses, never N messages: the caller stamps the warranties as announced
  // once, and that stamp has to describe exactly what was sent.
  it('sends a single mail addressed to the whole list', async () => {
    const { payload, sendEmail } = payloadWith([
      { email: 'a@example.com' },
      { email: 'b@example.com' },
    ])

    await notifyEquipmentDigest(payload, { ...EMPTY_DIGEST, within30: [entry()] })

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@example.com', 'b@example.com'] }),
    )
  })

  // Mailing the void looks identical to a healthy run in every log, and the caller must not stamp.
  it('throws without sending when nobody is on the list', async () => {
    const { payload, sendEmail } = payloadWith([])

    await expect(notifyEquipmentDigest(payload, EMPTY_DIGEST)).rejects.toThrow(/Brak odbiorców/)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  // Three „szlifierki" are a normal inventory, so the line has to carry enough to walk to the shelf
  // and find the one item — name alone would send the reader to the wrong tool.
  it('names each item by make, model and serial, in its own bucket', async () => {
    const { payload, sendEmail } = payloadWith([{ email: 'a@example.com' }])

    await notifyEquipmentDigest(payload, {
      ...EMPTY_DIGEST,
      within7: [entry()],
      within30: [
        entry({ equipmentId: 2, name: 'Szlifierka', serialNumber: 'SN-0002', daysLeft: 22 }),
      ],
    })

    const html = sendEmail.mock.calls[0]![0].html
    expect(html).toContain('Wiertarka udarowa Bosch GSB 18V SN-0001')
    expect(html).toContain('Szlifierka Bosch GSB 18V SN-0002')
    expect(html.indexOf('W ciągu 7 dni')).toBeLessThan(html.indexOf('W ciągu 30 dni'))
  })

  // The subject is all a phone's lock screen shows, so „this week" has to be visible without
  // opening the mail — and must not shout when nothing is that close.
  it('escalates the subject only when something expires within 7 days', async () => {
    const { payload, sendEmail } = payloadWith([{ email: 'a@example.com' }])

    await notifyEquipmentDigest(payload, { ...EMPTY_DIGEST, within30: [entry({ daysLeft: 22 })] })
    expect(sendEmail.mock.calls[0]![0].subject).toBe('Sprzęt — kończące się gwarancje — Wykończymy')

    await notifyEquipmentDigest(payload, {
      ...EMPTY_DIGEST,
      within7: [entry(), entry({ equipmentId: 2 })],
    })
    expect(sendEmail.mock.calls[1]![0].subject).toContain('2 gwarancji kończy się w tym tygodniu')
  })

  // An empty bucket printing its heading reads as „checked, nothing due" on a mail that listed
  // nothing — the absent section is the signal.
  it('prints no heading for an empty bucket', async () => {
    const { payload, sendEmail } = payloadWith([{ email: 'a@example.com' }])

    await notifyEquipmentDigest(payload, { ...EMPTY_DIGEST, within7: [entry()] })

    expect(sendEmail.mock.calls[0]![0].html).not.toContain('W ciągu 30 dni')
  })
})
