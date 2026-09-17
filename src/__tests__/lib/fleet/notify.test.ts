import { describe, it, expect, vi } from 'vitest'
import type { Payload } from 'payload'
import type { FleetDigestT } from '@/lib/fleet/reminder-sweep'

vi.mock('@/lib/env', () => ({ FRONTEND_URL: 'https://example.test' }))

const { notifyFleetDigest } = await import('@/lib/fleet/notify')

const EMPTY_DIGEST: FleetDigestT = {
  overdue: [],
  within7: [],
  odometer: [],
  stamps: [],
}

const payloadWith = (fleetDigest: { email: string }[]) => {
  const sendEmail = vi.fn(
    async (_message: { to: string[]; subject: string; html: string }) => undefined,
  )
  const payload = {
    sendEmail,
    findGlobal: async () => ({ fleetDigest, newLead: [], opsAlerts: [] }),
  } as unknown as Payload
  return { payload, sendEmail }
}

describe('notifyFleetDigest', () => {
  // One message with N addresses, never N messages: the caller stamps the deadlines as announced
  // once, and that stamp has to describe exactly what was sent.
  it('sends a single mail addressed to the whole list', async () => {
    const { payload, sendEmail } = payloadWith([
      { email: 'a@example.com' },
      { email: 'b@example.com' },
    ])

    await notifyFleetDigest(payload, EMPTY_DIGEST)

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@example.com', 'b@example.com'] }),
    )
  })

  // Mailing the void looks identical to a healthy run in every log, and the caller must not stamp.
  it('throws without sending when nobody is on the list', async () => {
    const { payload, sendEmail } = payloadWith([])

    await expect(notifyFleetDigest(payload, EMPTY_DIGEST)).rejects.toThrow(/Brak odbiorców/)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  // The kilometre leg is the one alarm with no date behind it, so nothing but this section's presence
  // tells a reader the car is overdue. It renders off `digest.odometer` alone — the interval is a
  // constant, with no per-vehicle target to consult (EX-745).
  it('renders the oil-interval section with the distance since the change', async () => {
    const { payload, sendEmail } = payloadWith([{ email: 'a@example.com' }])

    await notifyFleetDigest(payload, {
      ...EMPTY_DIGEST,
      odometer: [
        {
          inspectionId: 1,
          registration: 'QA 11111',
          make: 'Skoda',
          model: 'Octavia',
          kmSinceChange: 14500,
        },
      ],
    })

    const html = sendEmail.mock.calls[0]![0].html as string
    expect(html).toContain('Wymiana oleju — limit kilometrów')
    expect(html).toContain('QA 11111 Skoda Octavia')
    expect(html).toContain('14\u00a0500 km od ostatniej wymiany')
  })

  // The section is the whole signal: an empty „Wymiana oleju" block reads as „checked, nothing due"
  // on a mail that never checked.
  it('prints no oil-interval heading when the leg is empty', async () => {
    const { payload, sendEmail } = payloadWith([{ email: 'a@example.com' }])

    await notifyFleetDigest(payload, EMPTY_DIGEST)

    expect(sendEmail.mock.calls[0]![0].html as string).not.toContain('Wymiana oleju')
  })
})
