import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { landingSubmissionSchema, landingToStoreLeadInput } from '@/lib/leads/landing'
import { verifySignature } from '@/lib/leads/verify-signature'
import { LANDING_SUBMISSION } from '@/__tests__/fixtures/landing-submission'

describe('landingSubmissionSchema', () => {
  it('accepts the shared fixture', () => {
    expect(landingSubmissionSchema.safeParse(LANDING_SUBMISSION).success).toBe(true)
  })

  // The envelope is the half of the contract the landing may NOT change unilaterally.
  it('rejects a submission without a uuid submissionId', () => {
    expect(
      landingSubmissionSchema.safeParse({ ...LANDING_SUBMISSION, submissionId: 'not-a-uuid' })
        .success,
    ).toBe(false)
  })

  // The other half is deliberately open: the landing adds a question without a deploy here.
  it('tolerates an unknown extra field', () => {
    const parsed = landingSubmissionSchema.safeParse({ ...LANDING_SUBMISSION, budget: '50 000 zł' })
    expect(parsed.success).toBe(true)
  })

  it('refuses more assets than the ceiling allows', () => {
    const many = Array.from({ length: 16 }, () => LANDING_SUBMISSION.assets![0])
    expect(landingSubmissionSchema.safeParse({ ...LANDING_SUBMISSION, assets: many }).success).toBe(
      false,
    )
  })

  it('verifies a signature computed over the serialised fixture', () => {
    const raw = JSON.stringify(LANDING_SUBMISSION)
    const secret = 'shared-landing-secret'
    const key = createHmac('sha256', secret).update('landing-submission', 'utf8').digest()
    const signature = 'sha256=' + createHmac('sha256', key).update(raw, 'utf8').digest('hex')

    expect(verifySignature(raw, signature, secret, 'landing-submission')).toBe(true)
    expect(verifySignature(raw + ' ', signature, secret, 'landing-submission')).toBe(false)
  })
})

describe('landingToStoreLeadInput', () => {
  it('maps the typed answers', () => {
    const input = landingToStoreLeadInput(LANDING_SUBMISSION)

    expect(input.source).toBe('landing_form')
    expect(input.externalId).toBe(LANDING_SUBMISSION.submissionId)
    expect(input.email).toBe('anna.nowak@example.com')
    expect(input.address).toBe('ul. Kwiatowa 12, Kraków')
    expect(input.area).toBe('30–60 m²')
  })

  // Without this fallback the answers modal renders an empty „Treść formularza" for every landing
  // lead, because the landing sends typed fields rather than Meta's rawData shape.
  it('synthesises rawData and labels from the typed answers when none were sent', () => {
    const input = landingToStoreLeadInput(LANDING_SUBMISSION)

    expect(input.rawData).toContainEqual({ name: 'scope', values: ['Remont łazienki i kuchni'] })
    expect(input.formQuestions).toContainEqual({ key: 'scope', label: 'Zakres prac' })
  })

  it('prefers a rawData the sender supplied', () => {
    const input = landingToStoreLeadInput({
      ...LANDING_SUBMISSION,
      rawData: [{ name: 'budget', values: ['50 000 zł'] }],
    })

    expect(input.rawData).toEqual([{ name: 'budget', values: ['50 000 zł'] }])
  })
})
