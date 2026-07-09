import { z } from 'zod'
import { normalizeLead } from './normalize-lead'
import type { LeadFieldT, LeadFormQuestionT } from './lead-schema'
import type { StoreLeadInputT } from './store-lead'

// A single field as emitted by the `wpforms_process_complete` forwarder snippet:
// the payload's `fields` is an object keyed by field id, each value carrying the
// human label (`name`), the submitted `value`, and the WPForms field `type`
// (email / text / select / textarea / …). `value` is a number for some field
// types, so accept both.
const wpformsFieldSchema = z.object({
  name: z.string(),
  value: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
})

export const wpformsSubmissionSchema = z.object({
  form_id: z.union([z.string(), z.number()]).optional(),
  form_name: z.string().optional(),
  entry_id: z.union([z.string(), z.number()]).optional(),
  fields: z.record(z.string(), wpformsFieldSchema),
})

export type WpformsSubmissionT = z.infer<typeof wpformsSubmissionSchema>

const asString = (value: string | number | undefined): string =>
  value === undefined ? '' : String(value)

/**
 * Project a validated WPForms submission into the shared StoreLead input.
 *
 * We key each answer by its **label** (`name`) rather than the field id, so the
 * existing `normalizeLead` label heuristics (/mail/, /telefon/, /imię|nazwisko/)
 * extract email/name/phone with no WPForms-specific code, and the /zgłoszenia
 * answers modal renders every field by its label. `type` rides along on
 * formQuestions (informational — WPForms types are lowercase, so they don't
 * collide with normalizeLead's Meta-typed pass, which harmlessly no-ops).
 *
 * `entry_id` is a stable per-submission id → `externalId` for idempotent dedup.
 * A WPForms Lite install without stored entries can send `0`; treat that as
 * "no id" so every such lead creates instead of all colliding on externalId "0".
 */
export function wpformsToStoreLeadInput(
  submission: WpformsSubmissionT,
  submittedAt: string,
): StoreLeadInputT {
  const fields = Object.values(submission.fields)

  const rawData: LeadFieldT[] = fields.map((field) => ({
    name: field.name,
    values: [asString(field.value)],
  }))
  const formQuestions: LeadFormQuestionT[] = fields.map((field) => ({
    key: field.name,
    label: field.name,
    type: field.type,
  }))

  const { email, name, phone } = normalizeLead(rawData)

  const entryId = Number(submission.entry_id) > 0 ? String(submission.entry_id) : undefined

  return {
    source: 'website_form',
    externalId: entryId,
    email,
    name,
    phone,
    rawData,
    formQuestions,
    formId: submission.form_id !== undefined ? String(submission.form_id) : undefined,
    formName: submission.form_name,
    submittedAt,
  }
}
