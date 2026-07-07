import { describe, it, expect, vi, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { notifyNewLead, notifyShapeAlert, sendAutoReply } from '@/lib/leads/notify'

beforeAll(() => {
  process.env.LEADS_NOTIFY_EMAIL = 'inbox@example.com'
  process.env.LEADS_ALERT_EMAIL = 'ops@example.com'
  process.env.LEADS_REPLY_FROM = 'admin@wykonczymy.com.pl'
})

const lead = {
  id: 1,
  source: 'facebook_lead_ads',
  name: 'Anna Nowak',
  email: 'anna.nowak@example.com',
  phone: '+48500600700',
  formName: 'komercyjnie - wwa',
  submittedAt: '2026-07-05T18:48:40.000Z',
  isTest: false,
} as unknown as Lead

const fakePayload = (sendEmail: ReturnType<typeof vi.fn>) => ({ sendEmail }) as unknown as Payload

describe('notifyNewLead', () => {
  it('sends the internal heads-up to LEADS_NOTIFY_EMAIL, never to the lead', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyNewLead(fakePayload(sendEmail), lead)

    expect(sendEmail).toHaveBeenCalledTimes(1)
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('inbox@example.com')
    expect(arg.to).not.toBe(lead.email)
    expect(arg.html).toContain('anna.nowak@example.com')
    expect(arg.subject).not.toContain('TEST')
  })

  it('marks the subject as TEST for a test lead', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyNewLead(fakePayload(sendEmail), { ...lead, isTest: true })
    expect(sendEmail.mock.calls[0][0].subject).toContain('[TEST]')
  })

  it('propagates a send failure so the caller can flip notifyStatus', async () => {
    const sendEmail = vi.fn().mockRejectedValue(new Error('smtp down'))
    await expect(notifyNewLead(fakePayload(sendEmail), lead)).rejects.toThrow('smtp down')
  })

  it('escapes HTML in lead values to avoid breaking the email body', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyNewLead(fakePayload(sendEmail), { ...lead, name: 'A<b>&"x' } as Lead)
    const html = sendEmail.mock.calls[0][0].html as string
    expect(html).toContain('A&lt;b&gt;&amp;')
    expect(html).not.toContain('A<b>')
  })
})

describe('sendAutoReply', () => {
  it('sends TO the lead, FROM the authenticated reply address', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await sendAutoReply(fakePayload(sendEmail), lead)

    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('anna.nowak@example.com')
    expect(arg.from).toBe('admin@wykonczymy.com.pl')
    expect(arg.subject).toContain('Dziękujemy za kontakt')
  })

  it('greets by first name and embeds the logo by absolute URL', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await sendAutoReply(fakePayload(sendEmail), lead)

    const html = sendEmail.mock.calls[0][0].html as string
    expect(html).toContain('Dzień dobry Anna,')
    expect(html).toMatch(/<img src="https?:\/\/[^"]+\/wykonczymy-app-icon\.png"/)
  })

  it('throws when the lead has no email (caller flips autoReplyStatus)', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await expect(
      sendAutoReply(fakePayload(sendEmail), { ...lead, email: null } as Lead),
    ).rejects.toThrow(/no email/)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('notifyShapeAlert', () => {
  it('alerts the ops inbox (LEADS_ALERT_EMAIL) with the leadgen_id and reason', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyShapeAlert(fakePayload(sendEmail), {
      leadgenId: '1000000000000001',
      reason: 'No email could be extracted from the lead',
    })
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('ops@example.com')
    expect(arg.html).toContain('1000000000000001')
    expect(arg.html).toContain('No email could be extracted')
  })
})
