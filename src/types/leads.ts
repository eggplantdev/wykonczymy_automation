export type LeadAnswerT = { label: string; value: string }

/**
 * A lead row as rendered in the `/zgloszenia` table. Cross-cutting: produced by
 * the server query (`lib/queries/leads.ts`) and consumed by the client columns
 * (`components/tables/leads.tsx`), so it lives here rather than in either module.
 */
export type LeadSourceT = 'facebook_lead_ads' | 'website_form'

export type LeadRowT = {
  id: number
  source: LeadSourceT
  name: string
  email: string
  phone: string
  formName: string
  submittedAt: string | null
  contactStatus: 'new' | 'contacted'
  answers: LeadAnswerT[]
}
