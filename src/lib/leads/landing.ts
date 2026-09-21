import { z } from 'zod'
import { leadFieldSchema, formQuestionSchema, toLeadFormQuestions } from './lead-schema'
import type { LeadFieldT, LeadFormQuestionT } from './lead-schema'
import type { StoreLeadInputT } from './store-lead'

/**
 * Second line of defence, not the binding one. The landing's `onBeforeGenerateToken` is where
 * Blob refuses an over-size upload before the file exists at all; this ceiling only decides how
 * many files we are willing to pull back across the wire.
 */
export const MAX_LANDING_ASSETS = 15

export const landingAssetSchema = z.object({
  url: z.url(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  // Declared by the sender: a hint that saves a round trip on an obviously oversized file.
  // The download counts bytes itself, so a lie here costs nothing.
  size: z.number().int().positive(),
})

export type LandingAssetT = z.infer<typeof landingAssetSchema>

// Strict on the envelope, permissive on the tail — the rule `leadSchema` already follows. The
// landing may add a question without a coordinated deploy here; it may not change what identifies
// a submission.
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
  message: z.string().optional(),
  rawData: z.array(leadFieldSchema).optional(),
  formQuestions: z.array(formQuestionSchema).optional(),
  assets: z.array(landingAssetSchema).max(MAX_LANDING_ASSETS).optional(),
})

export type LandingSubmissionT = z.infer<typeof landingSubmissionSchema>

// The landing's own fields, in the order they are asked. Doubles as the fallback answer list when
// the sender omits `rawData` — without it a landing lead would render an empty „Treść formularza".
const TYPED_ANSWERS = [
  ['name', 'Imię i nazwisko'],
  ['email', 'Email'],
  ['phone', 'Telefon'],
  ['address', 'Adres'],
  ['scope', 'Zakres prac'],
  ['area', 'Metraż'],
  ['message', 'Wiadomość'],
] as const

/**
 * Project a validated landing submission into the shared StoreLead input, mirroring
 * `wpformsToStoreLeadInput`.
 *
 * Carries no `assets`: the route attaches them in a second write, after the lead is durable, so a
 * slow or failing download can never cost the enquiry itself.
 *
 * `submissionId` is the landing's per-submission uuid → `externalId`, which is what makes a
 * redelivery from its retry queue idempotent.
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
