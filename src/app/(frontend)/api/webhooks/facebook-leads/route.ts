import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { serverEnv } from '@/lib/env/server'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { verifySignature } from '@/lib/leads/verify-signature'
import { fetchLead } from '@/lib/leads/fetch-lead'
import { fetchForm, type LeadFormT } from '@/lib/leads/fetch-form'
import { leadSchema } from '@/lib/leads/lead-schema'
import { normalizeLead } from '@/lib/leads/normalize-lead'
import { captureLead } from '@/lib/leads/capture-lead'
import { notifyShapeAlert } from '@/lib/leads/notify'
import { logError } from '@/lib/utils/log-error'

/** Meta's one-time verification handshake. */
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
 * Meta delivers only a leadgen_id; the field data is fetched with a Page token in a second call.
 * The signature is verified over the RAW body — read the bytes once as text and JSON.parse that same
 * string, since re-serializing breaks the HMAC. Store-then-notify so a mail failure never loses a lead.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()

  if (
    !verifySignature(raw, request.headers.get('x-hub-signature-256'), serverEnv.META_APP_SECRET)
  ) {
    console.warn('[facebook-leads] Signature verification failed — rejecting')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // A malformed (but signed) body must not 500 — that makes Meta retry forever.
  let body: { entry?: { changes?: { value?: { leadgen_id?: string } }[] }[] }
  try {
    body = JSON.parse(raw)
  } catch {
    logError('[facebook-leads] Body was not valid JSON — acking to stop retries')
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const payload = await getPayload({ config })
  let captured = 0
  let hadUnexpectedError = false
  // A webhook batch usually shares one form — fetch it once per request.
  const formsById = new Map<string, LeadFormT>()

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const leadgenId = change.value?.leadgen_id
      if (!leadgenId) continue

      // A fetch/store failure on one lead must not abort its siblings. Capture is idempotent, so Meta's
      // retry recovers this leadgen_id without duplicating the ones already stored.
      try {
        const fetched = await fetchLead(leadgenId)
        const parsed = leadSchema.safeParse(fetched)

        if (!parsed.success) {
          await notifyShapeAlert(payload, {
            leadgenId: String(leadgenId),
            reason: `Lead failed schema validation: ${parsed.error.message}`,
            raw: fetched,
          }).catch((err) => logError('[facebook-leads] Shape alert failed', err))
          continue
        }

        // The form's questions carry Meta's field `type` (EMAIL/PHONE/FULL_NAME), normalizeLead's most
        // reliable pass; without them it falls back to key heuristics + email regex.
        const formId = parsed.data.form_id
        if (formId && !formsById.has(formId)) {
          formsById.set(formId, await fetchForm(formId))
        }
        const form = formId ? formsById.get(formId) : undefined

        const normalized = normalizeLead(parsed.data.field_data, form?.questions)

        if (!normalized.email) {
          await notifyShapeAlert(payload, {
            leadgenId: String(leadgenId),
            reason: 'No email could be extracted from the lead',
            raw: parsed.data,
          }).catch((err) => logError('[facebook-leads] Shape alert failed', err))
        }

        await captureLead(payload, {
          source: 'facebook_lead_ads',
          externalId: parsed.data.id,
          email: normalized.email,
          name: normalized.name,
          phone: normalized.phone,
          rawData: normalized.rawData,
          formQuestions: form?.questions,
          formId,
          formName: form?.name,
          submittedAt: parsed.data.created_time,
        })
        captured += 1
      } catch (err) {
        // Recoverable: signal it so Meta redelivers the whole batch. The store is idempotent, so
        // already-captured siblings won't duplicate — only this failed leadgen_id retries.
        hadUnexpectedError = true
        logError(`[facebook-leads] Failed to process leadgen_id ${leadgenId}`, err)
      }
    }
  }

  if (captured > 0) revalidateTag(CACHE_TAGS.leads, 'default')

  // Non-200 tells Meta to retry, so only a recoverable error reaches it — a malformed body already
  // acked 200 above, since retrying can't fix it.
  if (hadUnexpectedError) {
    return NextResponse.json({ error: 'Partial failure — retry requested' }, { status: 500 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
