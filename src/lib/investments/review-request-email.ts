import type { Payload } from 'payload'
import { serverEnv } from '@/lib/env/server'
import { renderBrandedEmail } from '@/lib/email/branded-template'
import { BRAND_LOGO_URL } from '@/lib/email/brand-logo'

// Google place „Wykończymy.com.pl" (Terespolska 2, Warszawa). Logged out, Google sends the client
// through its login first — a review needs an account.
const GOOGLE_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJdwKTEzbNHkcRZA6UBMGUMdc'

/** Throws on failure. */
export async function sendReviewRequestEmail(payload: Payload, to: string): Promise<void> {
  const html = renderBrandedEmail({
    logoUrl: BRAND_LOGO_URL,
    paragraphs: [
      'Dzień dobry,',
      'dziękujemy za współpracę i okazane zaufanie. Mamy nadzieję, że efekt spełnia Państwa oczekiwania.',
      'Będziemy wdzięczni, jeśli znajdą Państwo chwilę, by podzielić się opinią o naszej pracy. Każda recenzja pomaga nam się rozwijać, a innym klientom znaleźć wykonawcę.',
      'Pozdrawiamy serdecznie,\nZespół Wykończymy',
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
