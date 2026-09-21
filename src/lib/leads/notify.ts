import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { serverEnv } from '@/lib/env/server'
import { FRONTEND_URL } from '@/lib/env'
import { requireRecipients } from '@/lib/email/recipients'
import { renderBrandedEmail } from './email-template'
import { buildLeadAnswers } from './lead-answers'
import { leadRawDataSchema, leadFormQuestionsSchema } from './lead-schema'
import { escapeHtml } from '@/lib/utils/escape-html'
import { uploadFieldIds } from '@/lib/media/upload-field'
import type { RecoveredLeadT } from './reconcile-sweep'

// Absolute URL — email clients can't resolve relative paths. Served from public/.
const LOGO_URL = `${FRONTEND_URL}/wykonczymy-app-icon.png`

const row = (label: string, value?: string | null): string =>
  value ? `<tr><td><strong>${label}:</strong></td><td>${escapeHtml(value)}</td></tr>` : ''

/**
 * The list has no per-row address, and its search box spans name/email/phone/formName
 * (`lib/queries/leads.ts`) — so the narrowest identifier the lead carries narrows the list to it.
 */
function leadUrl(lead: Lead): string {
  const term = lead.email ?? lead.phone ?? lead.name
  const base = `${FRONTEND_URL}/zgloszenia`
  return term ? `${base}?search=${encodeURIComponent(term)}` : base
}

export type NotifyNewLeadOptionsT = {
  /**
   * How many files the submission ANNOUNCED. The landing stores them after this mail is sent, so
   * nothing else can answer „czy są zdjęcia" at this point — and a promised file that fails to
   * download raises its own `notifyAssetFailure` to ops rather than silently contradicting this one.
   */
  expectedAssets?: number
}

/**
 * Internal heads-up that a new lead landed — always to the `newLead` recipients,
 * never to the lead. Throws on send failure so the caller can flip
 * `notifyStatus` to `failed` (the lead itself is already persisted).
 */
export async function notifyNewLead(
  payload: Payload,
  lead: Lead,
  options: NotifyNewLeadOptionsT = {},
): Promise<void> {
  const subject = 'Nowe zgłoszenie — Wykończymy'

  // The standard name/email/phone are already in the header block above; drop any
  // answer that just repeats one of them so the section shows only the extra fields.
  const shownUpTop = new Set([lead.name, lead.email, lead.phone].filter(Boolean))
  const answers = buildLeadAnswers(
    leadRawDataSchema.parse(lead.rawData),
    leadFormQuestionsSchema.parse(lead.formQuestions),
  ).filter((answer) => !shownUpTop.has(answer.value))
  const answersHtml = answers.length
    ? `<h3>Treść formularza</h3>
    <table>
      ${answers.map((answer) => row(escapeHtml(answer.label), answer.value)).join('\n      ')}
    </table>`
    : ''

  // The files themselves cannot ride along, and at send time the lead usually does not hold them
  // yet — the landing downloads them only AFTER the lead is stored
  // (`api/webhooks/landing/route.ts`). So the count comes from what the caller was HANDED, and the
  // already-attached set only wins on a redelivery, where it is the one that is real.
  const attached = uploadFieldIds(lead.assets).length
  const assetCount = attached || (options.expectedAssets ?? 0)
  const assetsHtml = assetCount
    ? `<p><strong>Załączniki:</strong> ${assetCount}</p>`
    : '<p>Bez załączników.</p>'

  const html = `
    <h2>Nowe zgłoszenie</h2>
    <table>
      ${row('Imię i nazwisko', lead.name)}
      ${row('Email', lead.email)}
      ${row('Telefon', lead.phone)}
      ${row('Formularz', lead.formName)}
      ${row('Data', lead.submittedAt)}
    </table>
    ${answersHtml}
    ${assetsHtml}
    <p><a href="${leadUrl(lead)}">Otwórz zgłoszenie</a></p>
  `

  await payload.sendEmail({ to: await requireRecipients(payload, 'newLead'), subject, html })
}

/**
 * Safety net: a fetched lead failed schema validation or arrived without an
 * expected email. Alerts the `opsAlerts` recipients instead of
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
    to: await requireRecipients(payload, 'opsAlerts'),
    subject: '⚠️ Zgłoszenie wymaga uwagi - formularz ma niespodziewaną strukturę — Wykończymy',
    html,
  })
}

/**
 * A landing submission arrived and was stored, but some of its files could not be pulled from the
 * landing's blob store. The lead is NOT at risk here — that is the whole point of the subject line:
 * an ops eye must read „przyszło, brakuje zdjęć", not „coś się zepsuło, zgłoszenie przepadło".
 *
 * The failed urls are listed because they are still live in the landing's store until its queue row
 * is deleted, so this mail is a recovery instruction, not just a record.
 */
