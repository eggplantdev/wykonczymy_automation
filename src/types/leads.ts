export type LeadAnswerT = { label: string; value: string }

/**
 * A lead row as rendered in the `/zgloszenia` table. Cross-cutting: produced by
 * the server query (`lib/queries/leads.ts`) and consumed by the client columns
 * (`lib/tables/leads.tsx`), so it lives here rather than in either module.
 */
export type LeadRowT = {
  id: number
  name: string
  email: string
  phone: string
  formName: string
  submittedAt: string | null
  contactStatus: 'new' | 'contacted'
  answers: LeadAnswerT[]
}
