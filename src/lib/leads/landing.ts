import { z } from 'zod'
import { leadFieldSchema, formQuestionSchema, toLeadFormQuestions } from './lead-schema'
import type { LeadFieldT, LeadFormQuestionT } from './lead-schema'
import type { StoreLeadInputT } from './store-lead'

export const MAX_LANDING_ASSETS = 15

export const landingAssetSchema = z.object({
  url: z.url(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
})

export type LandingAssetT = z.infer<typeof landingAssetSchema>

export const landingSubmissionSchema = z.object({
  submissionId: z.uuid(),
  locale: z.string().optional(),
  submittedAt: z.string().optional(),
  formId: z.string().optional(),
  formName: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  scope: z.string().optional(),
  area: z.string().optional(),
  timing: z.string().optional(),
  message: z.string().optional(),
  rawData: z.array(leadFieldSchema).optional(),
  formQuestions: z.array(formQuestionSchema).optional(),
  assets: z.array(landingAssetSchema).max(MAX_LANDING_ASSETS).optional(),
})

export type LandingSubmissionT = z.infer<typeof landingSubmissionSchema>

// Doubles as the fallback answer list when
// the sender omits `rawData` — without it a landing lead would render an empty „Treść formularza".
const TYPED_ANSWERS = [
  ['name', 'Imię i nazwisko'],
  ['email', 'Email'],
  ['phone', 'Telefon'],
  ['address', 'Adres'],
  ['scope', 'Zakres prac'],
  ['area', 'Metraż'],
  ['timing', 'Termin rozpoczęcia prac'],
  ['message', 'Wiadomość'],
] as const

/**
 * Carries no `assets`: the route attaches them in a second write, after the lead is durable, so a
 * slow or failing download can never cost the enquiry itself.
 */
export function landingToStoreLeadInput(submission: LandingSubmissionT): StoreLeadInputT {
  const rawData: LeadFieldT[] =
    submission.rawData ??
    TYPED_ANSWERS.flatMap(([field]) => {
      const value = submission[field]
      return value ? [{ name: field, values: [value] }] : []
    })

  const formQuestions: LeadFormQuestionT[] = submission.formQuestions
    ? toLeadFormQuestions(submission.formQuestions)
    : TYPED_ANSWERS.map(([key, label]) => ({ key, label }))

  return {
    source: 'landing_form',
    externalId: submission.submissionId,
    email: submission.email,
    name: submission.name,
    phone: submission.phone,
    address: submission.address,
    scope: submission.scope,
    area: submission.area,
    rawData,
    formQuestions,
    formId: submission.formId,
    formName: submission.formName,
    submittedAt: submission.submittedAt,
  }
}