export async function notifyAssetFailure(
  payload: Payload,
  context: { submissionId: string; failed: { url: string; reason: string }[]; stored: number },
): Promise<void> {
  const failedHtml = context.failed
    .map((asset) => `<li><code>${escapeHtml(asset.url)}</code> — ${escapeHtml(asset.reason)}</li>`)
    .join('\n      ')

  const html = `
    <h2>⚠️ Zgłoszenie zapisane, ale bez części plików</h2>
    <p><strong>ID zgłoszenia:</strong> ${escapeHtml(context.submissionId)}</p>
    <p>Zapisane pliki: <strong>${context.stored}</strong>. Nie udało się pobrać
    <strong>${context.failed.length}</strong>:</p>
    <ul>
      ${failedHtml}
    </ul>
    <p>Pliki są jeszcze dostępne pod powyższymi adresami — można je pobrać i dodać ręcznie.</p>
    <p><a href="${FRONTEND_URL}/zgloszenia">Otwórz zgłoszenia</a></p>
  `

  await payload.sendEmail({
    to: await requireRecipients(payload, 'opsAlerts'),
    subject: '⚠️ Zgłoszenie bez części plików — Wykończymy',
    html,
  })
}

/**
 * The daily reconcile sweep recovered leads the webhook never delivered — which
 * means the webhook itself is broken, not that the sweep did its job. Without this
 * mail the cron would patch a dead delivery path forever and nobody would know.
 * Silent on a clean run. Best-effort: the leads are already persisted, so a send
 * failure must not fail the cron.
 *
 * Goes to ops alone, and lists the recovered leads as an audit trail rather than a
 * call list: since EX-660 each one reaches sales through the ordinary `notifyNewLead`,
 * so repeating their contact details here would only duplicate a mail sales already
 * has. The one thing this mail is for is the broken webhook.
 */
export async function notifyReconcileRecovery(
  payload: Payload,
  context: { recovered: RecoveredLeadT[]; scanned: number; saturatedForms?: string[] },
): Promise<void> {
  const added = context.recovered.length
  const recoveredHtml = context.recovered
    .map(
      (lead) => `<table>
      ${row('Imię i nazwisko', lead.name)}
      ${row('Formularz', lead.formName)}
      ${row('Data', lead.submittedAt)}
    </table>`,
    )
    .join('\n    ')

  // A saturated form is the dangerous case: the sweep hit its per-form page limit,
  // so anything older fell outside the window and tomorrow's page is a newer set.
  // Without this the mail reads like a clean full recovery while leads are lost.
  const saturationHtml = context.saturatedForms?.length
    ? `<p><strong>Uwaga:</strong> formularze ${escapeHtml(context.saturatedForms.join(', '))}
      zwróciły pełną stronę wyników — starsze zgłoszenia mogą być poza zasięgiem sweepa.
      Pobierz je ręcznie z panelu Meta.</p>`
    : ''

  const html = `
    <h2>⚠️ Cron odzyskał zgłoszenia pominięte przez webhook</h2>
    <p>Odzyskane: <strong>${added}</strong> z ${context.scanned} sprawdzonych.</p>
    <p>Handlowcy dostali za każde z nich zwykłe powiadomienie „Nowe zgłoszenie” —
    poniższa lista jest tylko śladem audytowym. Klienci nie dostali automatycznej
    odpowiedzi: po kilku dniach byłaby gorsza niż jej brak.</p>
    <p><strong>Do zrobienia jest webhook, nie te zgłoszenia.</strong></p>
    ${recoveredHtml}
    <p><a href="${FRONTEND_URL}/zgloszenia">Otwórz zgłoszenia</a></p>
    <p>Webhook Meta nie dostarczył tych zgłoszeń. Sprawdź <code>callback_url</code>
    aplikacji, subskrypcję strony i ważność tokena.</p>
    ${saturationHtml}
  `

  await payload.sendEmail({
    to: await requireRecipients(payload, 'opsAlerts'),
    subject: `⚠️ Cron odzyskał ${added} zgłoszeń — webhook nie dowozi — Wykończymy`,
    html,
  })
}

/**
 * The reconcile sweep itself failed. Without this mail the backstop is exactly as
 * silent as the webhook it guards: one expired token kills both, and nothing but a
 * Vercel log line records that leads have been dropping for weeks. Best-effort, for
 * the same reason as the recovery alert.
 */
export async function notifyReconcileFailure(
  payload: Payload,
  context: { reason: string; failedForms?: string[] },
): Promise<void> {
  const formsHtml = context.failedForms?.length
    ? `<p><strong>Formularze:</strong> ${escapeHtml(context.failedForms.join(', '))}</p>`
    : ''

  const html = `
    <h2>🚨 Cron odzyskiwania zgłoszeń nie zadziałał</h2>
    <p><strong>Powód:</strong> ${escapeHtml(context.reason)}</p>
    ${formsHtml}
    <p>Backstop nie działa — jeśli webhook też nie dowozi, zgłoszenia przepadają.
    Sprawdź ważność tokena Meta i status Graph API.</p>
  `

  await payload.sendEmail({
    to: await requireRecipients(payload, 'opsAlerts'),
    subject: '🚨 Cron odzyskiwania zgłoszeń nie zadziałał — Wykończymy',
    html,
  })
}

/**
 * Customer-facing confirmation ("we got your contact") — sent TO the lead, FROM
 * `LEADS_REPLY_FROM` (an SPF/DKIM-authenticated domain, so it doesn't spam-folder).
 * Assumes `lead.email` is present; the caller skips this send for phone-only
 * leads. Throws on failure so the caller can flip `autoReplyStatus`.
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
