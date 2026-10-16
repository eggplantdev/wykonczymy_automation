import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { serverEnv } from '@/lib/env/server'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { wpformsSubmissionSchema, wpformsToStoreLeadInput } from '@/lib/leads/wpforms'
import { captureLead } from '@/lib/leads/capture-lead'
import { notifyShapeAlert } from '@/lib/leads/notify'
import { logError } from '@/lib/utils/log-error'

/**
 * WPForms Lite does NOT persist entries, so this POST is often the ONLY durable
 * capture of the lead.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('x-webhook-secret') !== serverEnv.WPFORMS_WEBHOOK_SECRET) {
    console.warn('[wpforms] Bad or missing X-Webhook-Secret — rejecting')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const raw = await request.text()

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    logError('[wpforms] Body was not valid JSON', raw.slice(0, 500))
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  const parsed = wpformsSubmissionSchema.safeParse(json)
  if (!parsed.success) {
    logError('[wpforms] Submission failed schema validation', parsed.error.message)
    await notifyShapeAlert(payload, {
      leadgenId: 'wpforms',
      reason: `WPForms submission failed schema validation: ${parsed.error.message}`,
      raw: json,
    }).catch((err) => logError('[wpforms] Shape alert failed', err))
    return NextResponse.json({ error: 'Bad shape' }, { status: 400 })
  }

  const submittedAt = new Date().toISOString()
  const input = wpformsToStoreLeadInput(parsed.data, submittedAt)

  if (!input.email) {
    await notifyShapeAlert(payload, {
      leadgenId: `wpforms form ${input.formId ?? '?'}`,
      reason: 'No email could be extracted from the WPForms submission',
      raw: parsed.data,
    }).catch((err) => logError('[wpforms] Shape alert failed', err))
  }

  try {
    await captureLead(payload, input)
  } catch (err) {
    logError('[wpforms] Failed to capture lead', err)
    return NextResponse.json({ error: 'Capture failed' }, { status: 500 })
  }

  revalidateTag(CACHE_TAGS.leads, EXPIRE_NOW)
  return NextResponse.json({ received: true }, { status: 200 })
}
