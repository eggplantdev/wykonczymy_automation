import { describe, it, expect, vi, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import {
  notifyNewLead,
  notifyShapeAlert,
  notifyReconcileRecovery,
  sendAutoReply,
} from '@/lib/leads/notify'

beforeAll(() => {
  // LEADS_REPLY_FROM stays env-borne: it is a sender identity, not a recipient list.
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
} as unknown as Lead

const fakePayload = (sendEmail: ReturnType<typeof vi.fn>) =>
  ({
    sendEmail,
    findGlobal: vi.fn().mockResolvedValue({
      fleetDigest: [{ email: 'flota@example.com' }],
      newLead: [{ email: 'inbox@example.com' }],
      opsAlerts: [{ email: 'ops@example.com' }],
    }),
  }) as unknown as Payload

describe('notifyNewLead', () => {
  it('sends the internal heads-up to the newLead recipients, never to the lead', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyNewLead(fakePayload(sendEmail), lead)

    expect(sendEmail).toHaveBeenCalledTimes(1)
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toEqual(['inbox@example.com'])
    expect(arg.to).not.toContain(lead.email)
    expect(arg.html).toContain('anna.nowak@example.com')
    expect(arg.subject).not.toContain('TEST')
  })

  // The announced count is the only one that exists at send time — the landing stores the files
  // after this mail goes out, so a mail built from `lead.assets` would say „bez załączników" for
  // every enquiry that came with photos.
  it('reports the announced attachment count and links to the zgłoszenie', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyNewLead(fakePayload(sendEmail), lead, { expectedAssets: 2 })

    const html = sendEmail.mock.calls[0][0].html as string
    expect(html).toContain('Załączniki:</strong> 2')
    expect(html).not.toContain('Bez załączników')
    expect(html).toContain(`?search=${encodeURIComponent('anna.nowak@example.com')}`)
  })

  it('prefers the files the lead already holds over the announced count', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    const withAssets = { ...lead, assets: [11, 12, 13] } as unknown as Lead
    await notifyNewLead(fakePayload(sendEmail), withAssets, { expectedAssets: 1 })

    expect(sendEmail.mock.calls[0][0].html as string).toContain('Załączniki:</strong> 3')
  })

  it('says so when nothing came with the enquiry', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyNewLead(fakePayload(sendEmail), lead)

    expect(sendEmail.mock.calls[0][0].html as string).toContain('Bez załączników')
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

  it('includes the form answers (label + value) so the team sees the full submission', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    const withAnswers = {
      ...lead,
      rawData: [{ name: 'budzet', values: ['50 tys'] }],
      formQuestions: [{ key: 'budzet', label: 'Budżet' }],
    } as unknown as Lead
    await notifyNewLead(fakePayload(sendEmail), withAnswers)
    const html = sendEmail.mock.calls[0][0].html as string
    expect(html).toContain('Budżet')
    expect(html).toContain('50 tys')
  })

  it('drops answers that only repeat the name/email/phone shown in the header', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    const withDupes = {
      ...lead,
      rawData: [
        { name: 'full name', values: [lead.name] },
        { name: 'email', values: [lead.email] },
        { name: 'budzet', values: ['50 tys'] },
      ],
      formQuestions: [
        { key: 'full name', label: 'Pełna nazwa' },
        { key: 'email', label: 'Kontakt mailowy' },
        { key: 'budzet', label: 'Budżet' },
      ],
    } as unknown as Lead
    await notifyNewLead(fakePayload(sendEmail), withDupes)
    const html = sendEmail.mock.calls[0][0].html as string
    expect(html).not.toContain('Pełna nazwa')
    expect(html).not.toContain('Kontakt mailowy')
    expect(html).toContain('Budżet')
  })
})

describe('sendAutoReply', () => {
  // Assert the routing contract only — NOT the copy. Wording churns constantly;
  // template mechanics (logo, escaping, line breaks) are covered in email-template.test.ts.
  it('sends TO the lead, FROM the authenticated reply address, with the logo embedded', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await sendAutoReply(fakePayload(sendEmail), lead)

    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toBe('anna.nowak@example.com')
    expect(arg.from).toBe('admin@wykonczymy.com.pl')
    expect(arg.html).toMatch(/<img src="https?:\/\/[^"]+\/wykonczymy-app-icon\.png"/)
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
  it('alerts the opsAlerts recipients with the leadgen_id and reason', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyShapeAlert(fakePayload(sendEmail), {
      leadgenId: '1000000000000001',
      reason: 'No email could be extracted from the lead',
    })
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toEqual(['ops@example.com'])
    expect(arg.html).toContain('1000000000000001')
    expect(arg.html).toContain('No email could be extracted')
  })
})

describe('notifyReconcileRecovery', () => {
  const recovered = [
    {
      id: 11,
      name: 'Anna Nowak',
      formName: 'komercyjnie - wwa',
      submittedAt: '2026-07-05T18:48:40.000Z',
    },
  ]

  // Since EX-660 each recovered lead reaches sales through the ordinary notifyNewLead,
  // so this mail is an ops signal about the dead webhook — not a second copy of the
  // lead. Sending it to the sales inbox would just duplicate what they already have.
  it('goes to ops alone and lists the recovered leads as an audit trail', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyReconcileRecovery(fakePayload(sendEmail), { recovered, scanned: 30 })

    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toEqual(['ops@example.com'])
    expect(arg.html).toContain('Anna Nowak')
    expect(arg.html).toContain('komercyjnie - wwa')
  })

  it('escapes HTML in recovered lead values', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyReconcileRecovery(fakePayload(sendEmail), {
      recovered: [{ ...recovered[0], name: 'A<b>&"x' }],
      scanned: 30,
    })

    const html = sendEmail.mock.calls[0][0].html as string
    expect(html).toContain('A&lt;b&gt;&amp;')
    expect(html).not.toContain('A<b>')
  })

  it('derives the count from the list so the two can never disagree', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await notifyReconcileRecovery(fakePayload(sendEmail), {
      recovered: [recovered[0], { ...recovered[0], id: 12 }],
      scanned: 30,
    })

    expect(sendEmail.mock.calls[0][0].subject).toContain('2')
  })
})
