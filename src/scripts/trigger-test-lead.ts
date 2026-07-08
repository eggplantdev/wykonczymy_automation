// LOCAL one-off: send the branded customer auto-reply to a real inbox so you can
// eyeball the template. Bypasses notify.ts (which imports server-only env.server and
// can't load under a tsx CLI) — renders the same HTML and sends directly.
//
// RUN: node --env-file=.env --import tsx src/scripts/trigger-test-lead.ts
//
// SAFETY: sends one real email. Local DB not touched.
import { getPayload } from 'payload'
import config from '@payload-config'
import { renderBrandedEmail } from '@/lib/leads/email-template'

const TO = 'konradantonik@gmail.com'

async function main(): Promise<void> {
  const payload = await getPayload({ config })

  const html = renderBrandedEmail({
    logoUrl: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/wykonczymy-app-icon.png`,
    heading: 'Dziękujemy za kontakt',
    paragraphs: [
      'Dzień dobry,',
      'Dziękujemy za przesłanie zgłoszenia. Odezwiemy się najszybciej, jak to możliwe.',
      'Pozdrawiamy,\nZespół Wykończymy',
    ],
    footer: 'To wiadomość wysłana automatycznie — nie musisz na nią odpowiadać.',
  })

  await payload.sendEmail({
    to: TO,
    from: process.env.LEADS_REPLY_FROM,
    subject: 'Dziękujemy za kontakt — Wykończymy',
    html,
  })
  console.log(`[trigger-test-lead] branded auto-reply sent to ${TO}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[trigger-test-lead]', err)
    process.exit(1)
  })
