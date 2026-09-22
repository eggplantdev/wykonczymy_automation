import type { MediaFileT } from '@/types/media'

export type LeadAnswerT = { label: string; value: string }

export type LeadSourceT = 'facebook_lead_ads' | 'website_form' | 'landing_form'

/**
 * A lead row as rendered in the `/zgloszenia` table. Cross-cutting: produced by
 * the server query (`lib/queries/leads.ts`) and consumed by the client columns
 * (`components/tables/leads.tsx`), so it lives here rather than in either module.
 */
export type LeadRowT = {
  id: number
  source: LeadSourceT
  name: string
  email: string
  phone: string
  // The landing's typed answers; all three empty on a Facebook lead, which cannot carry them.
  address: string
  scope: string
  area: string
  formName: string
  submittedAt: string | null
  contactStatus: 'new' | 'contacted'
  answers: LeadAnswerT[]
  assets: MediaFileT[]
  /** Set once the lead has been promoted — the button becomes a link to what it became. */
  investmentId: number | null
  /** What that inwestycja is called — the link says so instead of the generic word. */
  investmentName: string | null
  /** Every media id on it, so „Załączniki" can say which of the lead's files already travelled. */
  investmentAssetIds: number[]
}
