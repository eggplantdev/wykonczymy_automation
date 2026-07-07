import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { serverEnv } from '@/lib/env.server'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { verifySignature } from '@/lib/leads/verify-signature'
import { fetchLead } from '@/lib/leads/fetch-lead'
import { leadSchema } from '@/lib/leads/lead-schema'
import { normalizeLead } from '@/lib/leads/normalize-lead'
import { captureLead } from '@/lib/leads/capture-lead'
import { notifyShapeAlert } from '@/lib/leads/notify'

/**
 * GET /api/webhooks/facebook-leads
 * Meta webhook verification challenge (one-time handshake).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === serverEnv.META_VERIFY_TOKEN) {
    console.log('[facebook-leads] Webhook verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  console.log('[facebook-leads] Webhook verification failed', { mode, token })
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * POST /api/webhooks/facebook-leads
 * Meta delivers only a leadgen_id per lead; the field data (name, email, phone)
 * is fetched with a Page token in a second authenticated call, then persisted.
 *
 * Signature is verified over the RAW body — read the bytes once as text and
 * JSON.parse from that same string (re-serializing would break the HMAC).
 * Store-then-notify ordering means a mail failure never loses a lead.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()

  if (
    !verifySignature(raw, request.headers.get('x-hub-signature-256'), serverEnv.META_APP_SECRET)
  ) {
    console.warn('[facebook-leads] Signature verification failed — rejecting')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = JSON.parse(raw)
  const payload = await getPayload({ config })
  let captured = 0

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const leadgenId = change.value?.leadgen_id
      if (!leadgenId) continue

      const fetched = await fetchLead(leadgenId)
      const parsed = leadSchema.safeParse(fetched)

      if (!parsed.success) {
        await notifyShapeAlert(payload, {
          leadgenId: String(leadgenId),
          reason: `Lead failed schema validation: ${parsed.error.message}`,
          raw: fetched,
        }).catch((err) => console.error('[facebook-leads] Shape alert failed', err))
        continue
      }

      const normalized = normalizeLead(parsed.data.field_data)

      if (!normalized.email) {
        await notifyShapeAlert(payload, {
          leadgenId: String(leadgenId),
          reason: 'No email could be extracted from the lead',
          raw: parsed.data,
        }).catch((err) => console.error('[facebook-leads] Shape alert failed', err))
      }

      await captureLead(payload, {
        source: 'facebook_lead_ads',
        externalId: parsed.data.id,
        email: normalized.email,
        name: normalized.name,
        phone: normalized.phone,
        rawData: normalized.rawData,
        formId: parsed.data.form_id,
        submittedAt: parsed.data.created_time,
        isTest: normalized.isTest,
      })
      captured += 1
    }
  }

  if (captured > 0) revalidateTag(CACHE_TAGS.leads, 'default')

  // Always return 200 to Meta (otherwise it retries).
  return NextResponse.json({ received: true }, { status: 200 })
}
