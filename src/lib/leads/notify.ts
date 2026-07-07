import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { serverEnv } from '@/lib/env.server'
import { FRONTEND_URL } from '@/lib/env'
import { renderBrandedEmail } from './email-template'

// Absolute URL — email clients can't resolve relative paths. Served from public/.
const LOGO_URL = `${FRONTEND_URL}/wykonczymy-app-icon.png`

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const row = (label: string, value?: string | null): string =>
  value ? `<tr><td><strong>${label}:</strong></td><td>${escapeHtml(value)}</td></tr>` : ''

/**
 * Internal heads-up that a new lead landed — always to `LEADS_NOTIFY_EMAIL`,
 * never to the lead. Throws on send failure so the caller can flip
 * `notifyStatus` to `failed` (the lead itself is already persisted).
 */
export async function notifyNewLead(payload: Payload, lead: Lead): Promise<void> {
  const subject = lead.isTest
    ? '[TEST] Nowe zgłoszenie — Wykończymy'
    : 'Nowe zgłoszenie — Wykończymy'

  const html = `
    <h2>Nowe zgłoszenie${lead.isTest ? ' (testowe)' : ''}</h2>
    <table>
      ${row('Imię i nazwisko', lead.name)}
      ${row('Email', lead.email)}
      ${row('Telefon', lead.phone)}
      ${row('Formularz', lead.formName)}
      ${row('Data', lead.submittedAt)}
    </table>
  `

  await payload.sendEmail({ to: serverEnv.LEADS_NOTIFY_EMAIL, subject, html })
}

/**
 * Safety net: a fetched lead failed schema validation or arrived without an
 * expected email. Alerts the ops/dev inbox (`LEADS_ALERT_EMAIL`) instead of
 * leaving a silent gap. Best-effort — failure here must not break capture, so
 * the caller does not await-throw on it.
 */
export async function notifyShapeAlert(
  payload: Payload,
  context: { leadgenId: string; reason: string; raw?: unknown },
): Promise<void> {
  const html = `
    <h2>⚠️ Zgłoszenie wymaga uwagi</h2>
    <p><strong>leadgen_id:</strong> ${escapeHtml(context.leadgenId)}</p>
    <p><strong>Powód:</strong> ${escapeHtml(context.reason)}</p>
    ${context.raw ? `<pre>${escapeHtml(JSON.stringify(context.raw, null, 2))}</pre>` : ''}
  `

  await payload.sendEmail({
    to: serverEnv.LEADS_ALERT_EMAIL,
    subject: '⚠️ Zgłoszenie wymaga uwagi - formularz ma niespodziewaną strukturę — Wykończymy',
    html,
  })
}

/**
 * Customer-facing confirmation ("we got your contact") — sent TO the lead, FROM
 * `LEADS_REPLY_FROM` (an SPF/DKIM-authenticated domain, so it doesn't spam-folder).
 * Assumes `lead.email` is present; the caller skips this send for phone-only and
 * test leads. Throws on failure so the caller can flip `autoReplyStatus`.
 */
export async function sendAutoReply(payload: Payload, lead: Lead): Promise<void> {
  if (!lead.email) throw new Error('sendAutoReply called for a lead with no email')

  const html = renderBrandedEmail({
    logoUrl: LOGO_URL,
    heading: 'Dziękujemy za kontakt',
    paragraphs: [
      'Dzień dobry,',
      'Dziękujemy za przesłanie zgłoszenia. Odezwiemy się najszybciej, jak to możliwe.',
      'Pozdrawiamy,\nZespół Wykończymy',
    ],
    footer: 'To wiadomość wysłana automatycznie — nie musisz na nią odpowiadać.',
  })

  await payload.sendEmail({
    to: lead.email,
    from: serverEnv.LEADS_REPLY_FROM,
    subject: 'Dziękujemy za kontakt — Wykończymy',
    html,
  })
}
