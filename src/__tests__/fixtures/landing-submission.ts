import type { LandingSubmissionT } from '@/lib/leads/landing'

/**
 * The envelope both repos agree on, pinned by one fixture committed byte-identically here and in
 * `landing_26`. The contract is duplicated rather than packaged (recorded 2026-09-18 decision), so
 * this file is what stops the two copies drifting silently — a sender-side change that breaks it
 * breaks a test on both sides.
 *
 * All PII is fabricated.
 */
export const LANDING_SUBMISSION: LandingSubmissionT = {
  submissionId: '9f2c1b64-7d3a-4e58-9a10-6c5b2e8f4d71',
  submittedAt: '2026-09-21T09:15:00.000Z',
  formId: 'wycena',
  formName: 'Formularz wyceny',
  name: 'Anna Nowak',
  email: 'anna.nowak@example.com',
  phone: '+48511222333',
  address: 'ul. Kwiatowa 12, Kraków',
  scope: 'Remont łazienki i kuchni',
  area: '30–60 m²',
  timing: 'Jak najszybciej, najpóźniej za miesiąc',
  message: 'Proszę o kontakt po 16:00.',
  // Under `leads/<submissionId>/`, because that prefix is what the landing's upload token is pinned
  // to and what its cleanup deletes — an asset url at the store root would pass every check here and
  // still be unreachable by the half of the contract that reclaims it.
  assets: [
    {
      url: 'https://landing-assets.public.blob.vercel-storage.com/leads/9f2c1b64-7d3a-4e58-9a10-6c5b2e8f4d71/lazienka-a1b2c3.jpg',
      filename: 'lazienka.jpg',
      contentType: 'image/jpeg',
      size: 482_311,
    },
    {
      url: 'https://landing-assets.public.blob.vercel-storage.com/leads/9f2c1b64-7d3a-4e58-9a10-6c5b2e8f4d71/rzut-d4e5f6.pdf',
      filename: 'rzut.pdf',
      contentType: 'application/pdf',
      size: 118_904,
    },
  ],
}

/** The host `LANDING_BLOB_HOST` must be set to for the fixture's asset urls to be accepted. */
export const LANDING_FIXTURE_HOST = 'landing-assets.public.blob.vercel-storage.com'
