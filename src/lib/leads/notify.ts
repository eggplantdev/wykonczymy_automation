import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { serverEnv } from '@/lib/env.server'

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
 * expected email. Alerts a human instead of leaving a silent gap. Best-effort —
 * failure here must not break capture, so the caller does not await-throw on it.
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
    to: serverEnv.LEADS_NOTIFY_EMAIL,
    subject: '⚠️ Zgłoszenie wymaga uwagi — Wykończymy',
    html,
  })
}
