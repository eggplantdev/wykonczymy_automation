import type { Payload } from 'payload'
import { serverEnv } from '@/lib/env/server'
import { FRONTEND_URL } from '@/lib/env'
import { renderBrandedEmail } from '@/lib/email/branded-template'

// Google place „Wykończymy.com.pl" (Terespolska 2, Warszawa). Logged out, Google sends the client
// through its login first — a review needs an account.
const GOOGLE_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJdwKTEzbNHkcRZA6UBMGUMdc'

const LOGO_URL = `${FRONTEND_URL}/wykonczymy-app-icon.png`

/** Sent TO the client FROM `LEADS_REPLY_FROM`, like the lead auto-reply. Throws on failure. */
export async function sendReviewRequestEmail(payload: Payload, to: string): Promise<void> {
  const html = renderBrandedEmail({
    logoUrl: LOGO_URL,
    heading: 'Dziękujemy za wspólną realizację',
    paragraphs: [
      'Dzień dobry,',
      'dziękujemy, że powierzyli nam Państwo wykończenie wnętrza. Mamy nadzieję, że efekt spełnia Państwa oczekiwania.',
      'Będziemy bardzo wdzięczni za krótką opinię w Google — zajmie mniej niż minutę, a kolejnym klientom pomoże nas znaleźć.',
      'Pozdrawiamy,\nZespół Wykończymy',
    ],
    cta: { label: 'Wystaw opinię', href: GOOGLE_REVIEW_URL },
  })

  await payload.sendEmail({
    to,
    from: serverEnv.LEADS_REPLY_FROM,
    subject: 'Jak oceniają Państwo naszą pracę? — Wykończymy',
    html,
  })
}
