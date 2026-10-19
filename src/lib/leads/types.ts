import type { MediaFileT } from '@/types/media'

export type LeadAnswerT = { label: string; value: string }

export type LeadSourceT = 'facebook_lead_ads' | 'website_form' | 'landing_form'

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
  investmentId: number | null
  investmentName: string | null
  investmentAssetIds: number[]
}
